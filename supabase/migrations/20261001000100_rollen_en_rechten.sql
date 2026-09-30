-- =====================================================================
-- Rollen en rechten (CLAUDE.md: Gebruikers, groepen en rollen)
--  - 7 vaste groepen
--  - werkgroepen die de hoofdleiding zelf aanmaakt, met rechten per werkgroep
--  - meerdere groepen/werkgroepen per persoon
--  - hoofdleiding = admin
--  - registratie enkel met @ksa-aalter.be (+ het testaccount), server-side
-- Bestaande rollen (profiles.rol en profiles.roles) worden omgezet.
-- De oude kolommen blijven voorlopig bestaan; ze worden niet meer gebruikt.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Tabellen
-- ---------------------------------------------------------------------

create table if not exists public.groepen (
  id smallint primary key,
  naam text not null unique,
  volgorde smallint not null
);

insert into public.groepen (id, naam, volgorde) values
  (1, 'Pagadders', 1),
  (2, 'Kabouters', 2),
  (3, 'Sloebers', 3),
  (4, 'Tieners', 4),
  (5, 'Jim', 5),
  (6, 'Sim', 6),
  (7, 'Kim', 7)
on conflict (id) do nothing;

create table if not exists public.werkgroepen (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique,
  rechten text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint werkgroepen_geldige_rechten check (
    rechten <@ array['agenda_beheren', 'drank_beheren', 'berichten_sturen', 'polls_maken', 'financien', 'winkeltje_beheren']::text[]
  )
);

create table if not exists public.profiel_groepen (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  groep_id smallint not null references public.groepen(id) on delete cascade,
  primary key (profile_id, groep_id)
);

create table if not exists public.profiel_werkgroepen (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  werkgroep_id uuid not null references public.werkgroepen(id) on delete cascade,
  primary key (profile_id, werkgroep_id)
);

alter table public.profiles add column if not exists is_hoofdleiding boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. Hulpfuncties voor RLS (security definer: omzeilen RLS, geen recursie)
-- ---------------------------------------------------------------------

-- Is de ingelogde gebruiker actieve leiding?
create or replace function public.is_leiding()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and actief);
$$;

create or replace function public.is_hoofdleiding()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and actief and is_hoofdleiding);
$$;

-- Hoofdleiding heeft alle rechten; anderen via hun werkgroepen
create or replace function public.heeft_recht(p_recht text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_hoofdleiding() or exists (
    select 1
    from profiel_werkgroepen pw
    join werkgroepen w on w.id = pw.werkgroep_id
    join profiles p on p.id = pw.profile_id
    where pw.profile_id = auth.uid() and p.actief and p_recht = any (w.rechten)
  );
$$;

grant execute on function public.is_leiding(), public.is_hoofdleiding(), public.heeft_recht(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Bestaande rollen omzetten
-- ---------------------------------------------------------------------

-- 3a. Hoofdleiding: oude rol admin/godmode/hoofdleiding of label 'Hoofdleiding'
update public.profiles p
set is_hoofdleiding = true
where p.rol::text in ('admin', 'godmode', 'hoofdleiding')
   or exists (
     select 1 from unnest(coalesce(p.roles, '{}')) r
     where lower(trim(r)) in ('hoofdleiding', 'admin', 'godmode')
   );

-- 3b. Groepen uit de labels
insert into public.profiel_groepen (profile_id, groep_id)
select p.id, g.id
from public.profiles p
cross join lateral unnest(coalesce(p.roles, '{}')) r
join public.groepen g on lower(g.naam) = lower(trim(r))
on conflict do nothing;

-- 3c. Werkgroepen uit de overige labels en uit de oude rol-kolom.
--     Bekende labels krijgen het bijhorende recht; andere labels worden een werkgroep zonder rechten.
with labels as (
  select distinct p.id as profile_id, lower(trim(r)) as label
  from public.profiles p
  cross join lateral unnest(coalesce(p.roles, '{}')) r
  union
  select p.id, lower(p.rol::text)
  from public.profiles p
  where p.rol::text in ('team_drank', 'team drank', 'sfeerbeheer')
),
gemapt as (
  select profile_id,
    case
      when label in ('drank', 'team drank', 'team_drank', 'drankteam') then 'Drankteam'
      when label = 'sfeerbeheer' then 'Sfeerbeheer'
      when label in ('financiën', 'financien') then 'Financiën'
      when label = 'winkeltje' then 'Winkeltje'
      else initcap(label)
    end as naam,
    case
      when label in ('drank', 'team drank', 'team_drank', 'drankteam') then array['drank_beheren']
      when label = 'sfeerbeheer' then array['agenda_beheren']
      when label in ('financiën', 'financien') then array['financien']
      when label = 'winkeltje' then array['winkeltje_beheren']
      else array[]::text[]
    end as rechten
  from labels
  where label <> ''
    and label not in ('hoofdleiding', 'admin', 'godmode', 'standaard')
    and label not in (select lower(naam) from public.groepen)
)
, nieuwe as (
  insert into public.werkgroepen (naam, rechten)
  select distinct on (naam) naam, rechten from gemapt
  on conflict (naam) do nothing
  returning id, naam
)
insert into public.profiel_werkgroepen (profile_id, werkgroep_id)
select g.profile_id, w.id
from gemapt g
join (select id, naam from nieuwe union select id, naam from public.werkgroepen) w on w.naam = g.naam
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 4. Gevoelige profielvelden beschermen
--    Leiding mag het eigen profiel aanpassen, maar niet is_hoofdleiding/actief/rol/roles.
--    Enkel hoofdleiding (of de SQL Editor / service role, waar auth.uid() leeg is) mag dat.
-- ---------------------------------------------------------------------

create or replace function public.bescherm_profielvelden()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_hoofdleiding() then
    return new;
  end if;
  if new.is_hoofdleiding is distinct from old.is_hoofdleiding
     or new.actief is distinct from old.actief
     or new.rol is distinct from old.rol
     or new.roles is distinct from old.roles
     or new.email is distinct from old.email then
    raise exception 'Enkel de hoofdleiding mag rollen, status of e-mail aanpassen';
  end if;
  return new;
end;
$$;

drop trigger if exists bescherm_profielvelden on public.profiles;
create trigger bescherm_profielvelden
  before update on public.profiles
  for each row execute function public.bescherm_profielvelden();

-- ---------------------------------------------------------------------
-- 5. Registratie enkel met @ksa-aalter.be (plus het testaccount)
-- ---------------------------------------------------------------------

create or replace function public.controleer_email_domein()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null
     or (lower(new.email) not like '%@ksa-aalter.be' and lower(new.email) <> 'it.takes.jaguarke@gmail.com') then
    raise exception 'Registreren kan enkel met een @ksa-aalter.be-adres';
  end if;
  return new;
end;
$$;

drop trigger if exists controleer_email_domein on auth.users;
create trigger controleer_email_domein
  before insert or update of email on auth.users
  for each row execute function public.controleer_email_domein();

-- Nieuwe gebruikers krijgen automatisch een profiel (naam valt terug op het deel voor de @)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, naam, email, rol, actief)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    'standaard',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

commit;

-- Controle na afloop (verwacht: minstens één hoofdleiding):
-- select naam, email from public.profiles where is_hoofdleiding;
-- Zo niet, maak jezelf hoofdleiding:
-- update public.profiles set is_hoofdleiding = true where email = 'jouw.naam@ksa-aalter.be';
