-- =====================================================================
-- Google Sheet van Drankteam altijd bijwerken
--
-- Elke 30 seconden roept de database de edge function drank-sheet aan (actie 'sync'). Die schrijft de
-- Sheet enkel als er iets veranderd is. Zonder gekoppelde Sheet (secret DRANK_SHEET_ID) doet de functie niets.
-- Zelfde werkwijze als financien_sheet_aanroepen (20261001002400_financien.sql): pg_net met de service key
-- uit de vault ('send_push_service_key').
-- Vereist: 20261001002400_financien.sql (pg_net, vault-sleutel)
-- =====================================================================

begin;

create or replace function public.drank_sheet_aanroepen()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sleutel text;
begin
  select decrypted_secret into v_sleutel from vault.decrypted_secrets where name = 'send_push_service_key';
  if v_sleutel is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://ukndvvsqreidugcfuiqq.supabase.co/functions/v1/drank-sheet',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_sleutel),
    body := jsonb_build_object('actie', 'sync'),
    timeout_milliseconds := 20000
  );
end;
$$;
revoke all on function public.drank_sheet_aanroepen() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'drank-sheet-sync';
    begin
      perform cron.schedule('drank-sheet-sync', '30 seconds', 'select public.drank_sheet_aanroepen()');
    exception when others then
      -- Oudere pg_cron kent geen seconden: dan elke minuut
      perform cron.schedule('drank-sheet-sync', '* * * * *', 'select public.drank_sheet_aanroepen()');
    end;
  else
    raise notice 'pg_cron niet beschikbaar: de Sheet wordt enkel bijgewerkt bij het openen in de app.';
  end if;
end $$;

commit;
