-- =====================================================================
-- Functierechten dichtzetten (bevindingen van de Supabase Security Advisor)
--
-- Postgres geeft elke nieuwe functie standaard EXECUTE aan PUBLIC (iedereen, ook niet-ingelogden).
-- Migratie 001600 trok het recht in voor de rol anon, maar via PUBLIC bleef het bestaan. Gevolg:
--  - archive_consumpties_period (oud, security definer, archiveert strepen) en cleanup_old_todos waren
--    aanroepbaar zonder login. De app gebruikt ze niet meer; de cron-taak draait als eigenaar.
-- Deze migratie:
--  1. haalt EXECUTE voor PUBLIC weg op alle functies in public, ook voor toekomstige functies
--  2. geeft ingelogde leiding enkel de functies die de app en de RLS-regels nodig hebben
--  3. zet een vast search_path op functies die er geen hadden (waarschuwing function_search_path_mutable)
-- Triggerfuncties hebben geen EXECUTE-recht nodig: triggers draaien ze toch.
-- =====================================================================

begin;

-- 1. Niemand meer via PUBLIC
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;

-- De oude functies: enkel nog de eigenaar (SQL Editor / cron)
do $$
begin
  if to_regprocedure('public.archive_consumpties_period()') is not null then
    revoke execute on function public.archive_consumpties_period() from anon, authenticated;
  end if;
  if to_regprocedure('public.cleanup_old_todos()') is not null then
    revoke execute on function public.cleanup_old_todos() from anon, authenticated;
  end if;
end $$;

-- 2. Wat ingelogde leiding nodig heeft (RLS-hulpfuncties en de functies die de app aanroept)
grant execute on function public.is_leiding(), public.is_hoofdleiding(), public.heeft_recht(text) to authenticated;
grant execute on function public.mag_item_aanpassen(uuid, uuid) to authenticated;
grant execute on function public.streep_drank(uuid, uuid, integer, uuid) to authenticated;
grant execute on function public.corrigeer_voorraad(uuid, integer, text) to authenticated;
grant execute on function public.periode_overzicht(uuid, numeric) to authenticated;
grant execute on function public.sluit_periode_af(uuid, numeric) to authenticated;
grant execute on function public.ranking_huidige_periode() to authenticated;
grant execute on function public.stuur_bericht(text, text, uuid[], text, text, text) to authenticated;
grant execute on function public.finalize_frituur_sessie(uuid, numeric) to authenticated;
-- De dagelijkse wektaak (Vercel) roept ping() aan zonder login
grant execute on function public.ping() to anon, authenticated;

-- 3. Vast search_path op functies zonder (pg_catalog blijft altijd eerst)
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public', f.sig);
    raise notice 'search_path gezet op %', f.sig;
  end loop;
end $$;

commit;
