-- =====================================================================
-- Friet: besteluur, meldingen en een ronde weggooien; agenda: enkel Sfeerbeheer maakt items
--
-- 1. Agenda: nieuwe items maken mag enkel wie het recht agenda_beheren heeft (werkgroep Sfeerbeheer) en hoofdleiding.
--    Aanpassen (maker + agenda_beheren) en verwijderen (maker + hoofdleiding) blijven zoals ze waren.
-- 2. Meldingen kunnen vervallen (notificaties.verloopt_op): daarna zie je ze niet meer in de app.
-- 3. Frietronde: wie opent, kiest tot hoe laat iedereen kan bestellen (frituur_sessies.bestel_tot).
--    Bij het openen krijgt alle leiding en oudleiding een melding (vervalt op het besteluur).
--    5 minuten voor het besteluur: herinnering aan wie nog niets besteld heeft (pg_cron, elke minuut).
-- 4. gooi_frietronde_weg(): een ronde die nog niet afgerekend is helemaal weggooien. Alle bestellingen
--    verdwijnen, er komt niets op een drankrekening, en wie besteld had krijgt een melding (bestaande trigger
--    melding_friet_geannuleerd).
-- =====================================================================

begin;

-- 1. Agenda -----------------------------------------------------------
alter policy "leiding maakt events" on public.events
  with check (public.is_leiding() and created_by = auth.uid() and public.heeft_recht('agenda_beheren'));

-- 2. Vervallende meldingen ---------------------------------------------
alter table public.notificaties add column if not exists verloopt_op timestamptz;

alter policy "eigen of algemene meldingen lezen" on public.notificaties using (
  public.is_lid()
  and (verloopt_op is null or verloopt_op > now())
  and (
    ontvanger_id = auth.uid()::text or zender_id = auth.uid()
    or (ontvanger_id = 'all' and public.is_leiding())
  )
);

-- 3. Besteluur en meldingen --------------------------------------------
alter table public.frituur_sessies
  add column if not exists bestel_tot timestamptz,
  add column if not exists herinnerd_op timestamptz;

create or replace function public.friet_uur(p_tijd timestamptz)
returns text language sql immutable set search_path = public as $$
  select to_char(p_tijd at time zone 'Europe/Brussels', 'HH24:MI');
$$;

-- Bij het openen van een ronde: iedereen (leiding en oudleiding, behalve wie opent) een melding
create or replace function public.melding_frietronde_open()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_door text;
begin
  if new.status <> 'open' then
    return new;
  end if;
  select coalesce(nullif(nickname, ''), naam) into v_door from profiles where id = new.created_by;
  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action, verloopt_op)
  select
    new.created_by,
    p.id::text,
    '🍟 Je kan friet bestellen',
    coalesce(v_door, 'Iemand') || ' opende een frietronde.'
      || case when new.bestel_tot is not null then ' Bestellen kan tot ' || public.friet_uur(new.bestel_tot) || '.' else '' end,
    coalesce(v_door, 'Friet'),
    'order',
    'Bestellen|/frituur',
    coalesce(new.bestel_tot, now() + interval '3 hours')
  from profiles p
  where p.actief and p.id is distinct from new.created_by;
  return new;
end;
$$;
revoke execute on function public.melding_frietronde_open() from public, anon, authenticated;

drop trigger if exists melding_frietronde_open on public.frituur_sessies;
create trigger melding_frietronde_open
  after insert on public.frituur_sessies
  for each row execute function public.melding_frietronde_open();

-- 5 minuten voor het besteluur: herinnering aan wie nog niets besteld heeft (vervalt op het besteluur)
create or replace function public.friet_herinneringen()
returns integer language plpgsql security definer set search_path = public as $$
declare
  s record;
  v_aantal integer := 0;
  v_n integer;
begin
  for s in
    select * from frituur_sessies
    where status = 'open' and bestel_tot is not null and herinnerd_op is null
      and bestel_tot > now() and bestel_tot <= now() + interval '5 minutes'
    for update skip locked
  loop
    insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action, verloopt_op)
    select
      s.created_by,
      p.id::text,
      '⏰ Nog even om friet te bestellen',
      'Je hebt nog niets besteld. Bestellen kan tot ' || public.friet_uur(s.bestel_tot) || '.',
      'Friet',
      'order',
      'Bestellen|/frituur',
      s.bestel_tot
    from profiles p
    where p.actief
      and not exists (
        select 1 from frituur_bestellingen b where b.sessie_id = s.id and b.user_id = p.id
      );
    get diagnostics v_n = row_count;
    v_aantal := v_aantal + v_n;
    update frituur_sessies set herinnerd_op = now() where id = s.id;
  end loop;
  return v_aantal;
end;
$$;
revoke execute on function public.friet_herinneringen() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'friet-herinnering';
    perform cron.schedule('friet-herinnering', '* * * * *', 'select public.friet_herinneringen()');
  end if;
end $$;

-- 4. Een ronde weggooien -----------------------------------------------
create or replace function public.gooi_frietronde_weg(p_sessie_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_sessie frituur_sessies%rowtype;
  v_aantal integer;
begin
  if not public.is_lid() then
    raise exception 'Niet ingelogd als actieve leiding';
  end if;
  select * into v_sessie from frituur_sessies where id = p_sessie_id for update;
  if not found then
    raise exception 'Onbekende frietronde';
  end if;
  if v_sessie.closed_at is not null then
    raise exception 'Deze frietronde is al afgerekend en blijft bewaard';
  end if;
  if exists (select 1 from frituur_bestellingen where sessie_id = p_sessie_id and factuur_id is not null) then
    raise exception 'Er staan al bestellingen van deze ronde op een factuur';
  end if;
  -- Elke bestelling weg; wie besteld had, krijgt een melding via de trigger melding_friet_geannuleerd
  delete from frituur_bestellingen where sessie_id = p_sessie_id;
  get diagnostics v_aantal = row_count;
  -- De meldingen "je kan friet bestellen" en de herinneringen van deze ronde vervallen meteen
  update notificaties set verloopt_op = now()
  where type = 'order' and action = 'Bestellen|/frituur' and verloopt_op > now()
    and created_at >= v_sessie.created_at;
  delete from frituur_sessies where id = p_sessie_id;
  return v_aantal;
end;
$$;
revoke execute on function public.gooi_frietronde_weg(uuid) from public, anon;
grant execute on function public.gooi_frietronde_weg(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
