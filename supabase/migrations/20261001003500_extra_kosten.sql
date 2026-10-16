-- =====================================================================
-- Extra kosten (bv. de cara's van een weekend) op de drankfactuur
--
-- Drankteam of Financiën maakt een extra kost voor een gekozen groep leiding, op twee manieren:
--  - 'verdelen':    een totaalbedrag gelijk verdeeld; de centen die overblijven gaan naar de eersten
--                   (op naam), zodat de som exact het totaal is;
--  - 'per_persoon': hetzelfde bedrag voor iedereen.
-- Per leider wordt dat een correctie (billing_corrections) in de open periode, met extra_kost_id.
-- Correcties tellen al mee in periode_overzicht, de voorlopige rekening, het afsluiten en Excel.
-- Een extra kost verwijderen kan zolang de periode open is (de correcties gaan mee weg).
-- Vereist: 20261001002400_financien.sql
-- =====================================================================

begin;

create table if not exists public.extra_kosten (
  id uuid primary key default gen_random_uuid(),
  titel text not null check (length(trim(titel)) between 1 and 80),
  wijze text not null check (wijze in ('verdelen', 'per_persoon')),
  bedrag numeric(10, 2) not null check (bedrag > 0),   -- totaal (verdelen) of per persoon
  period_id uuid not null references public.billing_periods(id) on delete restrict,
  aangemaakt_door uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.extra_kosten enable row level security;
revoke all on public.extra_kosten from anon, authenticated;
grant select on public.extra_kosten to authenticated;

alter table public.billing_corrections
  add column if not exists extra_kost_id uuid references public.extra_kosten(id) on delete cascade;
create index if not exists billing_corrections_extra_kost on public.billing_corrections (extra_kost_id);

-- Lezen: Drankteam en Financiën alles; leiding de extra kosten waarin ze zelf zit
drop policy if exists "extra kosten lezen" on public.extra_kosten;
create policy "extra kosten lezen" on public.extra_kosten for select using (
  public.heeft_recht('drank_beheren') or public.heeft_recht('financien')
  or exists (select 1 from billing_corrections bc where bc.extra_kost_id = extra_kosten.id and bc.user_id = auth.uid())
);

-- Correcties: Financiën mag nu ook lezen en beheren (naast Drankteam)
drop policy if exists "eigen correcties of drankteam leest" on public.billing_corrections;
create policy "eigen correcties of drankteam leest" on public.billing_corrections for select using (
  user_id = auth.uid() or public.heeft_recht('drank_beheren') or public.heeft_recht('financien')
);
drop policy if exists "drankteam beheert correcties" on public.billing_corrections;
create policy "drankteam beheert correcties" on public.billing_corrections for all
  using (public.heeft_recht('drank_beheren') or public.heeft_recht('financien'))
  with check (public.heeft_recht('drank_beheren') or public.heeft_recht('financien'));

-- ---------------------------------------------------------------------
-- Een extra kost maken
-- ---------------------------------------------------------------------
create or replace function public.maak_extra_kost(p_titel text, p_wijze text, p_bedrag numeric, p_user_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_period uuid;
  v_kost uuid;
  v_n integer;
  v_centen bigint;
  v_basis bigint;
  v_rest integer;
  r record;
  v_i integer := 0;
begin
  if not (public.heeft_recht('drank_beheren') or public.heeft_recht('financien')) then
    raise exception 'Enkel Drankteam of Financiën kan extra kosten aanrekenen';
  end if;
  if p_wijze not in ('verdelen', 'per_persoon') then
    raise exception 'Kies: totaal verdelen of bedrag per persoon';
  end if;
  if p_bedrag is null or p_bedrag <= 0 then
    raise exception 'Vul een bedrag groter dan 0 in';
  end if;
  if p_titel is null or length(trim(p_titel)) = 0 then
    raise exception 'Geef de extra kost een naam, bv. Cara''s weekend';
  end if;

  select id into v_period from billing_periods where not is_closed order by start_datum desc limit 1;
  if v_period is null then
    raise exception 'Er staat geen drankperiode open';
  end if;

  -- Enkel bestaande, actieve leden; elke persoon één keer
  select count(*) into v_n from profiles where id = any(p_user_ids) and actief;
  if v_n = 0 then
    raise exception 'Kies minstens één persoon';
  end if;

  insert into extra_kosten (titel, wijze, bedrag, period_id, aangemaakt_door)
  values (trim(p_titel), p_wijze, round(p_bedrag, 2), v_period, auth.uid())
  returning id into v_kost;

  v_centen := round(p_bedrag * 100);
  v_basis := v_centen / v_n;          -- verdelen: in centen, naar beneden
  v_rest := (v_centen % v_n)::integer; -- de eerste v_rest personen betalen 1 cent meer

  for r in select id, naam from profiles where id = any(p_user_ids) and actief order by naam, id loop
    v_i := v_i + 1;
    insert into billing_corrections (user_id, period_id, correctie_bedrag, notitie, user_naam, extra_kost_id)
    values (
      r.id, v_period,
      case when p_wijze = 'per_persoon' then round(p_bedrag, 2)
           else (v_basis + case when v_i <= v_rest then 1 else 0 end) / 100.0 end,
      trim(p_titel),
      r.naam,
      v_kost
    );
  end loop;

  return v_kost;
end;
$$;

-- Verwijderen zolang de periode open is (de correcties van alle personen gaan mee weg)
create or replace function public.verwijder_extra_kost(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.heeft_recht('drank_beheren') or public.heeft_recht('financien')) then
    raise exception 'Enkel Drankteam of Financiën kan extra kosten verwijderen';
  end if;
  if exists (
    select 1 from extra_kosten k join billing_periods p on p.id = k.period_id
    where k.id = p_id and p.is_closed
  ) then
    raise exception 'Deze periode is afgesloten: de extra kost staat al op de facturen';
  end if;
  delete from extra_kosten where id = p_id;
end;
$$;

revoke all on function public.maak_extra_kost(text, text, numeric, uuid[]), public.verwijder_extra_kost(uuid) from public, anon;
grant execute on function public.maak_extra_kost(text, text, numeric, uuid[]), public.verwijder_extra_kost(uuid) to authenticated;

commit;
