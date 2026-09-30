-- =====================================================================
-- Er is altijd minstens één actieve hoofdleiding
--  - hoofdleiding deelt de rollen uit; zonder hoofdleiding kan niemand nog een nieuwe aanduiden
--  - de laatste actieve hoofdleiding kan dus niet:
--      * de rol hoofdleiding verliezen
--      * op inactief gezet worden
--      * verwijderd worden (ook niet via het verwijderen van het account)
--  - geldt ook in de SQL Editor: duid eerst een nieuwe hoofdleiding aan
-- Vereist: 20261001000100_rollen_en_rechten.sql
-- =====================================================================

begin;

create or replace function public.bewaar_laatste_hoofdleiding()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Enkel relevant als deze rij nu een actieve hoofdleiding is en dat verliest
  if not (old.is_hoofdleiding and old.actief) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.is_hoofdleiding and new.actief then
    return new;
  end if;

  -- Vergrendel alle hoofdleiding-rijen: twee gelijktijdige wijzigingen kunnen elkaar zo niet omzeilen
  perform 1 from profiles where is_hoofdleiding and actief for update;

  if not exists (
    select 1 from profiles where id <> old.id and is_hoofdleiding and actief
  ) then
    raise exception 'Er moet altijd minstens één hoofdleiding zijn. Duid eerst iemand anders aan als hoofdleiding.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists bewaar_laatste_hoofdleiding on public.profiles;
create trigger bewaar_laatste_hoofdleiding
  before update of is_hoofdleiding, actief or delete on public.profiles
  for each row execute function public.bewaar_laatste_hoofdleiding();

commit;
