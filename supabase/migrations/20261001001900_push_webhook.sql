-- =====================================================================
-- Pushmeldingen: elke nieuwe melding naar de edge function send-push sturen
--  - vervangt de "Database Webhook" uit het dashboard (die module, supabase_functions, is niet
--    in elk project beschikbaar); gebruikt pg_net rechtstreeks
--  - de service-sleutel staat versleuteld in de Vault onder de naam 'send_push_service_key'
--    (eenmalig zetten, zie supabase/README.md); zonder sleutel gebeurt er niets (geen fout)
--  - send-push leest de melding zelf opnieuw uit de database (de payload wordt niet vertrouwd)
-- Vereist: pg_net en supabase_vault (standaard in Supabase), 20261001000700_push.sql
-- =====================================================================

begin;

create extension if not exists pg_net;

create or replace function public.stuur_push_webhook()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sleutel text;
begin
  select decrypted_secret into v_sleutel from vault.decrypted_secrets where name = 'send_push_service_key';
  if v_sleutel is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://ukndvvsqreidugcfuiqq.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_sleutel),
    body := jsonb_build_object('type', 'INSERT', 'schema', 'public', 'table', 'notificaties', 'record', jsonb_build_object('id', new.id)),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

revoke all on function public.stuur_push_webhook() from public, anon, authenticated;

drop trigger if exists stuur_push on public.notificaties;
create trigger stuur_push
  after insert on public.notificaties
  for each row execute function public.stuur_push_webhook();

commit;
