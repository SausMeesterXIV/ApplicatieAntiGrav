-- =====================================================================
-- Friet: enkel hoofdleiding en Drankteam bepalen prijzen
--  - het menu (frituur_items) was al afgeschermd via RLS (drank_beheren)
--  - maar de prijs van een bestelling kwam van de app: wie de aanvraag aanpast,
--    kon een eigen prijs doorgeven
--  - deze trigger neemt voor gewone leiding altijd de prijs uit het menu en
--    rekent het totaal zelf uit; hoofdleiding en Drankteam mogen prijzen van
--    een bestelling wel aanpassen (bv. prijzen van een ronde herrekenen)
-- Vereist: 20261001000100_rollen_en_rechten.sql
-- =====================================================================

begin;

create or replace function public.friet_prijs_uit_menu()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_items jsonb := '[]'::jsonb;
  v_totaal numeric := 0;
  v_item jsonb;
  v_prijs numeric;
  v_aantal numeric;
begin
  if auth.uid() is null or public.heeft_recht('drank_beheren') then
    return new;
  end if;

  -- Bij een aanpassing door gewone leiding: items en totaal blijven zoals ze waren
  if tg_op = 'UPDATE' then
    new.items := old.items;
    new.totaal_prijs := old.totaal_prijs;
    return new;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) loop
    select price into v_prijs from frituur_items where id::text = v_item->>'id';
    if v_prijs is null then
      raise exception 'Onbekend item in de bestelling: %', coalesce(v_item->>'name', v_item->>'id');
    end if;
    v_aantal := coalesce((v_item->>'quantity')::numeric, 1);
    if v_aantal < 1 then
      raise exception 'Ongeldig aantal voor %', coalesce(v_item->>'name', v_item->>'id');
    end if;
    v_items := v_items || jsonb_build_array(v_item || jsonb_build_object('price', v_prijs));
    v_totaal := v_totaal + v_prijs * v_aantal;
  end loop;

  new.items := v_items;
  new.totaal_prijs := round(v_totaal, 2);
  return new;
end;
$$;

drop trigger if exists friet_prijs_uit_menu on public.frituur_bestellingen;
create trigger friet_prijs_uit_menu
  before insert or update of items, totaal_prijs on public.frituur_bestellingen
  for each row execute function public.friet_prijs_uit_menu();

commit;
