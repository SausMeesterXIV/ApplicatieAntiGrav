-- =====================================================================
-- Controle na de migraties (READ-ONLY: wijzigt niets)
-- Draai in de Supabase SQL Editor nadat alle migraties uitgevoerd zijn.
-- Elke rij is één controle: ok = true is goed. Kijk vooral naar de rijen met ok = false.
-- =====================================================================

with
verwachte_tabellen(naam) as (values
  ('groepen'), ('werkgroepen'), ('profiel_groepen'), ('profiel_werkgroepen'),
  ('event_aanwezigheid'), ('voorraad_correcties'), ('polls'), ('poll_opties'), ('poll_stemmen'),
  ('push_subscriptions'), ('verslagen'), ('bijlagen'), ('notificatie_gelezen')
),
verwachte_functies(naam) as (values
  ('is_leiding'), ('is_hoofdleiding'), ('heeft_recht'), ('streep_drank'), ('corrigeer_voorraad'),
  ('periode_overzicht'), ('sluit_periode_af'), ('ranking_huidige_periode'), ('gestructureerde_mededeling'),
  ('stuur_bericht'), ('stuur_agenda_herinneringen'), ('finalize_frituur_sessie'), ('mag_item_aanpassen'), ('ping')
),
verwachte_triggers(tabel, naam) as (values
  ('profiles', 'bescherm_profielvelden'), ('profiles', 'bewaar_laatste_hoofdleiding'),
  ('consumpties', 'consumptie_zet_prijs'), ('consumpties', 'consumptie_voorraad'),
  ('facturen', 'factuur_betaald_op'), ('events', 'melding_agenda_item'), ('events', 'bewaar_maker_event'),
  ('polls', 'melding_nieuwe_poll'), ('poll_stemmen', 'controleer_stem'),
  ('frituur_bestellingen', 'friet_prijs_uit_menu'), ('frituur_bestellingen', 'melding_friet_voor_ander'),
  ('frituur_bestellingen', 'bescherm_frietbestelling'), ('notificaties', 'melding_echte_afzender'),
  ('verslagen', 'verslag_bijwerken'), ('verslagen', 'melding_nieuw_verslag'),
  ('frituur_bestellingen', 'melding_friet_geannuleerd')
),
controles as (
  -- 1. Registratie enkel met @ksa-aalter.be (trigger op auth.users)
  select 1 as nr, 'Registratie-controle @ksa-aalter.be' as controle,
         exists (select 1 from pg_trigger where tgname = 'controleer_email_domein' and not tgisinternal) as ok,
         '' as detail

  -- 2. Minstens één actieve hoofdleiding
  union all
  select 2, 'Actieve hoofdleiding',
         exists (select 1 from public.profiles where is_hoofdleiding and actief),
         coalesce((select string_agg(naam, ', ') from public.profiles where is_hoofdleiding and actief), 'niemand!')

  -- 3. Nieuwe tabellen bestaan
  union all
  select 3, 'Tabel ' || v.naam, to_regclass('public.' || v.naam) is not null, ''
  from verwachte_tabellen v

  -- 4. RLS staat aan op ALLE tabellen in public
  union all
  select 4, 'RLS op alle tabellen',
         not exists (
           select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
         coalesce((
           select 'zonder RLS: ' || string_agg(c.relname, ', ')
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), '')

  -- 5. Anoniem heeft geen rechten op tabellen
  union all
  select 5, 'Geen toegang voor niet-ingelogden (anon)',
         not exists (
           select 1 from information_schema.role_table_grants
           where grantee = 'anon' and table_schema = 'public'),
         coalesce((
           select 'anon heeft nog rechten op: ' || string_agg(distinct table_name, ', ')
           from information_schema.role_table_grants
           where grantee = 'anon' and table_schema = 'public'), '')

  -- 6. Functies bestaan
  union all
  select 6, 'Functie ' || v.naam,
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = v.naam), ''
  from verwachte_functies v

  -- 7. Geen dubbele versies van functies met een gewijzigde signatuur
  union all
  select 7, 'Eén versie van ' || v.naam,
         (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = v.naam) = 1, ''
  from (values ('periode_overzicht'), ('sluit_periode_af'), ('streep_drank'), ('finalize_frituur_sessie')) v(naam)

  -- 8. Triggers bestaan
  union all
  select 8, 'Trigger ' || v.naam || ' op ' || v.tabel,
         exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
                 where c.relname = v.tabel and t.tgname = v.naam and not t.tgisinternal), ''
  from verwachte_triggers v

  -- 9. Opslagmappen: kastickets en bijlagen privé, profielfoto's publiek
  union all
  select 9, 'Opslag ' || b.id || (case when b.id = 'avatars' then ' (publiek)' else ' (privé)' end),
         exists (select 1 from storage.buckets s where s.id = b.id and s.public = (b.id = 'avatars')),
         coalesce((select case when s.public then 'staat publiek' else 'staat privé' end from storage.buckets s where s.id = b.id),
                  'bestaat niet')
  from (values ('receipts'), ('avatars'), ('bijlagen')) b(id)

  -- 10. Policies die voor ALLE opslagmappen gelden (zonder bucket_id) kunnen de regels openzetten
  union all
  select 10, 'Geen opslag-policies zonder bucket',
         not exists (
           select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and (coalesce(qual, '') || coalesce(with_check, '')) !~ 'bucket_id'),
         coalesce((
           select string_agg(policyname, ', ') from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and (coalesce(qual, '') || coalesce(with_check, '')) !~ 'bucket_id'), '')

  -- 11. Een open drankperiode
  union all
  select 11, 'Open drankperiode',
         exists (select 1 from public.billing_periods where not is_closed),
         coalesce((select naam from public.billing_periods where not is_closed order by start_datum desc limit 1), 'geen')

  -- 12. Herinnering om 18u ingepland (pg_cron)
  union all
  select 12, 'Agenda-herinnering ingepland (16u en 17u UTC)',
         coalesce((select schedule = '0 16,17 * * *' from cron.job where jobname = 'agenda-herinneringen'), false),
         coalesce((select schedule from cron.job where jobname = 'agenda-herinneringen'), 'niet ingepland (Cron aanzetten?)')
)
select nr, controle, ok, detail from controles order by ok, nr, controle;

-- Werkt stap 12 niet omdat pg_cron niet aan staat ("schema cron does not exist"),
-- verwijder dan die laatste union-blok (12) en zet Cron aan: Dashboard > Integrations > Cron.
