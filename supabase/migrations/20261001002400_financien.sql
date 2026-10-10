-- =====================================================================
-- Financiën: overzicht van wat leiding moet betalen en wat al betaald is
--  - drankfacturen (van Drankteam) + "andere betalingen" (t-shirts, truien, activiteiten, …)
--  - andere betalingen: één betaling (bv. "Trui 2026 – €25") voor een selectie leiding,
--    met per leider een eigen bedrag, een eigen gestructureerde mededeling en een optionele deadline
--  - alles naar dezelfde KSA-rekening, met dezelfde EPC-QR als de drankfacturen
--  - zien en beheren: recht 'financien' (+ hoofdleiding); elke leider ziet enkel de eigen bedragen
--  - drankfactuur op betaald zetten: Drankteam, Financiën of hoofdleiding
--  - koppeling met een Google Sheet (twee richtingen) via de edge function financien-sheet:
--    elke wijziging in de app start meteen een synchronisatie; wijzigingen in de Sheet
--    worden elke 30 seconden opgehaald
--  - tabblad Strepen in de Sheet: elke streep (erbij of eraf) en elke prijswijziging staat er meteen in
-- Vereist: 20261001000400_drank.sql, 20261001001500_echte_kost.sql, 20261001001900_push_webhook.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Drankfacturen: opmerking, laatst gewijzigd, en Financiën mag ze lezen
-- ---------------------------------------------------------------------
alter table public.facturen add column if not exists opmerking text;
alter table public.facturen add column if not exists updated_at timestamptz not null default now();

drop policy if exists "financien leest facturen" on public.facturen;
create policy "financien leest facturen" on public.facturen for select
  using (public.heeft_recht('financien'));

create or replace function public.zet_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists facturen_updated_at on public.facturen;
create trigger facturen_updated_at
  before update on public.facturen
  for each row execute function public.zet_updated_at();

-- ---------------------------------------------------------------------
-- 2. Andere betalingen
-- ---------------------------------------------------------------------
create table if not exists public.betalingen (
  id uuid primary key default gen_random_uuid(),
  titel text not null check (char_length(btrim(titel)) between 1 and 120),
  omschrijving text,
  standaard_bedrag numeric(10,2) not null default 0 check (standaard_bedrag >= 0),
  vervaldatum date,
  aangemaakt_door uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Eigen nummerreeks vanaf 5 000 000 000: de gestructureerde mededelingen botsen nooit met die van de
-- drankfacturen (die tellen op vanaf 1).
create sequence if not exists public.betaling_posten_nummer_seq start 5000000000 minvalue 5000000000 maxvalue 9999999999;

create table if not exists public.betaling_posten (
  id uuid primary key default gen_random_uuid(),
  betaling_id uuid not null references public.betalingen(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  bedrag numeric(10,2) not null check (bedrag >= 0),
  nummer bigint not null unique default nextval('public.betaling_posten_nummer_seq'),
  mededeling text,
  status text not null default 'onbetaald' check (status in ('onbetaald', 'betaald')),
  betaald_op timestamptz,
  opmerking text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (betaling_id, user_id)
);
create index if not exists betaling_posten_user_idx on public.betaling_posten (user_id);

create or replace function public.post_zet_mededeling()
returns trigger language plpgsql set search_path = public as $$
begin
  new.mededeling := public.gestructureerde_mededeling(new.nummer);
  return new;
end;
$$;

drop trigger if exists post_zet_mededeling on public.betaling_posten;
create trigger post_zet_mededeling
  before insert on public.betaling_posten
  for each row execute function public.post_zet_mededeling();

-- Betaald zetten bewaart de datum (zelfde regel als bij de drankfacturen)
drop trigger if exists post_betaald_op on public.betaling_posten;
create trigger post_betaald_op
  before update of status on public.betaling_posten
  for each row execute function public.factuur_betaald_op();

drop trigger if exists posten_updated_at on public.betaling_posten;
create trigger posten_updated_at
  before update on public.betaling_posten
  for each row execute function public.zet_updated_at();

drop trigger if exists betalingen_updated_at on public.betalingen;
create trigger betalingen_updated_at
  before update on public.betalingen
  for each row execute function public.zet_updated_at();

alter table public.betalingen enable row level security;
alter table public.betaling_posten enable row level security;

-- Financiën en hoofdleiding zien en beheren alles; een leider ziet enkel de eigen posten
-- (en de betalingen waar hij/zij in zit, voor de titel en de deadline).
create policy "financien beheert betalingen" on public.betalingen for all
  using (public.heeft_recht('financien')) with check (public.heeft_recht('financien'));
create policy "leider ziet eigen betalingen" on public.betalingen for select
  using (exists (select 1 from public.betaling_posten p where p.betaling_id = betalingen.id and p.user_id = auth.uid()));

create policy "financien beheert posten" on public.betaling_posten for all
  using (public.heeft_recht('financien')) with check (public.heeft_recht('financien'));
create policy "leider ziet eigen posten" on public.betaling_posten for select
  using (user_id = auth.uid());

revoke all on public.betalingen, public.betaling_posten from anon, authenticated;
grant select, insert, update, delete on public.betalingen to authenticated;
-- Nummer en mededeling zet de database zelf: die kolommen zijn niet schrijfbaar vanuit de app
grant select, delete on public.betaling_posten to authenticated;
grant insert (betaling_id, user_id, bedrag, status, betaald_op, opmerking) on public.betaling_posten to authenticated;
grant update (bedrag, status, betaald_op, opmerking) on public.betaling_posten to authenticated;
grant usage on sequence public.betaling_posten_nummer_seq to authenticated;

-- ---------------------------------------------------------------------
-- 3. Eén overzicht: drankfacturen + andere betalingen
--    Financiën/hoofdleiding: iedereen. Anderen: enkel de eigen rijen.
-- ---------------------------------------------------------------------
create or replace function public.financien_overzicht()
returns table (
  soort text, id uuid, user_id uuid, naam text, titel text, bedrag numeric, mededeling text,
  status text, betaald_op timestamptz, vervaldatum date, opmerking text,
  betaling_id uuid, period_id uuid, aangemaakt_op timestamptz
)
language sql stable security definer set search_path = public as $$
  with mag as (select public.heeft_recht('financien') as alles)
  select 'drank', f.id, f.user_id, coalesce(p.naam, f.user_naam), 'Drank – ' || coalesce(f.periode, 'periode'),
         f.totaal_bedrag, f.mededeling, coalesce(f.status::text, 'onbetaald'), f.betaald_op, null::date, f.opmerking,
         null::uuid, f.period_id, f.created_at
  from facturen f
  left join profiles p on p.id = f.user_id, mag
  where public.is_leiding() and (mag.alles or f.user_id = auth.uid())
  union all
  select 'betaling', bp.id, bp.user_id, p.naam, b.titel,
         bp.bedrag, bp.mededeling, bp.status, bp.betaald_op, b.vervaldatum, bp.opmerking,
         b.id, null::uuid, bp.created_at
  from betaling_posten bp
  join betalingen b on b.id = bp.betaling_id
  left join profiles p on p.id = bp.user_id, mag
  where public.is_leiding() and (mag.alles or bp.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 4. Betaald / niet betaald (drank of andere betaling)
-- ---------------------------------------------------------------------
create or replace function public.zet_betaald(p_soort text, p_id uuid, p_betaald boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_soort = 'drank' then
    if not (public.heeft_recht('drank_beheren') or public.heeft_recht('financien')) then
      raise exception 'Enkel Drankteam, Financiën of hoofdleiding mag een drankfactuur op betaald zetten';
    end if;
    -- facturen.status is van het type factuur_status
    update facturen set status = (case when p_betaald then 'betaald' else 'onbetaald' end)::factuur_status where id = p_id;
  elsif p_soort = 'betaling' then
    if not public.heeft_recht('financien') then
      raise exception 'Enkel Financiën of hoofdleiding mag een betaling op betaald zetten';
    end if;
    update betaling_posten set status = case when p_betaald then 'betaald' else 'onbetaald' end where id = p_id;
  else
    raise exception 'Onbekende soort %', p_soort;
  end if;
  if not found then raise exception 'Niet gevonden'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Lopende drankperiode: Financiën (en de edge function voor de Sheet) ziet ook de schatting
--    van iedereen (zelfde berekening als in 20261001001500_echte_kost.sql)
-- ---------------------------------------------------------------------
create or replace function public.periode_overzicht(p_period_id uuid default null, p_echte_kost numeric default null)
returns table (
  user_id uuid, naam text, strepen bigint,
  drank_bedrag numeric, friet_bedrag numeric, correctie_bedrag numeric, totaal numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_period uuid;
  v_totaal_strepen numeric;
  v_per_streep numeric;
  v_service boolean := auth.role() = 'service_role';
  v_alles boolean := v_service or public.heeft_recht('drank_beheren') or public.heeft_recht('financien');
begin
  if not (v_service or public.is_leiding()) then
    return;
  end if;

  v_period := coalesce(p_period_id, (select id from billing_periods where not is_closed order by start_datum desc limit 1));

  select coalesce(sum(aantal), 0) into v_totaal_strepen
  from consumpties
  where factuur_id is null and (period_id = v_period or period_id is null);

  v_per_streep := case
    when coalesce(p_echte_kost, 0) > 0 and v_totaal_strepen > 0 then p_echte_kost / v_totaal_strepen
  end;

  return query
  with c as (
    select c.user_id, sum(c.aantal) as strepen, sum(c.aantal * coalesce(c.prijs, d.prijs, 0)) as volgens_prijs
    from consumpties c left join dranken d on d.id = c.drank_id
    where c.factuur_id is null and (c.period_id = v_period or c.period_id is null)
    group by c.user_id
  ),
  f as (
    select b.user_id, sum(coalesce(b.totaal_prijs, 0)) as bedrag
    from frituur_bestellingen b
    where b.factuur_id is null and (b.period_id = v_period or b.period_id is null)
    group by b.user_id
  ),
  k as (
    select bc.user_id, sum(bc.correctie_bedrag) as bedrag
    from billing_corrections bc
    where bc.period_id = v_period
    group by bc.user_id
  ),
  ids as (select c.user_id from c union select f.user_id from f union select k.user_id from k)
  select
    ids.user_id,
    p.naam,
    coalesce(c.strepen, 0)::bigint,
    round(coalesce(case when v_per_streep is not null then c.strepen * v_per_streep else c.volgens_prijs end, 0), 2),
    round(coalesce(f.bedrag, 0), 2),
    round(coalesce(k.bedrag, 0), 2),
    round(
      coalesce(case when v_per_streep is not null then c.strepen * v_per_streep else c.volgens_prijs end, 0)
      + coalesce(f.bedrag, 0) + coalesce(k.bedrag, 0), 2)
  from ids
  join profiles p on p.id = ids.user_id
  left join c on c.user_id = ids.user_id
  left join f on f.user_id = ids.user_id
  left join k on k.user_id = ids.user_id
  where v_alles or ids.user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Koppeling met de Google Sheet
-- ---------------------------------------------------------------------
create table if not exists public.financien_sheet (
  id smallint primary key default 1 check (id = 1),
  spreadsheet_id text,
  url text,
  laatste_sync timestamptz,
  laatste_fout text,
  laatste_fout_op timestamptz,
  problemen jsonb not null default '[]'::jsonb, -- rijen in de Sheet die de app niet kon verwerken
  sheet_gewijzigd_op text,          -- modifiedTime van het bestand bij de laatste synchronisatie
  gewijzigd boolean not null default true, -- er is iets veranderd in de app sinds de laatste synchronisatie
  bezig_tot timestamptz,            -- eenvoudige vergrendeling: maar één synchronisatie tegelijk
  gepauzeerd boolean not null default false, -- noodplan: koppeling UIT (Sheet of app)
  laatste_kopie_op date,            -- dag van de laatste dagelijkse reservekopie in Drive
  map_url text                      -- Drive-map met het rekenblad en de reservekopieën
);
insert into public.financien_sheet (id) values (1) on conflict (id) do nothing;

-- Laatst gesynchroniseerde waarden per rij: zo weten we wat er in de Sheet veranderd is.
create table if not exists public.financien_sheet_snapshot (
  sleutel text primary key,
  waarden jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.financien_sheet enable row level security;
alter table public.financien_sheet_snapshot enable row level security;
create policy "financien ziet koppeling" on public.financien_sheet for select using (public.heeft_recht('financien'));
-- snapshot: enkel de edge function (service role), geen policy voor ingelogden
revoke all on public.financien_sheet, public.financien_sheet_snapshot from anon, authenticated;
grant select on public.financien_sheet to authenticated;

-- Synchronisatie claimen (enkel de edge function): geeft true als deze aanroep mag synchroniseren.
create or replace function public.financien_sheet_claim(p_seconden integer default 90)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update financien_sheet
     set bezig_tot = now() + make_interval(secs => p_seconden), gewijzigd = false
   where id = 1 and (bezig_tot is null or bezig_tot < now());
  return found;
end;
$$;

create or replace function public.financien_sheet_vrijgeven(p_fout text default null, p_gewijzigd_op text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_opnieuw boolean;
begin
  update financien_sheet
     set bezig_tot = null,
         laatste_sync = case when p_fout is null then now() else laatste_sync end,
         laatste_fout = p_fout,
         laatste_fout_op = case when p_fout is null then laatste_fout_op else now() end,
         sheet_gewijzigd_op = coalesce(p_gewijzigd_op, sheet_gewijzigd_op)
   where id = 1
  returning gewijzigd into v_opnieuw;
  return coalesce(v_opnieuw, false); -- true: tijdens de synchronisatie veranderde er iets, nog eens
end;
$$;

-- Edge function aanroepen (zelfde manier als de pushmeldingen: sleutel uit de Vault)
create or replace function public.financien_sheet_aanroepen()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sleutel text;
begin
  if not exists (select 1 from financien_sheet where id = 1 and spreadsheet_id is not null) then
    return;
  end if;
  select decrypted_secret into v_sleutel from vault.decrypted_secrets where name = 'send_push_service_key';
  if v_sleutel is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://ukndvvsqreidugcfuiqq.supabase.co/functions/v1/financien-sheet',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_sleutel),
    body := jsonb_build_object('actie', 'sync'),
    timeout_milliseconds := 5000
  );
end;
$$;

-- Bij elke wijziging in de app: markeren en meteen synchroniseren (één keer per statement)
create or replace function public.financien_gewijzigd()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update financien_sheet set gewijzigd = true where id = 1 and spreadsheet_id is not null;
  perform public.financien_sheet_aanroepen();
  return null;
end;
$$;

drop trigger if exists financien_gewijzigd on public.facturen;
create trigger financien_gewijzigd after insert or update or delete on public.facturen
  for each statement execute function public.financien_gewijzigd();
drop trigger if exists financien_gewijzigd on public.betalingen;
create trigger financien_gewijzigd after insert or update or delete on public.betalingen
  for each statement execute function public.financien_gewijzigd();
drop trigger if exists financien_gewijzigd on public.betaling_posten;
create trigger financien_gewijzigd after insert or update or delete on public.betaling_posten
  for each statement execute function public.financien_gewijzigd();
-- Strepen en dranken: voor het tabblad Strepen (aantal per leider per drank, prijs per streep)
drop trigger if exists financien_gewijzigd on public.consumpties;
create trigger financien_gewijzigd after insert or update or delete on public.consumpties
  for each statement execute function public.financien_gewijzigd();
drop trigger if exists financien_gewijzigd on public.dranken;
create trigger financien_gewijzigd after insert or update of naam, prijs or delete on public.dranken
  for each statement execute function public.financien_gewijzigd();

-- ---------------------------------------------------------------------
-- 7. Rechten op de functies
-- ---------------------------------------------------------------------
revoke all on function public.financien_overzicht() from public, anon;
revoke all on function public.zet_betaald(text, uuid, boolean) from public, anon;
revoke all on function public.periode_overzicht(uuid, numeric) from public, anon;
revoke all on function public.financien_sheet_claim(integer) from public, anon, authenticated;
revoke all on function public.financien_sheet_vrijgeven(text, text) from public, anon, authenticated;
revoke all on function public.financien_sheet_aanroepen() from public, anon, authenticated;
revoke all on function public.financien_gewijzigd() from public, anon, authenticated;
revoke all on function public.post_zet_mededeling() from public, anon, authenticated;
revoke all on function public.zet_updated_at() from public, anon, authenticated;
grant execute on function public.financien_overzicht() to authenticated;
grant execute on function public.zet_betaald(text, uuid, boolean) to authenticated;
grant execute on function public.periode_overzicht(uuid, numeric) to authenticated, service_role;
grant execute on function public.financien_sheet_claim(integer), public.financien_sheet_vrijgeven(text, text) to service_role;

-- ---------------------------------------------------------------------
-- 8. Elke 30 seconden wijzigingen uit de Sheet ophalen (enkel als pg_cron aan staat)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'financien-sheet-sync';
    begin
      perform cron.schedule('financien-sheet-sync', '30 seconds', 'select public.financien_sheet_aanroepen()');
    exception when others then
      -- Oudere pg_cron kent geen seconden: dan elke minuut
      perform cron.schedule('financien-sheet-sync', '* * * * *', 'select public.financien_sheet_aanroepen()');
    end;
  else
    raise notice 'pg_cron niet beschikbaar: wijzigingen in de Sheet worden pas opgehaald bij een wijziging in de app of met "Nu synchroniseren".';
  end if;
end $$;

commit;
