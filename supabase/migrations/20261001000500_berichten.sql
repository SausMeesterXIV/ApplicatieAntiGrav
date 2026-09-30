-- =====================================================================
-- Berichten (CLAUDE.md: Berichten)
--  - nieuw bericht naar alle leiding, een groep, een werkgroep of gekozen personen
--  - enkel wie het recht berichten_sturen heeft (hoofdleiding altijd)
--  - "open factuur": leiding met een onbetaalde factuur (ook voor Drankteam)
-- Nudges en friet-meldingen naar één persoon blijven voor alle leiding mogelijk (RLS op notificaties).
-- Vereist: 20261001000100_rollen_en_rechten.sql
-- =====================================================================

begin;

alter table public.notificaties add column if not exists type text not null default 'official';

create or replace function public.stuur_bericht(
  p_doel text,                -- 'alle' | 'groep' | 'werkgroep' | 'personen' | 'open_factuur'
  p_doel_id text,             -- groep-id of werkgroep-id (anders null)
  p_personen uuid[],          -- bij 'personen'
  p_titel text,
  p_bericht text,
  p_afzender_naam text
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_ontvangers uuid[];
  v_aantal integer;
begin
  if p_doel = 'open_factuur' then
    if not (public.heeft_recht('berichten_sturen') or public.heeft_recht('drank_beheren')) then
      raise exception 'Je hebt geen recht om deze berichten te sturen';
    end if;
  elsif not public.heeft_recht('berichten_sturen') then
    raise exception 'Je hebt geen recht om berichten te sturen';
  end if;

  if coalesce(trim(p_titel), '') = '' then
    raise exception 'Onderwerp ontbreekt';
  end if;

  select array_agg(distinct p.id) into v_ontvangers
  from profiles p
  where p.actief and p.id <> auth.uid() and (
       (p_doel = 'alle')
    or (p_doel = 'groep' and exists (select 1 from profiel_groepen pg where pg.profile_id = p.id and pg.groep_id::text = p_doel_id))
    or (p_doel = 'werkgroep' and exists (select 1 from profiel_werkgroepen pw where pw.profile_id = p.id and pw.werkgroep_id::text = p_doel_id))
    or (p_doel = 'personen' and p.id = any (p_personen))
    or (p_doel = 'open_factuur' and exists (select 1 from facturen f where f.user_id = p.id and f.status <> 'betaald'))
  );

  if v_ontvangers is null then
    return 0;
  end if;

  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type)
  select auth.uid(), o::text, p_titel, p_bericht, coalesce(p_afzender_naam, (select naam from profiles where id = auth.uid())), 'official'
  from unnest(v_ontvangers) o;

  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

revoke all on function public.stuur_bericht(text, text, uuid[], text, text, text) from public, anon;
grant execute on function public.stuur_bericht(text, text, uuid[], text, text, text) to authenticated;

commit;

-- Melding bij een nieuw of aangepast agenda-item, vanuit de database zelf
-- (werkt voor iedereen met agenda_beheren, ook zonder recht om berichten te sturen).
begin;

create or replace function public.melding_agenda_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- bv. wijziging via de SQL Editor: geen melding
  end if;
  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
  values (
    auth.uid(),
    'all',
    case when tg_op = 'INSERT' then new.titel else 'Agenda bijgewerkt: ' || new.titel end,
    case when tg_op = 'INSERT'
      then coalesce(nullif(new.beschrijving, ''), 'Nieuw in de agenda op ' || to_char(new.datum::date, 'DD/MM/YYYY'))
      else 'Het agenda-item is aangepast.'
    end,
    'Agenda',
    'agenda',
    'Bekijken'
  );
  return new;
end;
$$;

drop trigger if exists melding_agenda_item on public.events;
create trigger melding_agenda_item
  after insert or update of titel, datum, tijd, start_time, locatie on public.events
  for each row execute function public.melding_agenda_item();

commit;
