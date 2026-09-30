-- =====================================================================
-- Beveiliging: gaten dichten uit de security-controle
--
-- 1. Anoniem (niet ingelogd) kan niets meer in de database. De anon key zit in de app (dat is normaal),
--    maar de app vraagt pas iets na het inloggen. Oude tabellen buiten de MVP (quotes, bierpong,
--    winkeltje, ...) waren mogelijk nog open voor iedereen met de anon key.
-- 2. Tabellen zonder RLS krijgen RLS: leiding leest, hoofdleiding schrijft (winkeltje: winkeltje_beheren).
-- 3. Strepen: gewone leiding strept enkel via streep_drank() (die controleert alles). Rechtstreeks
--    inserten kon met een eigen prijs (bv. 0) of een negatief aantal.
-- 4. Frietbestellingen: gewone leiding kon een bestelling op iemand anders zetten (user_id aanpassen),
--    of ze aan een factuur koppelen zodat ze nooit gefactureerd werd.
-- 5. Meldingen: de afzendernaam van een melding kon vrij gekozen worden (bv. "Hoofdleiding").
-- 6. Polls: de maker kon gemaakt_door van een poll veranderen.
-- Vereist: alle vorige migraties.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Niets voor anoniem (ook niet voor nieuwe tabellen en functies)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- ---------------------------------------------------------------------
-- 2. RLS aan op tabellen die het nog niet hadden
-- ---------------------------------------------------------------------
-- Oude policies op zo'n tabel golden niet (RLS stond uit); ze worden eerst verwijderd,
-- anders zou bv. een oude "iedereen mag alles"-policy plots meetellen.
do $$
declare
  t record;
  pol record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t.relname loop
      execute format('drop policy %I on public.%I', pol.policyname, t.relname);
    end loop;
    execute format('alter table public.%I enable row level security', t.relname);
    execute format('create policy "leiding leest" on public.%I for select using (public.is_leiding())', t.relname);
    if t.relname like 'shop\_%' then
      execute format(
        'create policy "winkeltje beheert" on public.%I for all using (public.heeft_recht(''winkeltje_beheren'')) with check (public.heeft_recht(''winkeltje_beheren''))',
        t.relname);
    else
      execute format(
        'create policy "hoofdleiding beheert" on public.%I for all using (public.is_hoofdleiding()) with check (public.is_hoofdleiding())',
        t.relname);
    end if;
    raise notice 'RLS aangezet op %', t.relname;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Strepen: enkel via streep_drank() (security definer, met alle controles); Drankteam mag rechtstreeks
-- ---------------------------------------------------------------------
drop policy if exists "zelf strepen of drankteam voor anderen" on public.consumpties;
create policy "drankteam zet strepen rechtstreeks" on public.consumpties for insert
  with check (public.heeft_recht('drank_beheren'));

-- ---------------------------------------------------------------------
-- 4. Frietbestellingen: wie, welke ronde en welke factuur liggen vast voor gewone leiding
-- ---------------------------------------------------------------------
create or replace function public.bescherm_frietbestelling()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.heeft_recht('drank_beheren') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.factuur_id := null;
    return new;
  end if;
  new.user_id := old.user_id;
  new.factuur_id := old.factuur_id;
  new.period_id := old.period_id;
  new.sessie_id := old.sessie_id;
  return new;
end;
$$;

drop trigger if exists bescherm_frietbestelling on public.frituur_bestellingen;
create trigger bescherm_frietbestelling
  before insert or update on public.frituur_bestellingen
  for each row execute function public.bescherm_frietbestelling();

-- ---------------------------------------------------------------------
-- 5. Meldingen: bij een rechtstreekse insert vanuit de app is de afzendernaam altijd je eigen naam.
--    (Meldingen vanuit databasefuncties, bv. "Agenda" of stuur_bericht, draaien als eigenaar en blijven vrij.)
-- ---------------------------------------------------------------------
create or replace function public.melding_echte_afzender()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    new.zender_naam := (select coalesce(nullif(nickname, ''), naam) from public.profiles where id = auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists melding_echte_afzender on public.notificaties;
create trigger melding_echte_afzender
  before insert on public.notificaties
  for each row execute function public.melding_echte_afzender();

-- Ontvanger mag enkel markeren als gelezen, niet de inhoud aanpassen
revoke update on public.notificaties from authenticated;
grant update (gelezen) on public.notificaties to authenticated;

-- ---------------------------------------------------------------------
-- 6. Polls: gemaakt_door kan niet veranderen
-- ---------------------------------------------------------------------
drop policy if exists "maker of hoofdleiding past poll aan" on public.polls;
create policy "maker of hoofdleiding past poll aan" on public.polls for update
  using (gemaakt_door = auth.uid() or public.is_hoofdleiding())
  with check (gemaakt_door = auth.uid() or public.is_hoofdleiding());

commit;
