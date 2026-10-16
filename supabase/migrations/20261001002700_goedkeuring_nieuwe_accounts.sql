-- =====================================================================
-- Nieuwe accounts goedkeuren (i.p.v. een bevestigingsmail)
--
-- 1. Wie registreert met een @ksa-aalter.be-adres, start inactief met goedkeuring = 'wacht'.
--    Inactief = geen toegang tot iets (is_leiding()/is_lid() zijn false); de app toont een wachtscherm.
-- 2. Alle actieve leiding krijgt een melding (en push) en in de app een pop-up die niet weg kan:
--    voornaam, achternaam, e-mail en "Is/wordt deze persoon leiding?" -> accepteren of afwijzen.
--    De eerste die beslist, beslist. Afgewezen accounts blijven inactief.
-- 3. Oudleiding registreert met de code van Drankteam en blijft meteen actief (zoals voorheen).
-- Bestaande accounts krijgen goedkeuring = 'goedgekeurd'; er verandert niets aan hun toegang.
-- Vereist: 20261001002500_oudleiding_groepen_extern.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Kolommen
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists goedkeuring text not null default 'goedgekeurd';
alter table public.profiles drop constraint if exists goedkeuring_geldig;
alter table public.profiles add constraint goedkeuring_geldig check (goedkeuring in ('wacht', 'goedgekeurd', 'afgewezen'));
alter table public.profiles add column if not exists voornaam text;
alter table public.profiles add column if not exists achternaam text;

-- ---------------------------------------------------------------------
-- 2. Nieuw profiel bij registreren
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_oud boolean := lower(new.email) like '%@oudleiding.ksa-aalter.be'; -- kan enkel via de edge function
  v_voornaam text := nullif(trim(new.raw_user_meta_data->>'voornaam'), '');
  v_achternaam text := nullif(trim(new.raw_user_meta_data->>'achternaam'), '');
  v_naam text;
begin
  v_naam := coalesce(
    nullif(trim(concat_ws(' ', v_voornaam, v_achternaam)), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, naam, voornaam, achternaam, email, rol, actief, is_oudleiding, goedkeuring)
  values (
    new.id, v_naam, v_voornaam, v_achternaam, new.email, 'standaard',
    v_oud,                                             -- leiding wacht op goedkeuring, oudleiding niet
    v_oud,
    case when v_oud then 'goedgekeurd' else 'wacht' end
  )
  on conflict (id) do nothing;

  if not v_oud and found then
    insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
    values (
      null, 'all',
      'Nieuw account wacht op goedkeuring',
      v_naam || ' (' || new.email || ') wil een account. Open de app om te accepteren of af te wijzen.',
      'KSA app', 'official', 'Bekijken|/'
    );
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Goedkeuring mag de status aanpassen (anders enkel hoofdleiding)
-- ---------------------------------------------------------------------
create or replace function public.bescherm_profielvelden()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_hoofdleiding() then
    return new;
  end if;
  -- beoordeel_account(): enkel actief en goedkeuring van een wachtend account
  if current_setting('ksa.goedkeuring', true) = 'aan' and old.goedkeuring = 'wacht'
     and new.is_hoofdleiding = old.is_hoofdleiding and new.is_oudleiding = old.is_oudleiding
     and new.rol is not distinct from old.rol and new.roles is not distinct from old.roles
     and new.email = old.email then
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
     or new.email is distinct from old.email
     or new.goedkeuring is distinct from old.goedkeuring then
    raise exception 'Enkel de hoofdleiding mag rollen, status of e-mail aanpassen';
  end if;
  return new;
end;
$$;

-- Hoofdleiding die iemand later (de)activeert in Rollen: een wachtend account telt dan als beslist
create or replace function public.goedkeuring_bij_activeren()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.actief and not old.actief and new.goedkeuring <> 'goedgekeurd' then
    new.goedkeuring := 'goedgekeurd';
  end if;
  return new;
end;
$$;
drop trigger if exists goedkeuring_bij_activeren on public.profiles;
create trigger goedkeuring_bij_activeren before update of actief on public.profiles
  for each row execute function public.goedkeuring_bij_activeren();

-- ---------------------------------------------------------------------
-- 4. Functies voor de app
-- ---------------------------------------------------------------------
-- Alle accounts die wachten (enkel voor actieve leiding, niet voor oudleiding)
create or replace function public.wachtende_accounts()
returns table (id uuid, voornaam text, achternaam text, naam text, email text, aangemaakt_op timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.voornaam, p.achternaam, p.naam, p.email, u.created_at
  from profiles p
  join auth.users u on u.id = p.id
  where p.goedkeuring = 'wacht' and public.is_leiding()
  order by u.created_at;
$$;

-- Accepteren of afwijzen. Geeft de status terug; was iemand anders sneller, dan diens beslissing.
create or replace function public.beoordeel_account(p_id uuid, p_goedkeuren boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_naam text;
  v_door text;
begin
  if not public.is_leiding() then
    raise exception 'Enkel actieve leiding kan nieuwe accounts goedkeuren';
  end if;

  select goedkeuring, naam into v_status, v_naam from profiles where id = p_id for update;
  if v_status is null then
    raise exception 'Account niet gevonden';
  end if;
  if v_status <> 'wacht' then
    return v_status;
  end if;

  perform set_config('ksa.goedkeuring', 'aan', true);
  update profiles
  set goedkeuring = case when p_goedkeuren then 'goedgekeurd' else 'afgewezen' end,
      actief = p_goedkeuren
  where id = p_id;
  perform set_config('ksa.goedkeuring', '', true);

  select coalesce(nullif(nickname, ''), naam) into v_door from profiles where id = auth.uid();
  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
  values (
    auth.uid(), 'all',
    case when p_goedkeuren then 'Nieuw account goedgekeurd' else 'Nieuw account afgewezen' end,
    coalesce(v_door, 'Iemand') || case when p_goedkeuren then ' keurde ' else ' wees ' end
      || coalesce(v_naam, 'een account') || case when p_goedkeuren then ' goed.' else ' af.' end,
    coalesce(v_door, 'KSA app'), 'official', 'Bekijken|/'
  );

  return case when p_goedkeuren then 'goedgekeurd' else 'afgewezen' end;
end;
$$;

-- Eigen status (ook als je nog niet actief bent en dus geen profielen mag lezen)
create or replace function public.mijn_goedkeuring()
returns text language sql stable security definer set search_path = public as $$
  select goedkeuring from profiles where id = auth.uid();
$$;

revoke all on function public.wachtende_accounts(), public.beoordeel_account(uuid, boolean), public.mijn_goedkeuring()
  from public, anon;
grant execute on function public.wachtende_accounts(), public.beoordeel_account(uuid, boolean), public.mijn_goedkeuring()
  to authenticated;
revoke all on function public.goedkeuring_bij_activeren() from public, anon, authenticated;

commit;
