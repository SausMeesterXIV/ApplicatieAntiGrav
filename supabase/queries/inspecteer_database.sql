-- READ-ONLY: toont de huidige beveiliging en functies van de database.
-- Draai dit in de Supabase SQL Editor VOOR je de migraties uitvoert,
-- en bewaar het resultaat (Export -> CSV) als momentopname.

-- 1. Alle RLS-policies in het public-schema
select tablename, policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 2. Welke tabellen hebben RLS aan?
select c.relname as tabel, c.relrowsecurity as rls_aan
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- 3. Eigen functies (incl. streep_drank, finalize_frituur_sessie, archive_consumpties_period)
select p.proname as functie, pg_get_function_identity_arguments(p.oid) as argumenten,
       p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definitie
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by 1;

-- 4. Triggers op public-tabellen en op auth.users
select event_object_schema as schema, event_object_table as tabel, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth')
order by 1, 2, 3;
