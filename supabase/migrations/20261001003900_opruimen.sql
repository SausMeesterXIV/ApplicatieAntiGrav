-- =====================================================================
-- Opruimen: oude, ongebruikte onderdelen weg (goedgekeurd op 17/10/2026)
--
-- 1. De cron-taak auto-delete-old-todos, de functie cleanup_old_todos en de tabel personal_todos
--    (geen code gebruikt ze nog).
-- 2. Lege tabellen van vroegere ideeën die nergens meer gebruikt worden: quotes, quote_votes,
--    bierpong_games, bierpong_kampioenen, inkoop_facturen (vervangen door aankoopfacturen) en
--    user_push_tokens (vervangen door push_subscriptions).
-- 3. De verouderde toegangsregel van de lege opslag 'invoices'.
-- Alles van Financiën (ook de oude Financiën-Sheet) blijft voorlopig staan.
-- Alle tabellen hieronder waren leeg op het moment van schrijven.
-- =====================================================================

begin;

-- 1. Todos
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'auto-delete-old-todos';
  end if;
end $$;
drop function if exists public.cleanup_old_todos();
drop table if exists public.personal_todos;

-- 2. Lege, ongebruikte tabellen
drop table if exists public.quote_votes;
drop table if exists public.quotes;
drop table if exists public.bierpong_kampioenen;
drop table if exists public.bierpong_games;
drop table if exists public.inkoop_facturen;
drop table if exists public.user_push_tokens;

-- 3. Lege opslag 'invoices': de verouderde toegangsregel weg. De lege bucket zelf kan enkel via de Storage API
--    of het dashboard verwijderd worden (Supabase blokkeert dat in SQL).
drop policy if exists "Leiding can view invoices" on storage.objects;

notify pgrst, 'reload schema';

commit;
