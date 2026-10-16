-- =====================================================================
-- Godmode zichtbaar voor de leiding
--
-- Beslissing (16/10): iedereen mag zien wie Godmode heeft (label "Godmode" in de app).
-- Aanpassen blijft enkel in de database (tabel godmode_accounts, zie 003100).
-- Vereist: 20261001003100_godmode.sql
-- =====================================================================

begin;

-- Alle Godmode-accounts (enkel voor wie lid is: actieve leiding of oudleiding)
create or replace function public.godmode_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select g.user_id from godmode_accounts g where public.is_lid();
$$;
revoke all on function public.godmode_ids() from public, anon;
grant execute on function public.godmode_ids() to authenticated;

commit;
