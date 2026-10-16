-- =====================================================================
-- Google Sheet van Drankteam: strepen aanpassen in de Sheet + prijs per streepje uit de Sheet
--
-- 1. Strepen die de app maakt omdat Drankteam een aantal in de Sheet (tabblad Drankrekening) veranderde,
--    krijgen bron = 'sheet'. Het verschil wordt één streep (bv. +2 of -2). Geen melding voor de persoon;
--    in het logboek van Team Drank staat "via Sheet". De persoon zelf kan zo'n streep niet verwijderen
--    (enkel Drankteam), ook niet binnen het uur.
-- 2. drank_sheet_stand: wat de app de vorige keer in de Sheet schreef (per leider per drank). Zo ziet de
--    app wat er in de Sheet veranderd is. Enkel voor de edge function (service role).
-- 3. drank_sheet_slot: één rij als slot, zodat twee synchronisaties nooit tegelijk lopen (anders zou een
--    aanpassing twee keer meetellen).
-- 4. consumpties.prijs met 4 decimalen: de prijs per streepje uit de Sheet (aankoopprijs x gedronken /
--    strepen) is zelden een rond bedrag in centen. De totalen per persoon worden nog altijd op centen afgerond.
-- Vereist: 20261001003600_drank_sheet_cron.sql
-- =====================================================================

begin;

-- 1. Bron van een streep
alter table public.consumpties add column if not exists bron text;
alter table public.consumpties drop constraint if exists consumpties_bron_check;
alter table public.consumpties add constraint consumpties_bron_check check (bron is null or bron = 'sheet');

drop policy if exists "eigen recente streep of drankteam verwijdert" on public.consumpties;
create policy "eigen recente streep of drankteam verwijdert" on public.consumpties for delete using (
  (user_id = auth.uid() and factuur_id is null and bron is null and created_at > now() - interval '1 hour')
  or public.heeft_recht('drank_beheren')
);

-- 4. Prijs per streep met 4 decimalen
alter table public.consumpties alter column prijs type numeric(10, 4);

-- 2. Wat de app de vorige keer in de Sheet schreef
create table if not exists public.drank_sheet_stand (
  user_id uuid not null references public.profiles(id) on delete cascade,
  drank_id uuid not null references public.dranken(id) on delete cascade,
  aantal integer not null,
  primary key (user_id, drank_id)
);
alter table public.drank_sheet_stand enable row level security;
revoke all on public.drank_sheet_stand from anon, authenticated;

-- 3. Slot
create table if not exists public.drank_sheet_slot (
  id integer primary key check (id = 1),
  bezig_tot timestamptz
);
insert into public.drank_sheet_slot (id) values (1) on conflict (id) do nothing;
alter table public.drank_sheet_slot enable row level security;
revoke all on public.drank_sheet_slot from anon, authenticated;

commit;
