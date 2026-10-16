-- =====================================================================
-- Eenmalig: een e-mailadres op voorhand hoofdleiding maken
--
-- Staat een adres in voorbestemde_hoofdleiding (nog niet gebruikt en nog geldig), dan is het account dat
-- daarmee registreert meteen actief en hoofdleiding (zonder goedkeuring). Daarna staat gebruikt_op ingevuld
-- en geldt het nooit meer (ook niet als dat account later verwijderd en opnieuw aangemaakt wordt).
-- Tabel zonder rechten voor de app: enkel in de database aan te passen.
--   insert into voorbestemde_hoofdleiding (email, geldig_tot) values ('…@ksa-aalter.be', '2026-10-31 Europe/Brussels');
-- Vereist: 20261001003000_goedkeuring_tijdelijk_uit.sql
-- =====================================================================

begin;

create table if not exists public.voorbestemde_hoofdleiding (
  email text primary key check (email = lower(email)),
  geldig_tot timestamptz not null,
  gebruikt_op timestamptz,
  aangemaakt_op timestamptz not null default now()
);
alter table public.voorbestemde_hoofdleiding enable row level security;
revoke all on public.voorbestemde_hoofdleiding from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_oud boolean := lower(new.email) like '%@oudleiding.ksa-aalter.be'; -- kan enkel via de edge function
  v_hoofd boolean := false;
  v_meteen boolean;
  v_voornaam text := nullif(trim(new.raw_user_meta_data->>'voornaam'), '');
  v_achternaam text := nullif(trim(new.raw_user_meta_data->>'achternaam'), '');
  v_naam text;
begin
  -- Eenmalig voorbestemde hoofdleiding: meteen gebruikt markeren
  update voorbestemde_hoofdleiding set gebruikt_op = now()
  where email = lower(new.email) and gebruikt_op is null and now() < geldig_tot;
  v_hoofd := found and not v_oud;

  v_meteen := v_oud or v_hoofd or public.goedkeuring_tijdelijk_uit();
  v_naam := coalesce(
    nullif(trim(concat_ws(' ', v_voornaam, v_achternaam)), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, naam, voornaam, achternaam, email, rol, actief, is_oudleiding, goedkeuring, is_hoofdleiding)
  values (
    new.id, v_naam, v_voornaam, v_achternaam, new.email, 'standaard',
    v_meteen,                                          -- leiding wacht op goedkeuring, tenzij hierboven
    v_oud,
    case when v_meteen then 'goedgekeurd' else 'wacht' end,
    v_hoofd
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

commit;
