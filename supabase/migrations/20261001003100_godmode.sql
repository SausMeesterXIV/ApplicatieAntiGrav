-- =====================================================================
-- Godmode: verborgen beheeraccount
--
--  - Een Godmode-account heeft alle rechten (telt in de database als hoofdleiding, dus ook elk werkgroeprecht).
--  - In de app ziet het eruit als een gewone leider: geen label, en de app kan niet lezen wie Godmode heeft.
--  - Enkel in de database aan te passen: tabel godmode_accounts heeft geen rechten voor de app (anon/authenticated).
--    Toevoegen:  insert into godmode_accounts (user_id) select id from profiles where email = '…';
--    Weghalen:   delete from godmode_accounts where user_id = (select id from profiles where email = '…');
--  - Niemand in de app kan een Godmode-account aanpassen of verwijderen (rollen, actief, oudleiding, e-mail,
--    goedkeuring), ook hoofdleiding en het account zelf niet. Naam, bijnaam, foto e.d. wel (door zichzelf).
--  - De regel "altijd minstens één hoofdleiding" telt een actief Godmode-account mee.
-- Vereist: 20261001001200_altijd_hoofdleiding.sql, 20261001002700_goedkeuring_nieuwe_accounts.sql
-- =====================================================================

begin;

create table if not exists public.godmode_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  toegevoegd_op timestamptz not null default now()
);
alter table public.godmode_accounts enable row level security;
revoke all on public.godmode_accounts from anon, authenticated;

create or replace function public.is_godmode(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from godmode_accounts where user_id = p_id);
$$;
revoke all on function public.is_godmode(uuid) from public, anon, authenticated;

-- Godmode telt als hoofdleiding (en krijgt zo via heeft_recht ook elk werkgroeprecht)
create or replace function public.is_hoofdleiding()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.actief
      and (p.is_hoofdleiding or exists (select 1 from godmode_accounts g where g.user_id = p.id))
  );
$$;

-- Voor de app: ben ik Godmode? (enkel over jezelf, nooit over een ander)
create or replace function public.mijn_godmode()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from godmode_accounts where user_id = auth.uid());
$$;
revoke all on function public.mijn_godmode() from public, anon;
grant execute on function public.mijn_godmode() to authenticated;

-- ---------------------------------------------------------------------
-- Profielen beschermen
-- ---------------------------------------------------------------------
create or replace function public.bescherm_profielvelden()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- SQL Editor / database zelf
  end if;
  -- Godmode-account: rollen en status nooit via de app
  if public.is_godmode(old.id) and (
       new.is_hoofdleiding is distinct from old.is_hoofdleiding
    or new.actief is distinct from old.actief
    or new.is_oudleiding is distinct from old.is_oudleiding
    or new.rol is distinct from old.rol
    or new.roles is distinct from old.roles
    or new.email is distinct from old.email
    or new.goedkeuring is distinct from old.goedkeuring) then
    raise exception 'Dit account kan je niet aanpassen';
  end if;
  if public.is_hoofdleiding() then
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

-- Godmode-profiel kan niet verwijderd worden via de app. Eigen functie i.p.v. is_godmode() in de policy:
-- zo kan niemand via de app opvragen wie Godmode heeft (dit antwoordt enkel voor hoofdleiding).
create or replace function public.mag_profiel_verwijderen(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_hoofdleiding() and not exists (select 1 from godmode_accounts where user_id = p_id);
$$;
revoke all on function public.mag_profiel_verwijderen(uuid) from public, anon;
grant execute on function public.mag_profiel_verwijderen(uuid) to authenticated;

drop policy if exists "hoofdleiding verwijdert profielen" on public.profiles;
create policy "hoofdleiding verwijdert profielen" on public.profiles for delete
  using (public.mag_profiel_verwijderen(id));

-- ---------------------------------------------------------------------
-- Altijd minstens één hoofdleiding: een actief Godmode-account telt mee
-- ---------------------------------------------------------------------
create or replace function public.bewaar_laatste_hoofdleiding()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not ((old.is_hoofdleiding or public.is_godmode(old.id)) and old.actief) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.actief and (new.is_hoofdleiding or public.is_godmode(new.id)) then
    return new;
  end if;

  perform 1 from profiles where is_hoofdleiding and actief for update;

  if not exists (
    select 1 from profiles p
    where p.id <> old.id and p.actief
      and (p.is_hoofdleiding or exists (select 1 from godmode_accounts g where g.user_id = p.id))
  ) then
    raise exception 'Er moet altijd minstens één hoofdleiding zijn. Duid eerst iemand anders aan als hoofdleiding.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

commit;
