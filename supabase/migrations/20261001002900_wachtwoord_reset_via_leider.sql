-- =====================================================================
-- Wachtwoord vergeten zonder mail: een code via een leider die je zelf kiest
--
-- 1. Op het inlogscherm vult de leider zijn e-mail in en kiest een andere leider (vraag_wachtwoord_reset).
--    Het antwoord is altijd hetzelfde, ook als het adres niet bestaat (verraadt niet wie een account heeft).
-- 2. De gekozen leider ziet bij het openen van de app een pop-up en kiest "Maak code" of "Weigeren".
--    De code (6 cijfers) bestaat enkel op zijn scherm; de database bewaart enkel een hash.
-- 3. Met e-mail + code + nieuw wachtwoord zet de edge function 'wachtwoord-reset' het nieuwe wachtwoord
--    (controleer_resetcode: 10 minuten geldig, na 5 foute pogingen vervallen, één keer te gebruiken).
-- Oudleiding: blijft via Drankteam (bestaande functie), niet via dit verzoek.
-- Vereist: 20261001002700_goedkeuring_nieuwe_accounts.sql
-- =====================================================================

begin;

create table if not exists public.wachtwoord_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  leider_id uuid not null references public.profiles(id) on delete cascade,
  aangevraagd_op timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'code', 'geweigerd', 'gebruikt', 'vervangen')),
  code_hash text,
  code_gemaakt_op timestamptz,
  pogingen integer not null default 0
);
create index if not exists wachtwoord_resets_leider on public.wachtwoord_resets (leider_id, status);
create index if not exists wachtwoord_resets_user on public.wachtwoord_resets (user_id, aangevraagd_op);

-- Geen rechtstreekse toegang: alles via de functies hieronder
alter table public.wachtwoord_resets enable row level security;
revoke all on public.wachtwoord_resets from anon, authenticated;

-- ---------------------------------------------------------------------
-- Lijst om een leider te kiezen (ook zonder login): enkel id en naam van actieve leiding
-- ---------------------------------------------------------------------
create or replace function public.reset_leiders()
returns table (id uuid, naam text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(trim(concat_ws(' ', p.voornaam, p.achternaam)), ''), p.naam)
  from profiles p
  where p.actief and not p.is_oudleiding
  order by 2;
$$;

-- ---------------------------------------------------------------------
-- Code aanvragen (zonder login). Geeft altijd 'ok' terug.
-- ---------------------------------------------------------------------
create or replace function public.vraag_wachtwoord_reset(p_email text, p_leider uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  select id into v_user from profiles
  where lower(email) = lower(trim(p_email)) and actief and not is_oudleiding;

  if v_user is null or v_user = p_leider
     or not exists (select 1 from profiles where id = p_leider and actief and not is_oudleiding) then
    return 'ok';
  end if;

  -- Hooguit 5 aanvragen per uur per account (tegen lastigvallen van leiding met pop-ups)
  if (select count(*) from wachtwoord_resets where user_id = v_user and aangevraagd_op > now() - interval '1 hour') >= 5 then
    return 'ok';
  end if;

  update wachtwoord_resets set status = 'vervangen' where user_id = v_user and status in ('open', 'code');
  insert into wachtwoord_resets (user_id, leider_id) values (v_user, p_leider);
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------
-- Voor de gekozen leider (ingelogd)
-- ---------------------------------------------------------------------
-- Open verzoeken aan mij van het laatste uur
create or replace function public.mijn_resetverzoeken()
returns table (id uuid, naam text, email text, aangevraagd_op timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, coalesce(nullif(trim(concat_ws(' ', p.voornaam, p.achternaam)), ''), p.naam), p.email, r.aangevraagd_op
  from wachtwoord_resets r
  join profiles p on p.id = r.user_id
  where r.leider_id = auth.uid() and public.is_leiding()
    and r.status = 'open' and r.aangevraagd_op > now() - interval '1 hour'
  order by r.aangevraagd_op;
$$;

-- Code maken: geeft de code één keer terug, de database bewaart enkel de hash
create or replace function public.maak_resetcode(p_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text;
begin
  if not public.is_leiding() then
    raise exception 'Enkel actieve leiding kan een code maken';
  end if;
  if not exists (
    select 1 from wachtwoord_resets
    where id = p_id and leider_id = auth.uid() and status = 'open' and aangevraagd_op > now() - interval '1 hour'
  ) then
    raise exception 'Dit verzoek bestaat niet meer of is al afgehandeld';
  end if;

  -- 6 cijfers, cryptografisch willekeurig
  v_code := lpad(((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  update wachtwoord_resets
  set status = 'code', code_hash = crypt(v_code, gen_salt('bf')), code_gemaakt_op = now(), pogingen = 0
  where id = p_id;
  return v_code;
end;
$$;

create or replace function public.weiger_reset(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update wachtwoord_resets set status = 'geweigerd'
  where id = p_id and leider_id = auth.uid() and status = 'open';
end;
$$;

-- ---------------------------------------------------------------------
-- Code controleren: enkel voor de edge function (service_role). Geeft de user_id bij een geldige code.
-- ---------------------------------------------------------------------
create or replace function public.controleer_resetcode(p_email text, p_code text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_reset wachtwoord_resets%rowtype;
begin
  select r.* into v_reset
  from wachtwoord_resets r
  join profiles p on p.id = r.user_id
  where lower(p.email) = lower(trim(p_email)) and p.actief and r.status = 'code'
  order by r.code_gemaakt_op desc
  limit 1
  for update of r;

  if v_reset.id is null or v_reset.code_gemaakt_op < now() - interval '10 minutes' or v_reset.pogingen >= 5 then
    return null;
  end if;

  if v_reset.code_hash = crypt(trim(p_code), v_reset.code_hash) then
    update wachtwoord_resets set status = 'gebruikt' where id = v_reset.id;
    return v_reset.user_id;
  end if;

  update wachtwoord_resets set pogingen = pogingen + 1 where id = v_reset.id;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Rechten
-- ---------------------------------------------------------------------
revoke all on function public.reset_leiders(), public.vraag_wachtwoord_reset(text, uuid),
  public.mijn_resetverzoeken(), public.maak_resetcode(uuid), public.weiger_reset(uuid),
  public.controleer_resetcode(text, text) from public;
grant execute on function public.reset_leiders(), public.vraag_wachtwoord_reset(text, uuid) to anon, authenticated;
grant execute on function public.mijn_resetverzoeken(), public.maak_resetcode(uuid), public.weiger_reset(uuid) to authenticated;
grant execute on function public.controleer_resetcode(text, text) to service_role;

commit;
