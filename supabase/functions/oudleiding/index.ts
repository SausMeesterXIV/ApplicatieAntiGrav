// Edge function 'oudleiding'
//  - 'registreren' (zonder login): oudleiding maakt een account met gebruikersnaam, wachtwoord en de code
//    van Drankteam. Het account krijgt intern het adres <gebruikersnaam>@oudleiding.ksa-aalter.be; er wordt
//    nooit gemaild (geen bevestigingsmail, geen "wachtwoord vergeten").
//  - 'wachtwoord' (Drankteam of hoofdleiding): nieuw wachtwoord instellen voor een oudleider.
// De code controleert de database (oudleidingscode_klopt: na 10 foute pogingen een uur geblokkeerd).
import { createClient } from 'npm:@supabase/supabase-js@2';

const DOMEIN = 'oudleiding.ksa-aalter.be';

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

const gebruikersnaamGeldig = (g: string) => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(g);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Enkel POST' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    switch (body.actie) {
      case 'registreren': {
        const naam = String(body.naam ?? '').trim();
        const gebruikersnaam = String(body.gebruikersnaam ?? '').trim().toLowerCase();
        const wachtwoord = String(body.wachtwoord ?? '');
        if (naam.length < 2) throw new Fout('Vul je naam in');
        if (!gebruikersnaamGeldig(gebruikersnaam)) {
          throw new Fout('Gebruikersnaam: 3 tot 30 tekens, enkel kleine letters, cijfers, punt, - of _');
        }
        if (wachtwoord.length < 8) throw new Fout('Wachtwoord: minstens 8 tekens');

        const { data: klopt, error: codeFout } = await db.rpc('oudleidingscode_klopt', { p_code: String(body.code ?? '') });
        if (codeFout) throw codeFout;
        if (klopt === 'geblokkeerd') throw new Fout('Te veel foute codes. Probeer het over een uur opnieuw.', 429);
        if (klopt === 'uit') throw new Fout('Registreren voor oudleiding staat uit. Vraag het aan Drankteam.', 403);
        if (klopt !== 'ok') throw new Fout('Deze code klopt niet. Vraag de juiste code aan Drankteam.', 403);

        // Code klopt: de database laat dit ene oudleidingsadres nu 5 minuten toe (trigger controleer_email_domein)
        const email = `${gebruikersnaam}@${DOMEIN}`;
        const { error: aanmeldFout } = await db.from('oudleiding_aanmeldingen').upsert({ email, aangemaakt_op: new Date().toISOString() });
        if (aanmeldFout) throw aanmeldFout;
        const { error } = await db.auth.admin.createUser({
          email,
          password: wachtwoord,
          email_confirm: true,
          user_metadata: { full_name: naam },
          app_metadata: { oudleiding: true },
        });
        if (error) {
          await db.from('oudleiding_aanmeldingen').delete().eq('email', email);
          if (/already|registered|exists/i.test(error.message)) throw new Fout('Deze gebruikersnaam bestaat al', 409);
          throw error;
        }
        return json({ ok: true });
      }

      case 'wachtwoord': {
        const gebruiker = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
          global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
        });
        const { data: user } = await gebruiker.auth.getUser();
        const { data: mag } = await gebruiker.rpc('heeft_recht', { p_recht: 'drank_beheren' });
        if (!user?.user || !mag) throw new Fout('Enkel voor Drankteam en hoofdleiding', 403);

        const wachtwoord = String(body.wachtwoord ?? '');
        if (wachtwoord.length < 8) throw new Fout('Wachtwoord: minstens 8 tekens');
        const { data: profiel } = await db.from('profiles').select('is_oudleiding').eq('id', body.user_id).maybeSingle();
        if (!profiel?.is_oudleiding) throw new Fout('Enkel voor oudleiding (leiding gebruikt "Wachtwoord vergeten")', 403);

        const { error } = await db.auth.admin.updateUserById(body.user_id, { password: wachtwoord });
        if (error) throw error;
        return json({ ok: true });
      }

      default:
        throw new Fout('Onbekende actie');
    }
  } catch (e) {
    const status = e instanceof Fout ? e.status : 500;
    if (status === 500) console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, status);
  }
});
