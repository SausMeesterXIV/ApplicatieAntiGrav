-- =====================================================================
-- Pushmeldingen (CLAUDE.md: Berichten > Pushmeldingen, Agenda > Meldingen)
--  - standaard Web Push (VAPID), gratis, zonder Firebase
--  - abonnementen per toestel in push_subscriptions
--  - meldingen aan/uit per leider (profiles.push_enabled)
--  - elke nieuwe rij in notificaties wordt door de edge function send-push als push verstuurd
--    (koppeling via een Database Webhook, zie supabase/README.md)
--  - dagelijkse herinnering voor agenda-items van morgen (pg_cron)
-- Vereist: 20261001000100_rollen_en_rechten.sql
-- =====================================================================

begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
create policy "eigen pushabonnementen" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.profiles add column if not exists push_enabled boolean not null default true;

-- Onthouden welke meldingen al als push verstuurd zijn (voorkomt dubbele pushes)
alter table public.notificaties add column if not exists push_verzonden_op timestamptz;

-- Systeemmeldingen (herinneringen) hebben geen afzender
alter table public.notificaties alter column zender_id drop not null;

alter table public.events add column if not exists herinnering_verzonden_op timestamptz;

-- Herinnering voor alle agenda-items van morgen (één keer per item)
create or replace function public.stuur_agenda_herinneringen()
returns integer language plpgsql security definer set search_path = public as $$
declare v_aantal integer;
begin
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

-- Dagelijks om 18:00 Belgische tijd (16:00 UTC in de zomer, 17:00 in de winter: we kiezen 16:30 UTC).
-- pg_cron moet aan staan (Dashboard > Integrations > Cron). Lukt dit niet, dan geeft dit enkel een melding.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'agenda-herinneringen';
  perform cron.schedule('agenda-herinneringen', '30 16 * * *', 'select public.stuur_agenda_herinneringen()');
exception when others then
  raise notice 'pg_cron niet beschikbaar (%). Zet Cron aan in het dashboard en voer dit blok opnieuw uit.', sqlerrm;
end $$;
