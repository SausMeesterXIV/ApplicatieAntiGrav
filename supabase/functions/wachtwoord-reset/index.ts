// Edge function 'wachtwoord-reset' (zonder login)
//  Leiding die het wachtwoord vergat, kreeg een code van een leider die ze zelf koos (zie migratie 002900).
//  Body: { email, code, wachtwoord }. De database controleert de code (controleer_resetcode: 10 minuten
//  geldig, na 5 foute pogingen vervallen, één keer te gebruiken); daarna zetten we het nieuwe wachtwoord.
//  Er wordt nooit gemaild.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Enkel POST' }, 405);

  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const code = String(body.code ?? '').replace(/\s/g, '');
    const wachtwoord = String(body.wachtwoord ?? '');

    if (!email || !/^\d{6}$/.test(code)) return json({ error: 'Vul je e-mailadres en de code van 6 cijfers in' }, 400);
    if (wachtwoord.length < 8) return json({ error: 'Wachtwoord: minstens 8 tekens' }, 400);

    const { data: userId, error } = await db.rpc('controleer_resetcode', { p_email: email, p_code: code });
    if (error) throw error;
    if (!userId) {
      return json(
        { error: 'Deze code klopt niet of is verlopen (10 minuten geldig, 5 pogingen). Vraag een nieuwe code aan.' },
        403,
      );
    }

    const { error: updateFout } = await db.auth.admin.updateUserById(userId, { password: wachtwoord });
    if (updateFout) throw updateFout;
    return json({ ok: true });
  } catch (e) {
    console.error('wachtwoord-reset', e);
    return json({ error: 'Er ging iets mis. Probeer het opnieuw of vraag een nieuwe code.' }, 500);
  }
});
