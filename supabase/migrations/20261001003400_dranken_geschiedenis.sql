-- =====================================================================
-- Dranken en geschiedenis blijven altijd bewaard
--
-- Tijdelijke dranken
--  1. Blijven voor altijd in de database: nooit te verwijderen (ook niet door Drankteam).
--  2. Elke tijdelijke drank is een aparte drank (eigen id, prijs en tijdslot); dezelfde naam mag opnieuw.
--  3. Tijdslot met datum en uur: geldig_van -> geldig_tot.
--  4. Gewone leiding streept enkel binnen het tijdslot (afgedwongen in streep_drank);
--     Drankteam/hoofdleiding altijd.
-- Vaste dranken
--  5. Naam blijft uniek (de app zoekt bv. "Freedom" en "Bak Freedom" op naam).
--  6. Een vaste drank met strepen kan niet verwijderd worden; "uit de lijst halen" (uit_lijst) kan wel.
-- Geschiedenis
--  7. Een frietronde met bestellingen en een account met strepen, friet, facturen, correcties of
--     betalingen kunnen niet verwijderd worden (account: op inactief zetten).
-- De prijs van een streep ligt vast bij het strepen (consumptie_zet_prijs, bestond al).
-- Oude app-versies gebruiken nog valid_until (datum): blijft gelijklopend met geldig_tot.
-- Vereist: 20261001002300_streep_open_periode_en_meldingen.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Tijdslot en "uit de lijst"
-- ---------------------------------------------------------------------
alter table public.dranken add column if not exists geldig_van timestamptz;
alter table public.dranken add column if not exists geldig_tot timestamptz;
alter table public.dranken add column if not exists uit_lijst boolean not null default false;

-- Bestaande tijdelijke dranken: van hun aanmaakmoment tot het einde van hun einddatum (Belgische tijd)
update public.dranken
set geldig_van = coalesce(geldig_van, created_at),
    geldig_tot = coalesce(geldig_tot, ((coalesce(valid_until, created_at::date) + 1)::timestamp at time zone 'Europe/Brussels'))
where is_temporary;

-- Tijdslot invullen en controleren; valid_until (oude app-versies) gelijk houden
create or replace function public.drank_tijdslot()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.is_temporary is distinct from old.is_temporary and auth.uid() is not null then
    raise exception 'Een drank kan niet van tijdelijk naar vast (of omgekeerd). Maak een nieuwe drank.';
  end if;

  if new.is_temporary then
    -- Oude app-versie: enkel valid_until (datum) meegegeven
    if new.geldig_tot is null and new.valid_until is not null then
      new.geldig_tot := (new.valid_until + 1)::timestamp at time zone 'Europe/Brussels';
    end if;
    new.geldig_van := coalesce(new.geldig_van, now());
    if new.geldig_tot is null or new.geldig_tot <= new.geldig_van then
      raise exception 'Het einde van het tijdslot moet na het begin liggen';
    end if;
    new.valid_until := ((new.geldig_tot - interval '1 second') at time zone 'Europe/Brussels')::date;
  else
    new.geldig_van := null;
    new.geldig_tot := null;
    new.valid_until := null;
  end if;
  return new;
end;
$$;
drop trigger if exists drank_tijdslot on public.dranken;
create trigger drank_tijdslot before insert or update on public.dranken
  for each row execute function public.drank_tijdslot();

-- ---------------------------------------------------------------------
-- 2. Naam: uniek bij vaste dranken, vrij bij tijdelijke
-- ---------------------------------------------------------------------
alter table public.dranken drop constraint if exists dranken_naam_key;
create unique index if not exists dranken_vaste_naam_uniek on public.dranken (lower(naam)) where not is_temporary;

-- ---------------------------------------------------------------------
-- 3. Niet verwijderen wat geschiedenis heeft
-- ---------------------------------------------------------------------
alter table public.consumpties drop constraint if exists consumpties_drank_id_fkey;
alter table public.consumpties add constraint consumpties_drank_id_fkey
  foreign key (drank_id) references public.dranken(id) on delete restrict;

alter table public.frituur_bestellingen drop constraint if exists frituur_bestellingen_sessie_id_fkey;
alter table public.frituur_bestellingen add constraint frituur_bestellingen_sessie_id_fkey
  foreign key (sessie_id) references public.frituur_sessies(id) on delete restrict;

alter table public.consumpties drop constraint if exists consumpties_user_id_fkey;
alter table public.consumpties add constraint consumpties_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete restrict;
alter table public.frituur_bestellingen drop constraint if exists frituur_bestellingen_user_id_fkey;
alter table public.frituur_bestellingen add constraint frituur_bestellingen_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete restrict;
alter table public.facturen drop constraint if exists facturen_user_id_fkey;
alter table public.facturen add constraint facturen_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete restrict;
alter table public.billing_corrections drop constraint if exists billing_corrections_user_id_fkey;
alter table public.billing_corrections add constraint billing_corrections_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete restrict;
alter table public.betaling_posten drop constraint if exists betaling_posten_user_id_fkey;
alter table public.betaling_posten add constraint betaling_posten_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete restrict;

-- Bestaande bescherming van Freedom/Bak Freedom: gaf bij DELETE "new" (null) terug, waardoor elk
-- verwijderen van een drank stil geannuleerd werd. Nu "old" bij DELETE.
create or replace function public.protect_freedom_logic()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and old.naam in ('Freedom', 'Bak Freedom') and not old.is_temporary then
    raise exception 'Systeem-kritieke drank % kan niet worden verwijderd.', old.naam;
  end if;
  if tg_op = 'UPDATE' and old.naam in ('Freedom', 'Bak Freedom') and not old.is_temporary and new.naam <> old.naam then
    raise exception 'De naam van % mag niet gewijzigd worden.', old.naam;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Duidelijke meldingen i.p.v. een technische fout
create or replace function public.bewaar_drank()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_temporary then
    raise exception 'Tijdelijke dranken blijven altijd bewaard en kunnen niet verwijderd worden.';
  end if;
  if exists (select 1 from consumpties where drank_id = old.id) then
    raise exception 'Deze drank heeft al strepen. Haal hem uit de lijst in plaats van hem te verwijderen.';
  end if;
  return old;
end;
$$;
drop trigger if exists bewaar_drank on public.dranken;
create trigger bewaar_drank before delete on public.dranken
  for each row execute function public.bewaar_drank();

create or replace function public.bewaar_frietronde()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from frituur_bestellingen where sessie_id = old.id) then
    raise exception 'Deze frietronde heeft bestellingen en kan niet verwijderd worden.';
  end if;
  return old;
end;
$$;
drop trigger if exists bewaar_frietronde on public.frituur_sessies;
create trigger bewaar_frietronde before delete on public.frituur_sessies
  for each row execute function public.bewaar_frietronde();

create or replace function public.bewaar_account()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from consumpties where user_id = old.id)
     or exists (select 1 from frituur_bestellingen where user_id = old.id)
     or exists (select 1 from facturen where user_id = old.id)
     or exists (select 1 from billing_corrections where user_id = old.id)
     or exists (select 1 from betaling_posten where user_id = old.id) then
    raise exception 'Dit account heeft strepen, friet, facturen of betalingen. Zet het op inactief in plaats van het te verwijderen.';
  end if;
  return old;
end;
$$;
drop trigger if exists bewaar_account on public.profiles;
create trigger bewaar_account before delete on public.profiles
  for each row execute function public.bewaar_account();

revoke all on function public.drank_tijdslot(), public.bewaar_drank(), public.bewaar_frietronde(), public.bewaar_account()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Strepen: gewone leiding enkel op beschikbare dranken
-- ---------------------------------------------------------------------
create or replace function public.streep_drank(p_user_id uuid, p_drank_id uuid, p_aantal integer default 1, p_period_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_naam text;
  v_period uuid;
  v_drank dranken%rowtype;
begin
  if not public.is_lid() then
    raise exception 'Niet ingelogd als actieve leiding';
  end if;
  if p_user_id <> auth.uid() and not public.heeft_recht('drank_beheren') then
    raise exception 'Enkel Drankteam mag strepen zetten voor anderen';
  end if;
  if p_aantal is null or p_aantal < 1 then
    raise exception 'Ongeldig aantal';
  end if;

  select * into v_drank from dranken where id = p_drank_id;
  if v_drank.id is null then
    raise exception 'Onbekende drank';
  end if;
  -- Drankteam (en hoofdleiding) mag altijd; gewone leiding enkel op wat nu beschikbaar is
  if not public.heeft_recht('drank_beheren') then
    if v_drank.uit_lijst then
      raise exception '% staat niet meer in de lijst', v_drank.naam;
    end if;
    if v_drank.is_temporary and (now() < v_drank.geldig_van or now() >= v_drank.geldig_tot) then
      raise exception '% kan je enkel strepen van % tot %', v_drank.naam,
        to_char(v_drank.geldig_van at time zone 'Europe/Brussels', 'DD/MM HH24:MI'),
        to_char(v_drank.geldig_tot at time zone 'Europe/Brussels', 'DD/MM HH24:MI');
    end if;
  end if;

  select naam into v_naam from profiles where id = p_user_id and actief;
  if v_naam is null then
    raise exception 'Onbekende of inactieve leider';
  end if;

  -- Een meegegeven periode telt enkel als ze nog open is; anders de open periode
  select id into v_period from billing_periods where id = p_period_id and not is_closed;
  if v_period is null then
    select id into v_period from billing_periods where not is_closed order by start_datum desc limit 1;
  end if;
  if v_period is null then
    raise exception 'Er staat geen drankperiode open';
  end if;

  insert into consumpties (user_id, drank_id, aantal, period_id, user_naam)
  values (p_user_id, p_drank_id, p_aantal, v_period, v_naam)
  returning id into v_id;

  return v_id;
end;
$$;

commit;
