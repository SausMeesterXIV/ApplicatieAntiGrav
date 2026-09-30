-- =====================================================================
-- Drankfactuur: schatting tijdens de periode, echte kost bij het afsluiten
--  - tijdens de periode: schatting = jouw strepen x de prijs van die drank (de laatst ingestelde prijs,
--    bv. die van de vorige bak), bewaard op het moment van strepen
--  - bij het afsluiten vult Drankteam de echte kost in (bv. factuur van de brouwer);
--    die wordt verdeeld over alle strepen van de periode: echte kost / totaal strepen x jouw strepen
--  - zonder echte kost blijft het aantal x prijs
--  - de echte kost wordt bewaard bij de periode (billing_periods.echte_kost)
--  - het oude veld geschatte_kost wordt niet meer gebruikt
-- Vervangt periode_overzicht(uuid) en sluit_periode_af(uuid) uit 20261001000400_drank.sql.
-- =====================================================================

begin;

alter table public.billing_periods add column if not exists echte_kost numeric(10,2);

drop function if exists public.sluit_periode_af(uuid);
drop function if exists public.periode_overzicht(uuid);

-- Wat is elke leider verschuldigd voor de (open) periode?
-- p_echte_kost > 0: kostendeling; anders aantal x prijs. Gewone leiding ziet enkel de eigen rij.
create function public.periode_overzicht(p_period_id uuid default null, p_echte_kost numeric default null)
returns table (
  user_id uuid, naam text, strepen bigint,
  drank_bedrag numeric, friet_bedrag numeric, correctie_bedrag numeric, totaal numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_period uuid;
  v_totaal_strepen numeric;
  v_per_streep numeric;
  v_alles boolean := public.heeft_recht('drank_beheren');
begin
  if not public.is_leiding() then
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

-- Periode afsluiten: per leider een factuur (met de echte kost als die ingevuld is), nieuwe periode open
create function public.sluit_periode_af(p_period_id uuid default null, p_echte_kost numeric default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_period billing_periods%rowtype;
  v_nieuw uuid;
  v_factuur uuid;
  v_aantal integer := 0;
  r record;
  v_start date := current_date;
  v_werkjaar text;
begin
  if not public.heeft_recht('drank_beheren') then
    raise exception 'Enkel Drankteam mag een periode afsluiten';
  end if;
  if p_echte_kost is not null and p_echte_kost < 0 then
    raise exception 'De echte kost kan niet negatief zijn';
  end if;

  select * into v_period from billing_periods
  where id = coalesce(p_period_id, (select id from billing_periods where not is_closed order by start_datum desc limit 1))
  for update;
  if not found then raise exception 'Geen open periode gevonden'; end if;
  if v_period.is_closed then raise exception 'Deze periode is al afgesloten'; end if;

  for r in select * from public.periode_overzicht(v_period.id, p_echte_kost) loop
    if r.strepen = 0 and r.totaal = 0 then continue; end if;

    insert into facturen (user_id, user_naam, totaal_bedrag, periode, status, period_id,
                          aantal_strepen, drank_bedrag, friet_bedrag, correctie_bedrag)
    values (r.user_id, r.naam, r.totaal, v_period.naam, 'onbetaald', v_period.id,
            r.strepen, r.drank_bedrag, r.friet_bedrag, r.correctie_bedrag)
    returning id into v_factuur;

    update facturen set mededeling = public.gestructureerde_mededeling(nummer) where id = v_factuur;

    update consumpties set factuur_id = v_factuur
    where user_id = r.user_id and factuur_id is null and (period_id = v_period.id or period_id is null);

    update frituur_bestellingen set factuur_id = v_factuur
    where user_id = r.user_id and factuur_id is null and (period_id = v_period.id or period_id is null);

    v_aantal := v_aantal + 1;
  end loop;

  update billing_periods
  set is_closed = true, eind_datum = now(), echte_kost = nullif(p_echte_kost, 0)
  where id = v_period.id;

  -- Werkjaar loopt vanaf 15 augustus
  v_werkjaar := case
    when extract(month from v_start) < 8 or (extract(month from v_start) = 8 and extract(day from v_start) < 15)
      then (extract(year from v_start) - 1)::int || '-' || extract(year from v_start)::int
    else extract(year from v_start)::int || '-' || (extract(year from v_start) + 1)::int
  end;

  insert into billing_periods (naam, start_datum, is_closed, geschatte_kost, werkjaar)
  values ('Periode vanaf ' || to_char(v_start, 'DD/MM/YYYY'), now(), false, 0, v_werkjaar)
  returning id into v_nieuw;

  return json_build_object('closed_period_id', v_period.id, 'new_period_id', v_nieuw, 'aantal_facturen', v_aantal);
end;
$$;

revoke all on function public.periode_overzicht(uuid, numeric) from public, anon;
revoke all on function public.sluit_periode_af(uuid, numeric) from public, anon;
grant execute on function public.periode_overzicht(uuid, numeric) to authenticated;
grant execute on function public.sluit_periode_af(uuid, numeric) to authenticated;

commit;
