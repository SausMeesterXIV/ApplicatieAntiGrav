-- =====================================================================
-- Goedkeuring van nieuwe accounts tijdelijk uitzetten (bv. tijdens een testweekend)
--
-- Zolang app_settings 'goedkeuring_uit_tot' (een tijdstip) in de toekomst ligt, is een nieuw
-- @ksa-aalter.be-account meteen actief. Daarna geldt vanzelf weer de goedkeuring (002700/002800).
-- Uitzetten tot een tijdstip:
--   insert into app_settings (key, value) values ('goedkeuring_uit_tot', '2026-10-18 00:00 Europe/Brussels')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
-- Meteen terug aan: delete from app_settings where key = 'goedkeuring_uit_tot';
-- Vereist: 20261001002800_goedkeuring_zonder_meldingen.sql
-- =====================================================================

begin;

create or replace function public.goedkeuring_tijdelijk_uit()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_tot timestamptz;
begin
  select value::timestamptz into v_tot from app_settings where key = 'goedkeuring_uit_tot';
  return v_tot is not null and now() < v_tot;
exception when others then
  return false; -- onleesbare waarde: goedkeuring blijft aan
end;
$$;
revoke all on function public.goedkeuring_tijdelijk_uit() from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_oud boolean := lower(new.email) like '%@oudleiding.ksa-aalter.be'; -- kan enkel via de edge function
  v_meteen boolean := v_oud or public.goedkeuring_tijdelijk_uit();
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
    v_meteen,                                          -- leiding wacht op goedkeuring, tenzij tijdelijk uit
    v_oud,
    case when v_meteen then 'goedgekeurd' else 'wacht' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

commit;
