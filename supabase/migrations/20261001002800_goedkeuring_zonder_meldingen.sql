-- =====================================================================
-- Nieuwe accounts goedkeuren zonder meldingen of pushberichten
--
-- Beslissing (16/10): er wordt nooit gemaild en niemand krijgt een push voor een nieuw account.
-- Wie de app opent, ziet de pop-up met wachtende accounts en kan pas verder na verifiëren of afwijzen.
-- Deze migratie haalt de meldingen uit 002700 weg (bij registreren en na een beslissing).
-- Vereist: 20261001002700_goedkeuring_nieuwe_accounts.sql
-- =====================================================================

begin;

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
  return new;
end;
$$;

-- Verifiëren of afwijzen. Geeft de status terug; was iemand anders sneller, dan diens beslissing.
create or replace function public.beoordeel_account(p_id uuid, p_goedkeuren boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not public.is_leiding() then
    raise exception 'Enkel actieve leiding kan nieuwe accounts goedkeuren';
  end if;

  select goedkeuring into v_status from profiles where id = p_id for update;
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

  return case when p_goedkeuren then 'goedgekeurd' else 'afgewezen' end;
end;
$$;

revoke all on function public.beoordeel_account(uuid, boolean) from public, anon;
grant execute on function public.beoordeel_account(uuid, boolean) to authenticated;

commit;
