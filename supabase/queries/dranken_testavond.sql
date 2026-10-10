-- Dranken voor de testavond (strepen): Freedom, Cola, Fanta, Sprite, Ice Tea aan €0 (nog geen voorraad).
-- Uit te voeren in de Supabase SQL Editor. Verwijdert niets: andere dranken worden enkel verborgen
-- (tijdelijke drank met einddatum gisteren) en kunnen later terug zichtbaar gezet worden.

-- 1. Bekijk eerst wat er nu staat (ter controle)
select naam, prijs, huidige_voorraad, is_temporary, valid_until from public.dranken order by naam;

-- 2. De vijf dranken: bestaande (zelfde naam, hoofdletters maken niet uit) worden zichtbaar en €0, ontbrekende komen erbij
begin;

with gewenst(naam) as (values ('Freedom'), ('Cola'), ('Fanta'), ('Sprite'), ('Ice Tea'))
update public.dranken d
set prijs = 0, is_temporary = false, valid_until = null
from gewenst g
where lower(d.naam) = lower(g.naam);

with gewenst(naam) as (values ('Freedom'), ('Cola'), ('Fanta'), ('Sprite'), ('Ice Tea'))
insert into public.dranken (naam, prijs, categorie)
select g.naam, 0, 'Drank' from gewenst g
where not exists (select 1 from public.dranken d where lower(d.naam) = lower(g.naam));

-- 3. Alle andere dranken verbergen (niet verwijderen)
update public.dranken
set is_temporary = true, valid_until = current_date - 1
where lower(naam) not in ('freedom', 'cola', 'fanta', 'sprite', 'ice tea');

-- 4. Er moet een drankperiode open staan, anders kan niemand strepen
insert into public.billing_periods (naam, start_datum, is_closed, geschatte_kost, werkjaar)
select 'Testavond ' || to_char(current_date, 'DD/MM/YYYY'), now(), false, 0,
       case when extract(month from current_date) < 8 or (extract(month from current_date) = 8 and extract(day from current_date) < 15)
            then (extract(year from current_date)::int - 1) || '-' || extract(year from current_date)::int
            else extract(year from current_date)::int || '-' || (extract(year from current_date)::int + 1) end
where not exists (select 1 from public.billing_periods where not is_closed);

commit;

-- 5. Resultaat
select naam, prijs, is_temporary, valid_until from public.dranken order by is_temporary, naam;
select naam, start_datum from public.billing_periods where not is_closed;
