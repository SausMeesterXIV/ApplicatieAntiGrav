-- =====================================================================
-- Friet: melding als iemand een bestelling plaatst in jouw naam
--  - elke leider mag voor een ander bestellen (zo hoort het)
--  - de persoon voor wie besteld wordt, krijgt altijd een melding (en dus een push):
--    wie besteld heeft, wat en voor welk bedrag
--  - vanuit de database, zodat de melding niet kan ontbreken en het bedrag
--    het echte bedrag is (na friet_prijs_uit_menu)
-- Vereist: 20261001000500_berichten.sql, 20261001000900_friet_prijzen.sql
-- =====================================================================

begin;

create or replace function public.melding_friet_voor_ander()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_besteller text;
  v_items text;
begin
  if auth.uid() is null or new.user_id = auth.uid() then
    return new;
  end if;

  select coalesce(nullif(nickname, ''), naam) into v_besteller from profiles where id = auth.uid();

  select string_agg(coalesce(i->>'quantity', '1') || 'x ' || coalesce(i->>'name', '?'), ', ')
  into v_items
  from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) i;

  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
  values (
    auth.uid(),
    new.user_id::text,
    '🍟 Frietbestelling in jouw naam',
    coalesce(v_besteller, 'Iemand') || ' heeft friet besteld in jouw naam: '
      || coalesce(nullif(v_items, ''), new.snack_naam, 'bestelling')
      || ' (€' || replace(to_char(coalesce(new.totaal_prijs, 0), 'FM999990.00'), '.', ',') || ').'
      || ' Het bedrag komt op je drankfactuur.',
    coalesce(v_besteller, 'Friet'),
    'order',
    'Bekijken|/frituur'
  );
  return new;
end;
$$;

drop trigger if exists melding_friet_voor_ander on public.frituur_bestellingen;
create trigger melding_friet_voor_ander
  after insert on public.frituur_bestellingen
  for each row execute function public.melding_friet_voor_ander();

commit;
