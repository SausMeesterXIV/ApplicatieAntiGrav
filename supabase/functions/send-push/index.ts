// Edge function: verstuurt een Web Push (VAPID) voor een nieuwe rij in public.notificaties.
// Wordt aangeroepen door een Supabase Database Webhook (INSERT op notificaties), zie supabase/README.md.
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (bv. mailto:hoofdleiding@ksa-aalter.be)
// SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn standaard beschikbaar.
//
// Veiligheid: de payload wordt niet vertrouwd. We lezen de melding opnieuw uit de database
// en versturen enkel meldingen die nog niet als push verstuurd zijn.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@ksa-aalter.be',
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
);

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Waar de melding naartoe leidt als je erop tikt
const urlVoorType = type => ({ agenda: '/agenda', poll: '/polls', order: '/frituur' })[type] ?? '/notificaties';

Deno.serve(async req => {
  try {
    const body = await req.json();
    const id = body?.record?.id;
    if (!id) return json({ error: 'Geen record-id' }, 400);

    // 1. Melding opnieuw ophalen en claimen (enkel als ze nog niet verstuurd is)
    const { data: melding, error } = await supabase
      .from('notificaties')
      .update({ push_verzonden_op: new Date().toISOString() })
      .eq('id', id)
      .is('push_verzonden_op', null)
      .select('id, zender_id, ontvanger_id, titel, bericht, type')
      .maybeSingle();
    if (error) throw error;
    if (!melding) return json({ message: 'Al verstuurd of niet gevonden' });

    // 2. Ontvangers: iedereen (behalve de afzender) of één persoon, enkel met push aan
    let query = supabase.from('profiles').select('id').eq('actief', true).eq('push_enabled', true);
    if (melding.ontvanger_id === 'all') {
      if (melding.zender_id) query = query.neq('id', melding.zender_id);
    } else {
      query = query.eq('id', melding.ontvanger_id);
    }
    const { data: ontvangers, error: ontvangersError } = await query;
    if (ontvangersError) throw ontvangersError;
    const ids = (ontvangers ?? []).map(p => p.id);
    if (ids.length === 0) return json({ message: 'Geen ontvangers met push aan' });

    // 3. Abonnementen van die ontvangers
    const { data: abonnementen, error: abonnementenError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', ids);
    if (abonnementenError) throw abonnementenError;

    const payload = JSON.stringify({
      title: melding.titel,
      body: melding.bericht ?? '',
      url: urlVoorType(melding.type),
      tag: melding.id,
    });

    // 4. Versturen; verlopen abonnementen (404/410) opruimen
    let verstuurd = 0;
    const verlopen = [];
    await Promise.all(
      (abonnementen ?? []).map(async a => {
        try {
          await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload, {
            TTL: 60 * 60 * 24,
          });
          verstuurd++;
        } catch (e) {
          if (e?.statusCode === 404 || e?.statusCode === 410) verlopen.push(a.id);
          else console.error('Push mislukt', a.endpoint, e?.statusCode, e?.body);
        }
      })
    );
    if (verlopen.length) await supabase.from('push_subscriptions').delete().in('id', verlopen);

    return json({ verstuurd, verlopen: verlopen.length });
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
