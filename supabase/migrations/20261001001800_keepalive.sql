-- =====================================================================
-- Wakker houden: het gratis Supabase-project pauzeert na 7 dagen zonder gebruik.
-- Een dagelijkse taak op Vercel (api/keepalive.js, vercel.json) roept ping() aan.
-- ping() geeft enkel de huidige tijd terug: geen data, geen rechten nodig.
-- Vereist: 20261001001600_beveiliging.sql (die alles voor anon dichtzette)
-- =====================================================================

begin;

create or replace function public.ping()
returns timestamptz language sql stable as $$
  select now();
$$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

commit;
