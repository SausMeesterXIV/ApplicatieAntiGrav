-- =====================================================================
-- Agenda: meerdaagse items en items delen met oudleiding
--
-- 1. Meerdaags: eind_datum (null = eendaags). Het item loopt van datum tot en met eind_datum.
-- 2. voor_oudleiding: oudleiding ziet enkel de agenda-items die hiermee gedeeld zijn, en kan daar
--    aanwezigheid aanduiden. Bijlagen blijven enkel voor leiding. Aanmaken, aanpassen en verwijderen
--    blijft enkel voor leiding.
-- 3. Meldingen: oudleiding leest geen meldingen aan iedereen ('all'), dus bij een gedeeld item krijgt
--    elke oudleider een eigen melding (nieuw item en herinnering de dag vooraf om 18u).
-- Vereist: 20261001002500_oudleiding_groepen_extern.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Kolommen
-- ---------------------------------------------------------------------
alter table public.events add column if not exists eind_datum date;
alter table public.events add column if not exists voor_oudleiding boolean not null default false;

alter table public.events drop constraint if exists eind_na_start;
alter table public.events add constraint eind_na_start check (eind_datum is null or eind_datum >= datum::date);

-- ---------------------------------------------------------------------
-- 2. Wie ziet wat
-- ---------------------------------------------------------------------
-- Is dit agenda-item gedeeld met oudleiding en is de ingelogde gebruiker oudleiding?
create or replace function public.oudleiding_ziet_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_oudleiding() and exists (select 1 from events where id = p_event_id and voor_oudleiding);
$$;
revoke all on function public.oudleiding_ziet_event(uuid) from public, anon;
grant execute on function public.oudleiding_ziet_event(uuid) to authenticated;

alter policy "leiding leest events" on public.events
  using (public.is_leiding() or (voor_oudleiding and public.is_oudleiding()));

alter policy "leiding ziet aanwezigheid" on public.event_aanwezigheid
  using (public.is_leiding() or public.oudleiding_ziet_event(event_id));
alter policy "eigen aanwezigheid invullen" on public.event_aanwezigheid
  with check (user_id = auth.uid() and (public.is_leiding() or public.oudleiding_ziet_event(event_id)));
alter policy "eigen aanwezigheid aanpassen" on public.event_aanwezigheid
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (public.is_leiding() or public.oudleiding_ziet_event(event_id)));

-- ---------------------------------------------------------------------
-- 3. Meldingen
-- ---------------------------------------------------------------------
create or replace function public.melding_agenda_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nieuw boolean := tg_op = 'INSERT';
  v_titel text;
  v_bericht text;
begin
  if auth.uid() is null then
    return new; -- bv. wijziging via de SQL Editor: geen melding
  end if;

  v_titel := case when v_nieuw then new.titel else 'Agenda bijgewerkt: ' || new.titel end;
  v_bericht := case when v_nieuw
    then coalesce(nullif(new.beschrijving, ''), 'Nieuw in de agenda op ' || to_char(new.datum::date, 'DD/MM/YYYY'))
    else 'Het agenda-item is aangepast.'
  end;

  -- Alle leiding: bij een nieuw item of als titel, datum, uur of locatie veranderde
  if v_nieuw
     or new.titel is distinct from old.titel or new.datum is distinct from old.datum
     or new.eind_datum is distinct from old.eind_datum or new.tijd is distinct from old.tijd
     or new.start_time is distinct from old.start_time or new.locatie is distinct from old.locatie then
    insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
    values (auth.uid(), 'all', v_titel, v_bericht, 'Agenda', 'agenda', 'Bekijken');
  end if;

  -- Oudleiding: elk een eigen melding, enkel bij een gedeeld item.
  -- Pas gedeeld (voorheen niet)? Dan is het voor hen een nieuw item.
  if new.voor_oudleiding then
    if not v_nieuw and not old.voor_oudleiding then
      v_titel := new.titel;
      v_bericht := coalesce(nullif(new.beschrijving, ''), 'Nieuw in de agenda op ' || to_char(new.datum::date, 'DD/MM/YYYY'));
    elsif not v_nieuw
      and new.titel is not distinct from old.titel and new.datum is not distinct from old.datum
      and new.eind_datum is not distinct from old.eind_datum and new.tijd is not distinct from old.tijd
      and new.start_time is not distinct from old.start_time and new.locatie is not distinct from old.locatie then
      return new; -- niets veranderd dat oudleiding moet weten
    end if;
    insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
    select auth.uid(), p.id::text, v_titel, v_bericht, 'Agenda', 'agenda', 'Bekijken'
    from profiles p
    where p.actief and p.is_oudleiding and p.id <> auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists melding_agenda_item on public.events;
create trigger melding_agenda_item
  after insert or update of titel, datum, eind_datum, tijd, start_time, locatie, voor_oudleiding on public.events
  for each row execute function public.melding_agenda_item();

revoke all on function public.melding_agenda_item() from public, anon, authenticated;

-- Herinnering de dag vooraf om 18u (Belgische tijd): ook voor oudleiding bij een gedeeld item
create or replace function public.stuur_agenda_herinneringen()
returns integer language plpgsql security definer set search_path = public as $$
declare v_aantal integer;
begin
  if extract(hour from (now() at time zone 'Europe/Brussels')) <> 18 then
    return 0;
  end if;

  with morgen as (
    update events
    set herinnering_verzonden_op = now()
    where datum::date = (now() at time zone 'Europe/Brussels')::date + 1
      and herinnering_verzonden_op is null
    returning id, titel, coalesce(start_time::text, tijd::text) as uur, locatie, voor_oudleiding
  ),
  ontvangers as (
    select m.*, 'all' as ontvanger from morgen m
    union all
    select m.*, p.id::text from morgen m
    join profiles p on p.actief and p.is_oudleiding
    where m.voor_oudleiding
  )
  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
  select null, ontvanger, 'Morgen: ' || titel,
         'Om ' || left(coalesce(uur, ''), 5) || coalesce(' in ' || nullif(locatie, ''), ''),
         'Agenda', 'agenda', 'Bekijken'
  from ontvangers;
  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

revoke all on function public.stuur_agenda_herinneringen() from public, anon, authenticated;

commit;
