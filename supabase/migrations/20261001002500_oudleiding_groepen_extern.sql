-- =====================================================================
-- Oudleiding, leidingsgroep per werkjaar en friet voor externen
--
-- 1. Oudleiding: account zonder @ksa-aalter.be-mail (gebruikersnaam + wachtwoord). Ze registreren zelf
--    met een code die Drankteam instelt (via de edge function 'oudleiding'). Oudleiding ziet enkel:
--    strepen (ook de ranking), de eigen drankrekening (betalen met QR) en friet.
--    - is_leiding() = actieve leiding, ZONDER oudleiding (agenda, verslagen, polls, ... blijven voor leiding)
--    - is_lid()     = actieve leiding OF oudleiding (strepen, friet, eigen rekening, meldingen aan jezelf)
--    - Login: <gebruikersnaam>@oudleiding.ksa-aalter.be (enkel intern, er wordt nooit gemaild)
-- 2. Leidingsgroep: elke leider zit in precies één groep, opnieuw te kiezen elk werkjaar (vanaf 1 september).
-- 3. Friet voor iemand zonder account: naam ingeven; komt niet op een drankfactuur. Drankteam krijgt een
--    melding en houdt in een aparte lijst bij wie al betaald heeft.
-- Vereist: 20261001002400_financien.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Profielen
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists is_oudleiding boolean not null default false;
alter table public.profiles add column if not exists groep_werkjaar text; -- bv. '2026-2027': groep gekozen voor dat werkjaar

alter table public.profiles drop constraint if exists oudleiding_geen_hoofdleiding;
alter table public.profiles add constraint oudleiding_geen_hoofdleiding check (not (is_oudleiding and is_hoofdleiding));

alter table public.profiles drop constraint if exists check_email_domain;
alter table public.profiles add constraint check_email_domain check (
  lower(email) like '%@ksa-aalter.be'
  or lower(email) like '%@oudleiding.ksa-aalter.be'
  or lower(email) = 'it.takes.jaguarke@gmail.com'
);

-- Registreren: @ksa-aalter.be voor leiding. Een oudleidingsadres kan enkel via de edge function: die
-- controleert de code en zet het adres eerst in oudleiding_aanmeldingen (enkel de server kan daarin schrijven).
create table if not exists public.oudleiding_aanmeldingen (
  email text primary key,
  aangemaakt_op timestamptz not null default now()
);
alter table public.oudleiding_aanmeldingen enable row level security; -- geen policies: enkel de server
revoke all on public.oudleiding_aanmeldingen from anon, authenticated;
grant all on public.oudleiding_aanmeldingen to service_role;

create or replace function public.controleer_email_domein()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and lower(new.email) like '%@oudleiding.ksa-aalter.be' then
    delete from oudleiding_aanmeldingen
    where email = lower(new.email) and aangemaakt_op > now() - interval '5 minutes';
    if found then
      return new;
    end if;
    raise exception 'Oudleiding registreert met de code van Drankteam';
  end if;
  if new.email is null
     or (lower(new.email) not like '%@ksa-aalter.be' and lower(new.email) <> 'it.takes.jaguarke@gmail.com') then
    raise exception 'Registreren kan enkel met een @ksa-aalter.be-adres';
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, naam, email, rol, actief, is_oudleiding)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    'standaard',
    true,
    lower(new.email) like '%@oudleiding.ksa-aalter.be' -- kan enkel via de edge function (zie hierboven)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Oudleiding-status en actief: enkel hoofdleiding, of Drankteam via zet_oudleiding_actief()
create or replace function public.bescherm_profielvelden()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_hoofdleiding() then
    return new;
  end if;
  if current_setting('ksa.oudleiding_beheer', true) = 'aan' and old.is_oudleiding
     and new.is_oudleiding and new.is_hoofdleiding = old.is_hoofdleiding and new.email = old.email then
    return new;
  end if;
  if new.is_hoofdleiding is distinct from old.is_hoofdleiding
     or new.actief is distinct from old.actief
     or new.is_oudleiding is distinct from old.is_oudleiding
     or new.rol is distinct from old.rol
     or new.roles is distinct from old.roles
     or new.email is distinct from old.email then
    raise exception 'Enkel de hoofdleiding mag rollen, status of e-mail aanpassen';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Wie is leiding, wie is lid
-- ---------------------------------------------------------------------
create or replace function public.is_lid()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and actief);
$$;

create or replace function public.is_leiding()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and actief and not is_oudleiding);
$$;

create or replace function public.is_oudleiding()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and actief and is_oudleiding);
$$;

revoke all on function public.is_lid(), public.is_oudleiding() from public, anon;
grant execute on function public.is_lid(), public.is_oudleiding() to authenticated, service_role;

-- Werkgroeprechten gelden nooit voor oudleiding
create or replace function public.heeft_recht(p_recht text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_hoofdleiding() or exists (
    select 1
    from profiel_werkgroepen pw
    join werkgroepen w on w.id = pw.werkgroep_id
    join profiles p on p.id = pw.profile_id
    where pw.profile_id = auth.uid() and p.actief and not p.is_oudleiding and p_recht = any (w.rechten)
  );
$$;

-- Wat oudleiding ook mag: strepen, eigen rekening, friet, eigen meldingen, namen en profielfoto's zien
alter policy "leiding leest profielen" on public.profiles using (public.is_lid());
alter policy "leiding leest dranken" on public.dranken using (public.is_lid());
alter policy "leiding leest periodes" on public.billing_periods using (public.is_lid());
alter policy "leiding leest instellingen" on public.app_settings using (public.is_lid());
alter policy "leiding leest frietmenu" on public.frituur_items using (public.is_lid());
alter policy "leiding leest frietrondes" on public.frituur_sessies using (public.is_lid());
alter policy "leiding opent frietrondes" on public.frituur_sessies with check (public.is_lid());
alter policy "leiding werkt frietrondes bij" on public.frituur_sessies using (public.is_lid()) with check (public.is_lid());
alter policy "leiding leest frietbestellingen" on public.frituur_bestellingen using (public.is_lid());
alter policy "leiding bestelt friet" on public.frituur_bestellingen with check (public.is_lid());
alter policy "leiding werkt frietbestellingen bij" on public.frituur_bestellingen using (public.is_lid()) with check (public.is_lid());
alter policy "eigen gelezen-status zetten" on public.notificatie_gelezen
  with check (user_id = auth.uid() and public.is_lid());
-- Meldingen aan iedereen ('all') gaan over leidingszaken: niet voor oudleiding
alter policy "eigen of algemene meldingen lezen" on public.notificaties using (
  public.is_lid() and (
    ontvanger_id = auth.uid()::text or zender_id = auth.uid()
    or (ontvanger_id = 'all' and public.is_leiding())
  )
);
alter policy "leiding stuurt meldingen" on public.notificaties with check (
  zender_id = auth.uid() and public.is_lid()
  and (ontvanger_id <> 'all' or public.heeft_recht('berichten_sturen'))
);
alter policy "ontvanger markeert als gelezen" on public.notificaties
  using (public.is_lid() and ontvanger_id = auth.uid()::text)
  with check (public.is_lid() and ontvanger_id = auth.uid()::text);
alter policy "leiding bekijkt kastickets" on storage.objects using (bucket_id = 'receipts' and public.is_lid());
alter policy "leiding uploadt kastickets" on storage.objects with check (bucket_id = 'receipts' and public.is_lid());
alter policy "leiding vervangt kastickets" on storage.objects
  using (bucket_id = 'receipts' and public.is_lid()) with check (bucket_id = 'receipts' and public.is_lid());
alter policy "leiding ziet profielfotos" on storage.objects using (bucket_id = 'avatars' and public.is_lid());
alter policy "eigen profielfoto uploaden" on storage.objects
  with check (bucket_id = 'avatars' and name like auth.uid()::text || '-%' and public.is_lid());

-- Functies voor strepen, ranking, rekening en friet: ook voor oudleiding.
-- (De bestaande definitie wordt overgenomen; enkel is_leiding() wordt is_lid().)
do $$
declare
  f text;
  def text;
begin
  foreach f in array array['streep_drank', 'ranking_huidige_periode', 'periode_overzicht', 'financien_overzicht',
                           'finalize_frituur_sessie'] loop
    select pg_get_functiondef(p.oid) into def
    from pg_proc p where p.proname = f and p.pronamespace = 'public'::regnamespace;
    if def is null then
      raise exception 'Functie % niet gevonden', f;
    end if;
    if position('is_leiding()' in def) = 0 then
      raise exception 'Functie % gebruikt is_leiding() niet meer: migratie nakijken', f;
    end if;
    execute replace(def, 'is_leiding()', 'is_lid()');
  end loop;
end $$;

-- Berichten: 'alle' = alle leiding (zonder oudleiding); nieuw doel 'oudleiding'
create or replace function public.stuur_bericht(
  p_doel text, p_doel_id text, p_personen uuid[], p_titel text, p_bericht text, p_afzender_naam text
) returns integer language plpgsql security definer set search_path = public as $$
declare
  v_ontvangers uuid[];
  v_aantal integer;
begin
  if p_doel = 'open_factuur' then
    if not (public.heeft_recht('berichten_sturen') or public.heeft_recht('drank_beheren')) then
      raise exception 'Je hebt geen recht om deze berichten te sturen';
    end if;
  elsif not public.heeft_recht('berichten_sturen') then
    raise exception 'Je hebt geen recht om berichten te sturen';
  end if;

  if coalesce(trim(p_titel), '') = '' then
    raise exception 'Onderwerp ontbreekt';
  end if;

  select array_agg(distinct p.id) into v_ontvangers
  from profiles p
  where p.actief and p.id <> auth.uid() and (
       (p_doel = 'alle' and not p.is_oudleiding)
    or (p_doel = 'oudleiding' and p.is_oudleiding)
    or (p_doel = 'groep' and exists (select 1 from profiel_groepen pg where pg.profile_id = p.id and pg.groep_id::text = p_doel_id))
    or (p_doel = 'werkgroep' and exists (select 1 from profiel_werkgroepen pw where pw.profile_id = p.id and pw.werkgroep_id::text = p_doel_id))
    or (p_doel = 'personen' and p.id = any (p_personen))
    or (p_doel = 'open_factuur' and exists (select 1 from facturen f where f.user_id = p.id and f.status <> 'betaald'))
  );

  if v_ontvangers is null then
    return 0;
  end if;

  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type)
  select auth.uid(), o::text, p_titel, p_bericht, coalesce(p_afzender_naam, (select naam from profiles where id = auth.uid())), 'official'
  from unnest(v_ontvangers) o;

  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Oudleiding beheren (Drankteam + hoofdleiding)
-- ---------------------------------------------------------------------
create table if not exists public.oudleiding_instellingen (
  id integer primary key default 1 check (id = 1),
  code text check (code is null or length(trim(code)) >= 6), -- leeg = registreren voor oudleiding staat uit
  code_gewijzigd_op timestamptz,
  mislukt integer not null default 0,     -- foute codes sinds mislukt_sinds (tegen gokken)
  mislukt_sinds timestamptz
);
insert into public.oudleiding_instellingen (id) values (1) on conflict (id) do nothing;
alter table public.oudleiding_instellingen enable row level security;
create policy "drankteam leest oudleidingscode" on public.oudleiding_instellingen for select
  using (public.heeft_recht('drank_beheren'));
revoke all on public.oudleiding_instellingen from anon, authenticated;
grant select on public.oudleiding_instellingen to authenticated;
grant all on public.oudleiding_instellingen to service_role;

create or replace function public.zet_oudleidingscode(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.heeft_recht('drank_beheren') then
    raise exception 'Enkel Drankteam en hoofdleiding';
  end if;
  if p_code is not null and length(trim(p_code)) < 6 then
    raise exception 'De code moet minstens 6 tekens lang zijn';
  end if;
  update oudleiding_instellingen
  set code = nullif(trim(p_code), ''), code_gewijzigd_op = now(), mislukt = 0, mislukt_sinds = null
  where id = 1;
end;
$$;

-- Enkel voor de edge function: klopt de code? Na 10 foute pogingen binnen het uur: een uur geblokkeerd.
create or replace function public.oudleidingscode_klopt(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  r oudleiding_instellingen%rowtype;
begin
  select * into r from oudleiding_instellingen where id = 1 for update;
  if r.mislukt_sinds is not null and r.mislukt_sinds < now() - interval '1 hour' then
    update oudleiding_instellingen set mislukt = 0, mislukt_sinds = null where id = 1;
    r.mislukt := 0;
  end if;
  if r.mislukt >= 10 then
    return 'geblokkeerd';
  end if;
  if r.code is null then
    return 'uit';
  end if;
  if trim(p_code) = r.code then
    return 'ok';
  end if;
  update oudleiding_instellingen
  set mislukt = mislukt + 1, mislukt_sinds = coalesce(mislukt_sinds, now())
  where id = 1;
  return 'fout';
end;
$$;

-- Drankteam zet een oudleider (de)actief (hoofdleiding kan dat al via het rollenscherm)
create or replace function public.zet_oudleiding_actief(p_user_id uuid, p_actief boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.heeft_recht('drank_beheren') then
    raise exception 'Enkel Drankteam en hoofdleiding';
  end if;
  if not exists (select 1 from profiles where id = p_user_id and is_oudleiding) then
    raise exception 'Dit is geen oudleiding';
  end if;
  perform set_config('ksa.oudleiding_beheer', 'aan', true);
  update profiles set actief = p_actief where id = p_user_id;
  perform set_config('ksa.oudleiding_beheer', '', true);
end;
$$;

revoke all on function public.zet_oudleidingscode(text), public.zet_oudleiding_actief(uuid, boolean),
  public.oudleidingscode_klopt(text) from public, anon, authenticated;
grant execute on function public.zet_oudleidingscode(text), public.zet_oudleiding_actief(uuid, boolean) to authenticated;
grant execute on function public.oudleidingscode_klopt(text) to service_role;

-- ---------------------------------------------------------------------
-- 4. Leidingsgroep per werkjaar (vanaf 1 september)
-- ---------------------------------------------------------------------
create or replace function public.groep_werkjaar(p_dag date default (now() at time zone 'Europe/Brussels')::date)
returns text language sql immutable as $$
  select case when extract(month from p_dag) >= 9
    then extract(year from p_dag)::int || '-' || (extract(year from p_dag)::int + 1)
    else (extract(year from p_dag)::int - 1) || '-' || extract(year from p_dag)::int
  end;
$$;

-- Leider kiest zelf zijn groep voor dit werkjaar: precies één
create or replace function public.kies_groep(p_groep_id integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_leiding() then
    raise exception 'Enkel leiding kiest een groep';
  end if;
  if not exists (select 1 from groepen where id = p_groep_id) then
    raise exception 'Onbekende groep';
  end if;
  delete from profiel_groepen where profile_id = auth.uid();
  insert into profiel_groepen (profile_id, groep_id) values (auth.uid(), p_groep_id);
  update profiles set groep_werkjaar = public.groep_werkjaar() where id = auth.uid();
end;
$$;
revoke all on function public.kies_groep(integer) from public, anon;
grant execute on function public.kies_groep(integer) to authenticated;
grant execute on function public.groep_werkjaar(date) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Friet voor iemand zonder account
-- ---------------------------------------------------------------------
alter table public.frituur_bestellingen alter column user_id drop not null;
alter table public.frituur_bestellingen add column if not exists extern_naam text;
alter table public.frituur_bestellingen add column if not exists extern_betaald boolean not null default false;
alter table public.frituur_bestellingen add column if not exists extern_betaald_op timestamptz;
alter table public.frituur_bestellingen drop constraint if exists leider_of_extern;
alter table public.frituur_bestellingen add constraint leider_of_extern check (
  (user_id is not null and extern_naam is null)
  or (user_id is null and length(trim(coalesce(extern_naam, ''))) > 0)
);

-- Gewone leiding: geen factuur, periode of betaald-status van externen aanpassen
create or replace function public.bescherm_frietbestelling()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.heeft_recht('drank_beheren') then
    if tg_op = 'UPDATE' and new.extern_betaald is distinct from old.extern_betaald then
      new.extern_betaald_op := case when new.extern_betaald then now() end;
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.factuur_id := null;
    new.besteld_door := auth.uid();
    new.extern_betaald := false;
    new.extern_betaald_op := null;
    if new.extern_naam is not null then
      new.period_id := null; -- externen komen nooit op een drankfactuur
    end if;
    return new;
  end if;
  new.user_id := old.user_id;
  new.factuur_id := old.factuur_id;
  new.period_id := old.period_id;
  new.sessie_id := old.sessie_id;
  new.besteld_door := old.besteld_door;
  new.extern_naam := old.extern_naam;
  new.extern_betaald := old.extern_betaald;
  new.extern_betaald_op := old.extern_betaald_op;
  return new;
end;
$$;

-- Meldingen "in jouw naam" / "geannuleerd" enkel voor wie een account heeft
create or replace function public.melding_friet_voor_ander()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_besteller text;
  v_items text;
begin
  if auth.uid() is null or new.user_id is null or new.user_id = auth.uid() then
    return new;
  end if;

  select coalesce(nullif(nickname, ''), naam) into v_besteller from profiles where id = auth.uid();

  select string_agg(coalesce(i->>'quantity', '1') || 'x ' || coalesce(i->>'name', '?'), ', ')
  into v_items
  from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) i;

  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
  values (
    auth.uid(),
    new.user_id::text,
    '🍟 Frietbestelling in jouw naam',
    coalesce(v_besteller, 'Iemand') || ' heeft friet besteld in jouw naam: '
      || coalesce(nullif(v_items, ''), new.snack_naam, 'bestelling')
      || ' (€' || replace(to_char(coalesce(new.totaal_prijs, 0), 'FM999990.00'), '.', ',') || ').'
      || ' Het bedrag komt op je drankfactuur.',
    coalesce(v_besteller, 'Friet'),
    'order',
    'Bekijken|/frituur'
  );
  return new;
end;
$$;

create or replace function public.melding_friet_geannuleerd()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_door text;
  v_items text;
begin
  if auth.uid() is null or old.user_id is null or old.user_id = auth.uid() then
    return old;
  end if;

  select coalesce(nullif(nickname, ''), naam) into v_door from profiles where id = auth.uid();

  select string_agg(coalesce(i->>'quantity', '1') || 'x ' || coalesce(i->>'name', '?'), ', ')
  into v_items
  from jsonb_array_elements(coalesce(old.items, '[]'::jsonb)) i;

  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
  values (
    auth.uid(),
    old.user_id::text,
    '🍟 Frietbestelling geannuleerd',
    coalesce(v_door, 'Iemand') || ' heeft je frietbestelling geannuleerd: '
      || coalesce(nullif(v_items, ''), old.snack_naam, 'bestelling')
      || ' (€' || replace(to_char(coalesce(old.totaal_prijs, 0), 'FM999990.00'), '.', ',') || ').'
      || ' Dit komt niet op je drankfactuur.',
    coalesce(v_door, 'Friet'),
    'order',
    'Bekijken|/frituur'
  );
  return old;
end;
$$;

-- Drankteam krijgt een melding bij elke bestelling voor iemand zonder account
create or replace function public.melding_friet_extern()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_besteller text;
  v_items text;
begin
  if new.user_id is not null then
    return new;
  end if;

  select coalesce(nullif(nickname, ''), naam) into v_besteller from profiles where id = new.besteld_door;

  select string_agg(coalesce(i->>'quantity', '1') || 'x ' || coalesce(i->>'name', '?'), ', ')
  into v_items
  from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) i;

  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
  select
    new.besteld_door,
    p.id::text,
    '🍟 Friet voor ' || new.extern_naam || ' (zonder account)',
    coalesce(v_besteller, 'Iemand') || ' bestelde friet voor ' || new.extern_naam || ': '
      || coalesce(nullif(v_items, ''), new.snack_naam, 'bestelling')
      || ' (€' || replace(to_char(coalesce(new.totaal_prijs, 0), 'FM999990.00'), '.', ',') || ').'
      || ' Dit komt op niemands drankfactuur: zie Friet beheer > Zonder account.',
    coalesce(v_besteller, 'Friet'),
    'order',
    'Bekijken|/team-drank/frieten'
  from profiles p
  where p.actief and not p.is_oudleiding and p.id is distinct from new.besteld_door
    and exists (
      select 1 from profiel_werkgroepen pw join werkgroepen w on w.id = pw.werkgroep_id
      where pw.profile_id = p.id and 'drank_beheren' = any (w.rechten)
    );
  return new;
end;
$$;

drop trigger if exists melding_friet_extern on public.frituur_bestellingen;
create trigger melding_friet_extern
  after insert on public.frituur_bestellingen
  for each row execute function public.melding_friet_extern();

revoke all on function public.melding_friet_extern() from public, anon, authenticated;

commit;
