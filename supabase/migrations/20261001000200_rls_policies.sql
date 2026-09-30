-- =====================================================================
-- Row Level Security volgens de rechtentabel in CLAUDE.md.
-- Per tabel worden ALLE bestaande policies verwijderd en opnieuw gezet,
-- zodat er geen oude "iedereen mag alles"-policies blijven hangen.
-- Enkel tabellen van de MVP; quotes, bierpong, winkeltje en inkoop blijven ongemoeid.
-- Vereist: 20261001000100_rollen_en_rechten.sql
-- =====================================================================

begin;

-- 1. Oude policies weg + RLS aan
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    'profiles', 'groepen', 'werkgroepen', 'profiel_groepen', 'profiel_werkgroepen',
    'app_settings', 'events', 'countdowns',
    'dranken', 'consumpties', 'facturen', 'billing_periods', 'billing_corrections', 'stock_items',
    'frituur_sessies', 'frituur_bestellingen', 'frituur_items',
    'notificaties', 'user_push_tokens'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'Tabel % bestaat niet, overgeslagen', t;
      continue;
    end if;
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- 2. Profielen en rollen
create policy "leiding leest profielen" on public.profiles for select using (public.is_leiding());
create policy "eigen profiel of hoofdleiding past aan" on public.profiles for update
  using (id = auth.uid() or public.is_hoofdleiding())
  with check (id = auth.uid() or public.is_hoofdleiding());
create policy "hoofdleiding verwijdert profielen" on public.profiles for delete using (public.is_hoofdleiding());

create policy "leiding leest groepen" on public.groepen for select using (public.is_leiding());

create policy "leiding leest werkgroepen" on public.werkgroepen for select using (public.is_leiding());
create policy "hoofdleiding beheert werkgroepen" on public.werkgroepen for all
  using (public.is_hoofdleiding()) with check (public.is_hoofdleiding());

create policy "leiding leest groepsleden" on public.profiel_groepen for select using (public.is_leiding());
create policy "hoofdleiding kent groepen toe" on public.profiel_groepen for all
  using (public.is_hoofdleiding()) with check (public.is_hoofdleiding());

create policy "leiding leest werkgroepleden" on public.profiel_werkgroepen for select using (public.is_leiding());
create policy "hoofdleiding kent werkgroepen toe" on public.profiel_werkgroepen for all
  using (public.is_hoofdleiding()) with check (public.is_hoofdleiding());

create policy "leiding leest instellingen" on public.app_settings for select using (public.is_leiding());
create policy "drankteam of hoofdleiding past instellingen aan" on public.app_settings for all
  using (public.heeft_recht('drank_beheren')) with check (public.heeft_recht('drank_beheren'));

-- 3. Agenda: iedereen leest, hoofdleiding + werkgroep met agenda_beheren schrijft
create policy "leiding leest events" on public.events for select using (public.is_leiding());
create policy "agendabeheer schrijft events" on public.events for all
  using (public.heeft_recht('agenda_beheren')) with check (public.heeft_recht('agenda_beheren'));

create policy "leiding leest aftelklokken" on public.countdowns for select using (public.is_leiding());
create policy "agendabeheer schrijft aftelklokken" on public.countdowns for all
  using (public.heeft_recht('agenda_beheren')) with check (public.heeft_recht('agenda_beheren'));

-- 4. Drank
create policy "leiding leest dranken" on public.dranken for select using (public.is_leiding());
create policy "drankteam beheert dranken" on public.dranken for all
  using (public.heeft_recht('drank_beheren')) with check (public.heeft_recht('drank_beheren'));

-- Eigen strepen zien en zetten; Drankteam ziet en beheert alles.
-- Zelf een streep verwijderen kan tot 1 uur na het zetten, zolang ze niet gefactureerd is.
create policy "eigen strepen of drankteam leest" on public.consumpties for select
  using (user_id = auth.uid() or public.heeft_recht('drank_beheren'));
create policy "zelf strepen of drankteam voor anderen" on public.consumpties for insert
  with check ((user_id = auth.uid() and public.is_leiding()) or public.heeft_recht('drank_beheren'));
create policy "drankteam past strepen aan" on public.consumpties for update
  using (public.heeft_recht('drank_beheren')) with check (public.heeft_recht('drank_beheren'));
create policy "eigen recente streep of drankteam verwijdert" on public.consumpties for delete
  using (
    (user_id = auth.uid() and factuur_id is null and created_at > now() - interval '1 hour')
    or public.heeft_recht('drank_beheren')
  );

create policy "eigen facturen of drankteam leest" on public.facturen for select
  using (user_id = auth.uid() or public.heeft_recht('drank_beheren'));
create policy "drankteam beheert facturen" on public.facturen for all
  using (public.heeft_recht('drank_beheren')) with check (public.heeft_recht('drank_beheren'));

create policy "leiding leest periodes" on public.billing_periods for select using (public.is_leiding());
create policy "drankteam beheert periodes" on public.billing_periods for all
  using (public.heeft_recht('drank_beheren')) with check (public.heeft_recht('drank_beheren'));

create policy "eigen correcties of drankteam leest" on public.billing_corrections for select
  using (user_id = auth.uid() or public.heeft_recht('drank_beheren'));
create policy "drankteam beheert correcties" on public.billing_corrections for all
  using (public.heeft_recht('drank_beheren')) with check (public.heeft_recht('drank_beheren'));

create policy "leiding leest voorraad" on public.stock_items for select using (public.is_leiding());
create policy "drankteam beheert voorraad" on public.stock_items for all
  using (public.heeft_recht('drank_beheren')) with check (public.heeft_recht('drank_beheren'));

-- 5. Friet: alle leiding opent/sluit rondes en bestelt (ook voor anderen); menu = Drankteam
create policy "leiding leest frietrondes" on public.frituur_sessies for select using (public.is_leiding());
create policy "leiding opent frietrondes" on public.frituur_sessies for insert with check (public.is_leiding());
create policy "leiding werkt frietrondes bij" on public.frituur_sessies for update
  using (public.is_leiding()) with check (public.is_leiding());
create policy "drankteam verwijdert frietrondes" on public.frituur_sessies for delete using (public.heeft_recht('drank_beheren'));

create policy "leiding leest frietbestellingen" on public.frituur_bestellingen for select using (public.is_leiding());
create policy "leiding bestelt friet" on public.frituur_bestellingen for insert with check (public.is_leiding());
create policy "leiding werkt frietbestellingen bij" on public.frituur_bestellingen for update
  using (public.is_leiding()) with check (public.is_leiding());
create policy "eigen bestelling of drankteam verwijdert" on public.frituur_bestellingen for delete
  using (user_id = auth.uid() or public.heeft_recht('drank_beheren'));

create policy "leiding leest frietmenu" on public.frituur_items for select using (public.is_leiding());
create policy "drankteam beheert frietmenu" on public.frituur_items for all
  using (public.heeft_recht('drank_beheren')) with check (public.heeft_recht('drank_beheren'));

-- 6. Berichten: iedereen mag een individu berichten (nudges, friet); naar iedereen enkel met recht
create policy "eigen of algemene meldingen lezen" on public.notificaties for select
  using (ontvanger_id = 'all' or ontvanger_id = auth.uid()::text or zender_id = auth.uid());
create policy "leiding stuurt meldingen" on public.notificaties for insert
  with check (
    zender_id = auth.uid() and public.is_leiding()
    and (ontvanger_id <> 'all' or public.heeft_recht('berichten_sturen'))
  );
create policy "ontvanger markeert als gelezen" on public.notificaties for update
  using (ontvanger_id = auth.uid()::text) with check (ontvanger_id = auth.uid()::text);
create policy "zender of hoofdleiding verwijdert melding" on public.notificaties for delete
  using (zender_id = auth.uid() or public.is_hoofdleiding());

create policy "eigen pushtokens" on public.user_push_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 7. De admin_*-views omzeilden RLS (views draaien standaard met de rechten van de eigenaar).
--    Met security_invoker gelden de policies van de onderliggende tabellen.
do $$
declare v text;
begin
  foreach v in array array['admin_billing_corrections', 'admin_consumpties', 'admin_facturen', 'admin_frituur_bestellingen', 'admin_notificaties'] loop
    if to_regclass('public.' || v) is not null then
      execute format('alter view public.%I set (security_invoker = on)', v);
      execute format('revoke all on public.%I from anon', v);
    end if;
  end loop;
end $$;

-- 8. streep_drank opnieuw, met rechtencontrole in de functie zelf
--    (security definer omzeilt RLS, dus de controle moet hier gebeuren).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'streep_drank' loop
    execute format('drop function %s', f.sig);
  end loop;
end $$;

create function public.streep_drank(p_user_id uuid, p_drank_id uuid, p_aantal integer default 1, p_period_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
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

  v_period := coalesce(p_period_id, (select id from billing_periods where not is_closed order by start_datum desc limit 1));

  insert into consumpties (user_id, drank_id, aantal, period_id, user_naam)
  values (p_user_id, p_drank_id, p_aantal, v_period, v_naam)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.streep_drank(uuid, uuid, integer, uuid) from public, anon;
grant execute on function public.streep_drank(uuid, uuid, integer, uuid) to authenticated;

commit;
