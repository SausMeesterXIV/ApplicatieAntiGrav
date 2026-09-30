// Edge function: foto's van de leiding naar de Google Drive van KSA.
//  - albums = submappen van één hoofdmap in Drive (waar ook het cameraatje naartoe uploadt)
//  - enkel ingelogde, actieve leiding (controle via public.is_leiding())
//  - uploaden gebeurt rechtstreeks van de gsm naar Google: deze functie start enkel een
//    "resumable upload"-sessie en geeft de upload-URL terug. Zo gaan de foto's niet via Supabase
//    (spaart het gratis dataverkeer).
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets), zie supabase/README.md:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN  (toestemming van het KSA-Google-account)
//   DRIVE_FOTOS_MAP_ID                                             (id van de hoofdmap met de albums)
// SUPABASE_URL en SUPABASE_ANON_KEY zijn standaard beschikbaar.
//
// Acties (POST, JSON { actie, ... }):
//   { actie: 'albums' }                                   -> { albums: [{ id, naam, link, gemaakt }] }
//   { actie: 'album-maken', naam }                        -> { album }
//   { actie: 'upload-starten', albumId, naam, type, grootte } -> { uploadUrl }

import { createClient } from 'npm:@supabase/supabase-js@2';

const MAX_GROOTTE = 200 * 1024 * 1024; // 200 MB per bestand (ook korte video's)
const MAP_TYPE = 'application/vnd.google-apps.folder';
const DRIVE = 'https://www.googleapis.com/drive/v3';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

class Fout extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------
// Google-toegang met de refresh token van het KSA-account (token even bewaren)
// ---------------------------------------------------------------------
let token: { waarde: string; geldigTot: number } | null = null;

async function googleToken(): Promise<string> {
  if (token && token.geldigTot > Date.now() + 60_000) return token.waarde;
  const antwoord = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: Deno.env.get('GOOGLE_REFRESH_TOKEN') ?? '',
      grant_type: 'refresh_token',
    }),
  });
  if (!antwoord.ok) {
    console.error('Google-token mislukt', await antwoord.text());
    throw new Fout('De koppeling met Google Drive werkt niet (meer). Laat de hoofdleiding ze opnieuw instellen.', 502);
  }
  const data = await antwoord.json();
  token = { waarde: data.access_token, geldigTot: Date.now() + data.expires_in * 1000 };
  return token.waarde;
}

async function drive(pad: string, init: RequestInit = {}) {
  const antwoord = await fetch(`${DRIVE}${pad}`, {
    ...init,
    headers: { Authorization: `Bearer ${await googleToken()}`, ...(init.headers ?? {}) },
  });
  if (!antwoord.ok) {
    console.error('Drive-fout', pad, antwoord.status, await antwoord.text());
    throw new Fout('Google Drive gaf een fout. Probeer het later opnieuw.', 502);
  }
  return antwoord.json();
}

const hoofdmap = () => {
  const id = Deno.env.get('DRIVE_FOTOS_MAP_ID');
  if (!id) throw new Fout("Foto's zijn nog niet ingesteld (DRIVE_FOTOS_MAP_ID ontbreekt).", 503);
  return id;
};

// Een album is de hoofdmap zelf of een (directe) submap ervan
async function controleerAlbum(albumId: string) {
  if (!/^[\w-]{10,}$/.test(albumId)) throw new Fout('Ongeldig album');
  if (albumId === hoofdmap()) return;
  const map = await drive(`/files/${albumId}?fields=id,mimeType,parents,trashed&supportsAllDrives=true`);
  if (map.mimeType !== MAP_TYPE || map.trashed || !(map.parents ?? []).includes(hoofdmap())) {
    throw new Fout('Dit album hoort niet bij de fotomap van KSA', 403);
  }
}

const albumVan = (m: { id: string; name: string; webViewLink: string; createdTime: string }) => ({
  id: m.id,
  naam: m.name,
  link: m.webViewLink,
  gemaakt: m.createdTime,
});

// ---------------------------------------------------------------------
// Acties
// ---------------------------------------------------------------------
// Hoofdmap eerst (daar komt het cameraatje mogelijk rechtstreeks in), dan de submappen, nieuwste eerst
async function albums() {
  const q = encodeURIComponent(`'${hoofdmap()}' in parents and mimeType='${MAP_TYPE}' and trashed=false`);
  const [hoofd, data] = await Promise.all([
    drive(`/files/${hoofdmap()}?fields=id,name,webViewLink,createdTime&supportsAllDrives=true`),
    drive(
      `/files?q=${q}&fields=files(id,name,webViewLink,createdTime)&orderBy=createdTime desc&pageSize=200` +
        '&supportsAllDrives=true&includeItemsFromAllDrives=true',
    ),
  ]);
  return { albums: [{ ...albumVan(hoofd), hoofdmap: true }, ...(data.files ?? []).map(albumVan)] };
}

async function albumMaken(naam: unknown) {
  const schoon = String(naam ?? '')
    .trim()
    .slice(0, 100);
  if (!schoon) throw new Fout('Geef het album een naam');
  const map = await drive('/files?fields=id,name,webViewLink,createdTime&supportsAllDrives=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: schoon, mimeType: MAP_TYPE, parents: [hoofdmap()] }),
  });
  return { album: albumVan(map) };
}

async function uploadStarten(body: Record<string, unknown>, uploader: string, origin: string | null) {
  const albumId = String(body.albumId ?? '');
  const naam =
    String(body.naam ?? '')
      .trim()
      .slice(0, 200) || 'foto';
  const type = String(body.type ?? '');
  const grootte = Number(body.grootte ?? 0);

  if (!/^(image|video)\//.test(type)) throw new Fout(`${naam}: enkel foto's en video's`);
  if (!(grootte > 0) || grootte > MAX_GROOTTE) throw new Fout(`${naam} is te groot (max 200 MB)`);
  await controleerAlbum(albumId);

  // Sessie starten; met de Origin van de app mag de browser daarna zelf de bytes sturen (CORS)
  const antwoord = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await googleToken()}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': type,
        'X-Upload-Content-Length': String(grootte),
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify({
        name: naam,
        parents: [albumId],
        description: `Toegevoegd via de KSA-app door ${uploader}`,
      }),
    },
  );
  const uploadUrl = antwoord.headers.get('Location');
  if (!antwoord.ok || !uploadUrl) {
    console.error('Upload starten mislukt', antwoord.status, await antwoord.text());
    throw new Fout('Uploaden starten mislukt. Probeer het opnieuw.', 502);
  }
  return { uploadUrl };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Enkel POST' }, 405);

  try {
    // Enkel ingelogde, actieve leiding
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: gebruiker } = await supabase.auth.getUser();
    const { data: isLeiding } = await supabase.rpc('is_leiding');
    if (!gebruiker?.user || !isLeiding) throw new Fout('Enkel voor ingelogde leiding', 401);

    const body = await req.json().catch(() => ({}));
    switch (body.actie) {
      case 'albums':
        return json(await albums());
      case 'album-maken':
        return json(await albumMaken(body.naam));
      case 'upload-starten': {
        const { data: profiel } = await supabase
          .from('profiles')
          .select('naam')
          .eq('id', gebruiker.user.id)
          .maybeSingle();
        return json(
          await uploadStarten(body, profiel?.naam ?? gebruiker.user.email ?? 'leiding', req.headers.get('Origin')),
        );
      }
      default:
        throw new Fout('Onbekende actie');
    }
  } catch (e) {
    const status = e instanceof Fout ? e.status : 500;
    if (!(e instanceof Fout)) console.error(e);
    return json({ error: e instanceof Fout ? e.message : 'Er ging iets mis' }, status);
  }
});
