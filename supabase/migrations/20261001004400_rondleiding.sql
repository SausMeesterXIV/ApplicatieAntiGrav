-- =====================================================================
-- Rondleiding voor nieuwe accounts: één keer per account, onthouden op het profiel.
-- Bestaande (goedgekeurde) accounts kennen de app al en krijgen ze niet automatisch;
-- wie nog op goedkeuring wacht, krijgt ze wel. Iedereen kan ze opnieuw openen in Instellingen.
-- Elke leider past dit veld zelf aan op het eigen profiel (bestaande RLS, geen beschermd veld).
-- =====================================================================

alter table public.profiles add column if not exists rondleiding_gezien_op timestamptz;

update public.profiles set rondleiding_gezien_op = now()
where rondleiding_gezien_op is null and goedkeuring is distinct from 'wacht';
