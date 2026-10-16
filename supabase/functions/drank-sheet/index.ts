// Edge function: Google Sheet voor Drankteam (enkel lezen, de app is de bron).
//  - 'sync': de tabbladen Drankrekening, Bakken, Rekening, Strepen, Facturen en Info opnieuw vullen, enkel als er iets veranderd is
//      * aangeroepen door de database elke 30 seconden (pg_cron, migratie 003600) en bij het openen in de app
//  - 'url':  de link naar de Sheet (null als er geen gekoppeld is)
// Mag: Drankteam, Financiën en hoofdleiding (ingelogd), of de database zelf met de service key.
// De rekenlogica staat in ../_shared/drankSheet.js (getest in tests/drankSheet.test.js).
//
// Google-toegang met een service account (robot), niet met iemands persoonlijke account:
// de Sheet maakt iemand van KSA zelf aan en deelt ze met het e-mailadres van de robot als Bewerker.
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   GOOGLE_SERVICE_ACCOUNT_B64  de JSON-sleutel van het service account, in base64
//   DRANK_SHEET_ID              het id uit de link van de Sheet (docs.google.com/spreadsheets/d/<id>/...)
// SUPABASE_URL, SUPABASE_ANON_KEY en SUPABASE_SERVICE_ROLE_KEY zijn standaard beschikbaar.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  EURO_KOLOMMEN,
  drankrekeningTabbladen,
  formuleScheiding,
  INHOUD_TABBLADEN,
  SHEET_VERSIE,
  TABBLADEN,
  factuurRijen,
  infoRijen,
  rekeningRijen,
  strepenRijen,
  zelfdeInhoud,
} from '../_shared/drankSheet.js';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

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

const sheetId = () => Deno.env.get('DRANK_SHEET_ID') ?? '';

// ---------------------------------------------------------------------
// Google-toegang met het service account (JWT ondertekend met de private key)
// ---------------------------------------------------------------------
let token: { waarde: string; geldigTot: number } | null = null;

const b64url = (data: ArrayBuffer | string) =>
  btoa(typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

async function googleToken(): Promise<string> {
  if (token && token.geldigTot > Date.now() + 60_000) return token.waarde;
  let sleutel: { client_email: string; private_key: string };
  try {
    sleutel = JSON.parse(atob(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_B64') ?? ''));
  } catch {
    throw new Fout('De Google-robot is nog niet ingesteld (secret GOOGLE_SERVICE_ACCOUNT_B64).', 503);
  }
  const pem = sleutel.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const nu = Math.floor(Date.now() / 1000);
  const ongetekend =
    b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) +
    '.' +
    b64url(
      JSON.stringify({
        iss: sleutel.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        iat: nu,
        exp: nu + 3600,
      }),
    );
  const handtekening = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(ongetekend));
  const antwoord = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${ongetekend}.${b64url(handtekening)}`,
    }),
  });
  if (!antwoord.ok) {
    console.error('Google-token mislukt', await antwoord.text());
    throw new Fout('De koppeling met Google werkt niet (meer).', 502);
  }
  const data = await antwoord.json();
  token = { waarde: data.access_token, geldigTot: Date.now() + data.expires_in * 1000 };
  return token.waarde;
}

async function google(url: string, init: RequestInit = {}) {
  const antwoord = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await googleToken()}`, 'Content-Type': 'application/json' },
  });
  if (!antwoord.ok) {
    const tekst = await antwoord.text();
    console.error('Google-fout', url, antwoord.status, tekst);
    if (antwoord.status === 404 || antwoord.status === 403) {
      throw new Fout('De robot kan de Sheet niet openen. Is ze verwijderd of niet meer gedeeld met de robot?', 502);
    }
    throw new Fout('Google gaf een fout. Probeer het later opnieuw.', 502);
  }
  return antwoord.json();
}

// ---------------------------------------------------------------------
// Data uit de app
// ---------------------------------------------------------------------
async function laad(db: SupabaseClient) {
  const { data: periode, error: pFout } = await db
    .from('billing_periods')
    .select('id, naam')
    .eq('is_closed', false)
    .order('start_datum', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pFout) throw pFout;

  let strepenQuery = db.from('consumpties').select('drank_id, aantal, user_naam, profiles(naam)').is('factuur_id', null);
  strepenQuery = periode
    ? strepenQuery.or(`period_id.eq.${periode.id},period_id.is.null`)
    : strepenQuery.is('period_id', null);

  const [overzicht, strepen, dranken, facturen, profielen, godmode] = await Promise.all([
    db.rpc('periode_overzicht'),
    strepenQuery,
    db.from('dranken').select('id, naam, prijs, is_temporary, geldig_van, geldig_tot, uit_lijst'),
    db
      .from('facturen')
      .select(
        'nummer, periode, user_naam, aantal_strepen, drank_bedrag, friet_bedrag, correctie_bedrag, totaal_bedrag, mededeling, status, betaald_op, profiles(naam), billing_periods(naam, start_datum)',
      ),
    db.from('profiles').select('id, naam, is_oudleiding').eq('actief', true),
    db.from('godmode_accounts').select('user_id'),
  ]);
  for (const r of [overzicht, strepen, dranken, facturen, profielen, godmode]) if (r.error) throw r.error;
  // Vaste lijst leiders: alle actieve accounts behalve Godmode (testaccount)
  const godmodeIds = new Set((godmode.data ?? []).map(g => g.user_id));
  const leiders = (profielen.data ?? [])
    .filter(p => !godmodeIds.has(p.id) && p.naam)
    .map(p => ({ naam: p.naam as string, oud: !!p.is_oudleiding }));

  return {
    periode,
    leiders,
    overzicht: overzicht.data ?? [],
    // deno-lint-ignore no-explicit-any
    strepen: (strepen.data ?? []).map((s: any) => ({ ...s, naam: s.profiles?.naam ?? s.user_naam })),
    dranken: dranken.data ?? [],
    facturen: facturen.data ?? [],
  };
}

const EURO = { numberFormat: { type: 'CURRENCY', pattern: '€ #,##0.00' } };
const INVOER_KLEUR = { red: 1, green: 0.95, blue: 0.75 };

// Opmaak van Drankrekening en Bakken: bij elke keer schrijven opnieuw, want de kolommen schuiven mee met de dranken
// deno-lint-ignore no-explicit-any
function opmaakVerzoeken(dr: number, bk: number, o: any, aantalBakken: number) {
  const vet = { textFormat: { bold: true } };
  const cel = (sheetId: number, r0: number, r1: number | undefined, c0: number | undefined, c1: number | undefined, fmt: unknown, fields: string) => ({
    repeatCell: {
      range: { sheetId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 },
      cell: { userEnteredFormat: fmt },
      fields,
    },
  });
  const wis = (sheetId: number) => cel(sheetId, 0, undefined, undefined, undefined, {}, 'userEnteredFormat(numberFormat,backgroundColor,textFormat)');
  const vastzetten = (sheetId: number) => ({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 } },
      fields: 'gridProperties(frozenRowCount,frozenColumnCount)',
    },
  });
  const k = o.aantalDranken;
  return [
    // Drankrekening
    wis(dr),
    vastzetten(dr),
    cel(dr, 0, 1, undefined, undefined, vet, 'userEnteredFormat.textFormat.bold'),
    ...o.euroKolommen.map((c: number) => cel(dr, 1, o.totaalRij, c, c + 1, EURO, 'userEnteredFormat.numberFormat')),
    cel(dr, o.totaalRij - 1, o.totaalRij, undefined, undefined, vet, 'userEnteredFormat.textFormat.bold'),
    cel(dr, o.prijsRij - 1, o.prijsRij, undefined, undefined, { ...EURO, ...vet }, 'userEnteredFormat(numberFormat,textFormat)'),
    cel(dr, 1, o.totaalRij, 1, 2, vet, 'userEnteredFormat.textFormat.bold'),
    ...(o.oudKopRij ? [cel(dr, o.oudKopRij - 1, o.oudKopRij, 0, 1, vet, 'userEnteredFormat.textFormat.bold')] : []),
    // Bakken: geel = zelf invullen
    wis(bk),
    vastzetten(bk),
    cel(bk, 0, 1, undefined, undefined, vet, 'userEnteredFormat.textFormat.bold'),
    ...(k ? [cel(bk, 1, 1 + k, 1, 6, { backgroundColor: INVOER_KLEUR }, 'userEnteredFormat.backgroundColor')] : []),
    ...[1, 9, 10, 11].map(c => cel(bk, 1, aantalBakken, c, c + 1, EURO, 'userEnteredFormat.numberFormat')),
    ...(k ? [cel(bk, 1 + k, 2 + k, undefined, undefined, vet, 'userEnteredFormat.textFormat.bold')] : []),
    // De ID-kolom (M) verbergen: die gebruikt de app om de invoer per drank te bewaren
    {
      updateDimensionProperties: {
        range: { sheetId: bk, dimension: 'COLUMNS', startIndex: 12, endIndex: 13 },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    },
  ];
}

const bereik = (tabbladen: string[], optie: string) =>
  `values:batchGet?valueRenderOption=${optie}&${tabbladen.map(t => `ranges=${encodeURIComponent(`'${t}'`)}`).join('&')}`;

// ---------------------------------------------------------------------
// De Sheet vullen
// ---------------------------------------------------------------------
async function synchroniseer(db: SupabaseClient) {
  const id = sheetId();
  if (!id) throw new Fout('Er is nog geen Sheet gekoppeld (secret DRANK_SHEET_ID).', 409);
  const data = await laad(db);
  const namen = data.leiders.map(l => l.naam);
  const inhoud: Record<string, unknown[][]> = {
    Rekening: rekeningRijen(data.overzicht, namen),
    Strepen: strepenRijen(data.strepen, data.dranken, namen),
    Facturen: factuurRijen(data.facturen),
    Info: infoRijen({ periode: data.periode }),
  };

  // Ontbrekende tabbladen aanmaken op hun plaats (een leeg standaardblad "Blad1"/"Sheet1" wordt het eerste)
  const meta = await google(`${SHEETS}/${id}?fields=properties.locale,sheets.properties`);
  // deno-lint-ignore no-explicit-any
  const bestaand = (meta.sheets ?? []).map((s: any) => s.properties);
  // deno-lint-ignore no-explicit-any
  const opNaam = new Map<string, any>(bestaand.map((p: any) => [p.title, p]));
  // deno-lint-ignore no-explicit-any
  const verzoeken: any[] = [];
  const nieuw: string[] = [];
  const standaard = bestaand.find(
    // deno-lint-ignore no-explicit-any
    (p: any) => ['Blad1', 'Sheet1'].includes(p.title) && !TABBLADEN.some(t => opNaam.has(t)),
  );
  TABBLADEN.forEach((titel, index) => {
    if (opNaam.has(titel)) return;
    if (standaard && index === 0) {
      verzoeken.push({ updateSheetProperties: { properties: { sheetId: standaard.sheetId, title: titel }, fields: 'title' } });
      opNaam.set(titel, { ...standaard, title: titel });
    } else {
      verzoeken.push({ addSheet: { properties: { title: titel, index } } });
    }
    nieuw.push(titel);
  });
  if (verzoeken.length) {
    const antwoord = await google(`${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: verzoeken }) });
    // deno-lint-ignore no-explicit-any
    for (const r of antwoord.replies ?? []) if (r.addSheet) opNaam.set(r.addSheet.properties.title, r.addSheet.properties);

    // Opmaak voor nieuwe gewone tabbladen: vetgedrukte, vastgezette kopregel en euro-kolommen
    // deno-lint-ignore no-explicit-any
    const opmaak: any[] = [];
    for (const titel of nieuw.filter(t => !['Drankrekening', 'Bakken'].includes(t))) {
      const blad = opNaam.get(titel).sheetId;
      opmaak.push(
        {
          updateSheetProperties: {
            properties: { sheetId: blad, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        {
          repeatCell: {
            range: { sheetId: blad, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat.bold',
          },
        },
        ...((EURO_KOLOMMEN as Record<string, number[]>)[titel] ?? []).map(kolom => ({
          repeatCell: {
            range: { sheetId: blad, startRowIndex: 1, startColumnIndex: kolom, endColumnIndex: kolom + 1 },
            cell: { userEnteredFormat: EURO },
            fields: 'userEnteredFormat.numberFormat',
          },
        })),
      );
    }
    if (opmaak.length) await google(`${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: opmaak }) });
  }

  // Wat jullie in Bakken invulden (formules als formule), om te bewaren
  const oudeBakken = (await google(`${SHEETS}/${id}/${bereik(['Bakken'], 'FORMULA')}`)).valueRanges?.[0]?.values ?? [];
  const dr = drankrekeningTabbladen({
    rekening: data.overzicht,
    strepen: data.strepen,
    dranken: data.dranken,
    leiders: data.leiders,
    oudeBakken,
    scheiding: formuleScheiding(meta.properties?.locale),
  });

  // Niets veranderd sinds de vorige keer? Dan niet schrijven (anders loopt de versiegeschiedenis vol).
  // De dranken (en hun volgorde) zitten in de ID-kolom van Bakken.
  if (!nieuw.length) {
    const huidig = await google(`${SHEETS}/${id}/${bereik(INHOUD_TABBLADEN, 'UNFORMATTED_VALUE')}&ranges=${encodeURIComponent("'Info'!B1")}`);
    const versie = (huidig.valueRanges?.[INHOUD_TABBLADEN.length] as any)?.values?.[0]?.[0];
    // deno-lint-ignore no-explicit-any
    const zelfde = INHOUD_TABBLADEN.every((t, i) => zelfdeInhoud((huidig.valueRanges?.[i] as any)?.values, inhoud[t]));
    const ids = (rijen: unknown[][]) => JSON.stringify(rijen.slice(1).map(r => String(r?.[12] ?? '')).filter(Boolean));
    if (zelfde && versie === `versie ${SHEET_VERSIE}` && ids(oudeBakken) === ids(dr.bakken)) {
      return { url: `https://docs.google.com/spreadsheets/d/${id}/edit`, ongewijzigd: true };
    }
  }

  // Schrijven. Bakken wordt niet eerst leeggemaakt (wat jullie intussen typen, gaat zo minder snel verloren);
  // enkel de rijen onder de nieuwe inhoud worden gewist.
  const gewoon = ['Rekening', 'Strepen', 'Facturen', 'Info'];
  await google(`${SHEETS}/${id}/values:batchClear`, {
    method: 'POST',
    body: JSON.stringify({ ranges: [...gewoon, 'Drankrekening'].map(t => `'${t}'`).concat(`'Bakken'!A${dr.bakken.length + 1}:Z`) }),
  });
  await google(`${SHEETS}/${id}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data: gewoon.map(t => ({ range: `'${t}'!A1`, values: inhoud[t] })) }),
  });
  await google(`${SHEETS}/${id}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `'Drankrekening'!A1`, values: dr.drankrekening },
        // Lege cellen expliciet schrijven, zodat oude waarden in Bakken niet blijven staan
        { range: `'Bakken'!A1`, values: dr.bakken.map(r => [...r, ...Array(13 - r.length).fill('')].slice(0, 13)) },
      ],
    }),
  });
  await google(`${SHEETS}/${id}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: opmaakVerzoeken(opNaam.get('Drankrekening').sheetId, opNaam.get('Bakken').sheetId, dr.opmaak, dr.bakken.length),
    }),
  });

  // Controle: staan er formulefouten (#REF!, #NAME?, ...) in de berekende tabbladen?
  const nagekeken = await google(`${SHEETS}/${id}/${bereik(['Drankrekening', 'Bakken'], 'FORMATTED_VALUE')}`);
  const formuleFouten = (nagekeken.valueRanges ?? [])
    // deno-lint-ignore no-explicit-any
    .flatMap((v: any) => (v.values ?? []).flat())
    .filter((w: unknown) => typeof w === 'string' && /^#(REF|NAME|VALUE|DIV\/0|N\/A|ERROR|NUM|NULL)/.test(w)).length;
  if (formuleFouten) console.error('Formulefouten in de Sheet', formuleFouten);

  return { url: `https://docs.google.com/spreadsheets/d/${id}/edit`, bijgewerkt: new Date().toISOString(), formuleFouten };
}

function jwtRol(autorisatie: string): string | null {
  try {
    const deel = autorisatie.replace(/^Bearer\s+/i, '').split('.')[1];
    return JSON.parse(atob(deel.replace(/-/g, '+').replace(/_/g, '/'))).role ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Enkel POST' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const autorisatie = req.headers.get('Authorization') ?? '';
    // De database (pg_cron/pg_net) roept aan met een service-role-JWT. Deze functie wordt MET JWT-controle
    // gedeployed, dus de handtekening is al nagekeken voor we hier zijn; de rol lezen volstaat.
    const systeem =
      (serviceKey !== '' && autorisatie === `Bearer ${serviceKey}`) || jwtRol(autorisatie) === 'service_role';
    if (!systeem) {
      // Ingelogde leiding met het recht Drankteam of Financiën (of hoofdleiding)
      const gebruiker = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: autorisatie } },
      });
      const { data: user } = await gebruiker.auth.getUser();
      const [{ data: drank }, { data: financien }] = await Promise.all([
        gebruiker.rpc('heeft_recht', { p_recht: 'drank_beheren' }),
        gebruiker.rpc('heeft_recht', { p_recht: 'financien' }),
      ]);
      if (!user?.user || !(drank || financien)) throw new Fout('Enkel voor Drankteam, Financiën en hoofdleiding', 403);
    }

    const body = await req.json().catch(() => ({}));
    switch (body.actie) {
      case 'url':
        return json({ url: sheetId() ? `https://docs.google.com/spreadsheets/d/${sheetId()}/edit` : null });
      case 'sync':
        return json(await synchroniseer(db));
      default:
        throw new Fout('Onbekende actie');
    }
  } catch (e) {
    const status = e instanceof Fout ? e.status : 500;
    if (!(e instanceof Fout)) console.error(e);
    return json({ error: e instanceof Fout ? e.message : 'Er ging iets mis' }, status);
  }
});
