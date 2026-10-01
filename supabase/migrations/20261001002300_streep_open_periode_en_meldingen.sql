-- =====================================================================
-- 1. Strepen komen altijd in de periode die open staat.
--    Een periode-id uit de offline wachtrij of uit een gsm die nog de oude periode kende,
--    kon een streep in een afgesloten periode zetten: die kwam dan nooit op een factuur.
-- 2. Meldingen enkel voor actieve leiding (wie op inactief staat, leest ook geen
--    algemene meldingen meer met een sessie die nog openstond).
-- =====================================================================

create or replace function public.streep_drank(p_user_id uuid, p_drank_id uuid, p_aantal integer default 1, p_period_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_naam text;
  v_period uuid;
begin
  if not public.is_leiding() then
    raise exception 'Niet ingelogd als actieve leiding';
  end if;
  if p_user_id <> auth.uid() and not public.heeft_recht('drank_beheren') then
    raise exception 'Enkel Drankteam mag strepen zetten voor anderen';
  end if;
  if p_aantal is null or p_aantal < 1 then
    raise exception 'Ongeldig aantal';
  end if;

  select naam into v_naam from profiles where id = p_user_id and actief;
  if v_naam is null then
    raise exception 'Onbekende of inactieve leider';
  end if;

  -- Een meegegeven periode telt enkel als ze nog open is; anders de open periode
  select id into v_period from billing_periods where id = p_period_id and not is_closed;
  if v_period is null then
    select id into v_period from billing_periods where not is_closed order by start_datum desc limit 1;
  end if;
  if v_period is null then
    raise exception 'Er staat geen drankperiode open';
  end if;

  insert into consumpties (user_id, drank_id, aantal, period_id, user_naam)
  values (p_user_id, p_drank_id, p_aantal, v_period, v_naam)
  returning id into v_id;

  return v_id;
end;
$$;

drop policy if exists "eigen of algemene meldingen lezen" on public.notificaties;
create policy "eigen of algemene meldingen lezen" on public.notificaties
  for select using (
    public.is_leiding()
    and (ontvanger_id = 'all' or ontvanger_id = auth.uid()::text or zender_id = auth.uid())
  );

drop policy if exists "ontvanger markeert als gelezen" on public.notificaties;
create policy "ontvanger markeert als gelezen" on public.notificaties
  for update using (public.is_leiding() and ontvanger_id = auth.uid()::text)
  with check (public.is_leiding() and ontvanger_id = auth.uid()::text);

-- =====================================================================
-- 3. Friet: wie voor een ander bestelde, mag die bestelling annuleren zolang de ronde loopt.
--    De persoon voor wie besteld was, krijgt dan een melding (en push).
-- =====================================================================

alter table public.frituur_bestellingen
  add column if not exists besteld_door uuid references public.profiles(id) on delete set null default auth.uid();

-- besteld_door kan niet vervalst of achteraf aangepast worden (behalve door Drankteam)
create or replace function public.bescherm_frietbestelling()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or public.heeft_recht('drank_beheren') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.factuur_id := null;
    new.besteld_door := auth.uid();
    return new;
  end if;
  new.user_id := old.user_id;
  new.factuur_id := old.factuur_id;
  new.period_id := old.period_id;
  new.sessie_id := old.sessie_id;
  new.besteld_door := old.besteld_door;
  return new;
end;
$$;

drop policy if exists "eigen open bestelling of drankteam verwijdert" on public.frituur_bestellingen;
create policy "eigen open bestelling of drankteam verwijdert" on public.frituur_bestellingen for delete
  using (
    ((user_id = auth.uid() or besteld_door = auth.uid()) and factuur_id is null and status = 'open')
    or public.heeft_recht('drank_beheren')
  );

create or replace function public.melding_friet_geannuleerd()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_door text;
  v_items text;
begin
  if auth.uid() is null or old.user_id = auth.uid() then
    return old;
  end if;

  select coalesce(nullif(nickname, ''), naam) into v_door from profiles where id = auth.uid();

  select string_agg(coalesce(i->>'quantity', '1') || 'x ' || coalesce(i->>'name', '?'), ', ')
  into v_items
  from jsonb_array_elements(coalesce(old.items, '[]'::jsonb)) i;

  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
  values (
    auth.uid(),
    old.user_id::text,
    '🍟 Frietbestelling geannuleerd',
    coalesce(v_door, 'Iemand') || ' heeft je frietbestelling geannuleerd: '
      || coalesce(nullif(v_items, ''), old.snack_naam, 'bestelling')
      || ' (€' || replace(to_char(coalesce(old.totaal_prijs, 0), 'FM999990.00'), '.', ',') || ').'
      || ' Dit komt niet op je drankfactuur.',
    coalesce(v_door, 'Friet'),
    'order',
    'Bekijken|/frituur'
  );
  return old;
end;
$$;

revoke execute on function public.melding_friet_geannuleerd() from public, anon, authenticated;

drop trigger if exists melding_friet_geannuleerd on public.frituur_bestellingen;
create trigger melding_friet_geannuleerd
  after delete on public.frituur_bestellingen
  for each row execute function public.melding_friet_geannuleerd();
