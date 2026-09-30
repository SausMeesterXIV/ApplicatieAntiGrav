-- =====================================================================
-- Agenda-herinnering om precies 18:00 Belgische tijd, de dag vooraf
--  - pg_cron rekent in UTC; 18:00 in België is 16:00 UTC (zomer) of 17:00 UTC (winter)
--  - de job draait om 16:00 én 17:00 UTC; de functie doet enkel iets als het in Brussel 18u is
--  - elk item krijgt nog altijd maar één herinnering (herinnering_verzonden_op)
-- Vereist: 20261001000700_push.sql
-- =====================================================================

begin;

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
    returning id, titel, coalesce(start_time::text, tijd::text) as uur, locatie
  )
  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
  select null, 'all', 'Morgen: ' || titel,
         'Om ' || left(coalesce(uur, ''), 5) || coalesce(' in ' || nullif(locatie, ''), ''),
         'Agenda', 'agenda', 'Bekijken'
  from morgen;
  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

revoke all on function public.stuur_agenda_herinneringen() from public, anon, authenticated;

commit;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'agenda-herinneringen';
  perform cron.schedule('agenda-herinneringen', '0 16,17 * * *', 'select public.stuur_agenda_herinneringen()');
exception when others then
  raise notice 'pg_cron niet beschikbaar (%). Zet Cron aan in het dashboard en voer dit blok opnieuw uit.', sqlerrm;
end $$;
