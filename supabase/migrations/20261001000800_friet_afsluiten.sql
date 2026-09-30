-- =====================================================================
-- Friet: een bestelronde afsluiten (CLAUDE.md: Friet)
--  - iedereen (actieve leiding) mag een ronde afsluiten
--  - alle bestellingen van de ronde krijgen status 'geleverd'
--  - het betaalde bedrag (kasticket) wordt bewaard; 0 = afsluiten zonder bedrag
--  - geeft het verwachte bedrag terug (som van de bestellingen), voor de prijsvergelijking
-- De app riep finalize_frituur_sessie al aan, maar de functie stond nog niet in de migraties.
-- Deze migratie legt ze vast, met rechtencontrole (security definer omzeilt RLS).
-- Vereist: 20261001000100_rollen_en_rechten.sql
-- =====================================================================

begin;

alter table public.frituur_sessies add column if not exists actual_amount numeric(10,2);
alter table public.frituur_sessies add column if not exists receipt_url text;
alter table public.frituur_sessies add column if not exists closed_at timestamptz;

-- Oude versie(s) weg, ongeacht de parametertypes (voorkomt dubbele functies)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'finalize_frituur_sessie' loop
    execute format('drop function %s', f.sig);
  end loop;
end $$;

create function public.finalize_frituur_sessie(p_sessie_id uuid, p_actual_amount numeric default 0)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_verwacht numeric;
begin
  if not public.is_leiding() then
    raise exception 'Niet ingelogd als actieve leiding';
  end if;

  select status into v_status from frituur_sessies where id = p_sessie_id for update;
  if not found then
    raise exception 'Onbekende frietronde';
  end if;
  if v_status = 'completed' then
    raise exception 'Deze frietronde is al afgesloten';
  end if;

  select coalesce(sum(totaal_prijs), 0) into v_verwacht
  from frituur_bestellingen
  where sessie_id = p_sessie_id;

  update frituur_bestellingen set status = 'geleverd' where sessie_id = p_sessie_id;

  update frituur_sessies
  set status = 'completed',
      actual_amount = nullif(p_actual_amount, 0),
      closed_at = now()
  where id = p_sessie_id;

  return json_build_object('expected_amount', round(v_verwacht, 2), 'actual_amount', p_actual_amount);
end;
$$;

revoke all on function public.finalize_frituur_sessie(uuid, numeric) from public, anon;
grant execute on function public.finalize_frituur_sessie(uuid, numeric) to authenticated;

commit;
