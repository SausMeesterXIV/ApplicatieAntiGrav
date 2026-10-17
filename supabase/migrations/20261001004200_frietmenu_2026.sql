-- =====================================================================
-- Frietmenu van de vaste frituur (oktober 2026): nieuwe prijzen, twee nieuwe categorieën (actie, vegetarisch)
-- en de nieuwe items. Bestaande items worden aangepast (zelfde id), zodat favorieten blijven werken.
-- Frankfurter en Perlut staan niet meer op het menu en verdwijnen (oude bestellingen bewaren hun eigen kopie
-- van naam en prijs, er is geen verwijzing naar frituur_items).
-- =====================================================================

begin;

create temporary table nieuw_menu (oud text, naam text, prijs numeric, categorie text, omschrijving text) on commit drop;

insert into nieuw_menu (oud, naam, prijs, categorie, omschrijving) values
  -- Actie
  (null, 'Vol-au-vent met frietjes mayo', 10.50, 'actie', null),
  (null, 'Balletjes in tomatensaus met frietjes en mayonaise', 10.50, 'actie', null),
  -- Frieten
  ('Kinder', 'Kinder', 2.50, 'frieten', null),
  ('Klein', 'Klein', 2.90, 'frieten', null),
  ('Middel', 'Middel', 3.40, 'frieten', null),
  ('Groot', 'Groot', 3.90, 'frieten', null),
  ('Extra (2~3 pers.)', 'Extra', 5.40, 'frieten', 'Voor 2~3 personen'),
  ('Supertje Klein', 'Supertje Klein', 7.00, 'frieten', null),
  ('Supertje Groot', 'Supertje Groot', 8.00, 'frieten', null),
  ('Julientje', 'Julientje', 9.50, 'frieten', null),
  ('Romboutje', 'Romboutje', 9.90, 'frieten', null),
  ('Smullbox', 'Smullbox', 7.90, 'frieten', null),
  ('Aardappelkroket (7st)', 'Aardappelkroket (7st)', 2.90, 'frieten', null),
  ('Groot Romboutje', 'Groot Romboutje', 10.70, 'frieten', null),
  ('Groot Julientje', 'Groot Julientje', 10.40, 'frieten', null),
  -- Sauzen
  ('Mayonnaise', 'Mayonnaise', 1.10, 'sauzen', null),
  ('Ketchup tomaat', 'Ketchup tomaat', 1.10, 'sauzen', null),
  ('Ketchup curry', 'Ketchup curry', 1.10, 'sauzen', null),
  ('Tartaar', 'Tartaar', 1.20, 'sauzen', 'Huisbereid'),
  ('Pickles', 'Pickles', 1.10, 'sauzen', null),
  ('Americain', 'Americain', 1.10, 'sauzen', null),
  ('Samurai', 'Samurai', 1.10, 'sauzen', null),
  ('Cocktail', 'Cocktail', 1.10, 'sauzen', null),
  ('Andalouse', 'Andalouse', 1.10, 'sauzen', null),
  ('Loempiasaus', 'Loempiasaus', 1.10, 'sauzen', null),
  ('Mammoetsaus', 'Mammoetsaus', 1.10, 'sauzen', null),
  ('Bicky Saus', 'Geel Bicky Saus', 1.10, 'sauzen', null),
  ('Joppiesaus', 'Joppiesaus', 1.20, 'sauzen', null),
  ('Zigeunersaus', 'Zigeunersaus', 1.10, 'sauzen', null),
  ('Barbecuesaus', 'Barbecuesaus', 1.10, 'sauzen', null),
  ('Pepersaus', 'Pepersaus', 1.10, 'sauzen', null),
  ('Toscaanse saus', 'Toscaanse saus', 1.10, 'sauzen', null),
  ('Gele currysaus', 'Gele currysaus', 1.10, 'sauzen', null),
  ('Zoete Frietsaus', 'Zoete Frietsaus', 1.10, 'sauzen', null),
  ('Special saus (tomaat)', 'Special saus met tomatenketchup', 2.10, 'sauzen', null),
  ('Special saus (curry)', 'Special saus met curry ketchup', 2.10, 'sauzen', null),
  ('Potje satekruiden', 'Potje satekruiden', 0.50, 'sauzen', null),
  -- Huisbereid
  ('Stoofvlees', 'Stoofvlees', 7.00, 'huisbereid', null),
  ('Stoofvleessaus', 'Stoofvleessaus', 2.10, 'huisbereid', null),
  ('Balletjes in tomatensaus', 'Balletjes in tomatensaus', 6.80, 'huisbereid', null),
  ('Vol-au-vent', 'Vol-au-vent', 6.80, 'huisbereid', null),
  (null, 'Groot stoofvleessaus', 3.90, 'huisbereid', null),
  -- Snacks
  ('Frikandel', 'Frikandel', 2.40, 'snacks', null),
  ('Frikandel special', 'Frikandel special', 3.40, 'snacks', null),
  (null, 'Dynamite', 4.50, 'snacks', null),
  (null, 'Belcanto Crunch', 3.60, 'snacks', null),
  (null, 'Boxstaef', 4.20, 'snacks', null),
  ('Viandel', 'Viandel', 2.90, 'snacks', null),
  ('Viandel special', 'Viandel special', 3.90, 'snacks', null),
  ('Boulet', 'Boulet', 2.90, 'snacks', null),
  ('Boulet special', 'Boulet special', 3.90, 'snacks', null),
  ('Ardeense saté', 'Ardeense saté', 4.60, 'snacks', null),
  ('Bitterballen', 'Bitterballen', 2.90, 'snacks', null),
  ('Borrelmaatjes', 'Borrelmaatjes', 6.00, 'snacks', null),
  ('Crizly', 'Crizly', 4.70, 'snacks', null),
  ('Kipcorn', 'Kipcorn', 3.40, 'snacks', null),
  ('Inktvis ring', 'Inktvis ring', 4.00, 'snacks', null),
  ('Garnaalkroket', 'Garnaalkroket', 3.30, 'snacks', null),
  ('Gebakken Garnalen', 'Gebakken Garnalen', 6.20, 'snacks', null),
  ('Ribster', 'Ribster', 3.50, 'snacks', null),
  ('Kippenboutjes hofkip', 'Kippenboutjes hofkip', 4.90, 'snacks', null),
  ('Kipfingers', 'Kipfingers', 4.40, 'snacks', null),
  ('Kip kaas donut', 'Kip kaas donut', 3.10, 'snacks', null),
  ('Kaaskipcorn', 'Kaaskipcorn', 3.50, 'snacks', null),
  ('Kip kaas punt', 'Kip kaas punt', 3.50, 'snacks', null),
  ('Kippets (6st)', 'Kippets (6st)', 4.40, 'snacks', null),
  ('Loempia + saus', 'Loempia + saus', 5.10, 'snacks', null),
  ('Lookworst rood', 'Lookworst rood', 3.40, 'snacks', null),
  ('Lookworst rood special', 'Lookworst rood special', 4.40, 'snacks', null),
  ('Lookworst bruin', 'Lookworst bruin', 4.20, 'snacks', null),
  ('Lookworst bruin special', 'Lookworst bruin special', 5.20, 'snacks', null),
  ('Lucifer', 'Lucifer', 3.60, 'snacks', null),
  ('Mammoet zonder saus', 'Mammoet zonder saus', 2.90, 'snacks', null),
  ('Mammoet + saus', 'Mammoet + saus', 3.70, 'snacks', null),
  ('Mexicano', 'Mexicano', 3.50, 'snacks', null),
  ('Mini Kipsaté', 'Mini Kipsaté', 3.20, 'snacks', null),
  ('Chick ''n Chili', 'Chick ''n Chili', 3.50, 'snacks', null),
  ('Chicken tenders', 'Chicken tenders', 4.00, 'snacks', null),
  ('Saté klein', 'Saté klein', 4.10, 'snacks', null),
  ('Saté groot', 'Saté groot', 5.20, 'snacks', null),
  ('Ragouzi', 'Ragouzi', 3.50, 'snacks', null),
  ('Sito', 'Sito', 4.30, 'snacks', null),
  ('Taco', 'Taco', 4.40, 'snacks', null),
  ('Twijfelaar', 'Twijfelaar', 4.40, 'snacks', null),
  ('Visstick', 'Visstick', 4.30, 'snacks', null),
  ('Vleeskroket', 'Vleeskroket', 3.00, 'snacks', null),
  ('Zigeunerstick', 'Zigeunerstick', 3.60, 'snacks', null),
  ('Kipsaté', 'Kipsaté', 4.40, 'snacks', null),
  ('Spicy viandel', 'Spicy viandel', 3.00, 'snacks', null),
  ('Kippenballetjes (6st)', 'Kippenballetjes (6st)', 5.50, 'snacks', null),
  ('Belcrunch', 'Belcrunch', 3.60, 'snacks', null),
  ('Vuurvreter', 'Vuurvreter', 3.50, 'snacks', null),
  ('Mini megamix', 'Mini megamix', 5.20, 'snacks', null),
  ('Mini lucifer', 'Mini lucifer', 4.40, 'snacks', null),
  ('Mammoet special', 'Mammoet special', 3.90, 'snacks', null),
  ('Goulashkroket', 'Goulashkroket', 3.10, 'snacks', null),
  ('Boulet ajuin', 'Boulet ajuin', 3.90, 'snacks', null),
  ('Loempidel', 'Loempidel', 3.60, 'snacks', null),
  ('Topmix', 'Topmix', 6.90, 'snacks', null),
  -- Vegetarisch
  (null, 'Vegetarische frikandel', 2.90, 'vegetarisch', null),
  (null, 'Vegetarische frikandel special', 3.80, 'vegetarisch', null),
  ('Bamischijf', 'Bamischijf', 3.20, 'vegetarisch', null),
  ('Kaasballetjes', 'Kaasballetjes (5st)', 3.30, 'vegetarisch', null),
  ('Kaaskroket', 'Kaaskroket', 2.30, 'vegetarisch', null),
  ('Mini Bamiballetjes', 'Mini Bamiballetjes', 2.80, 'vegetarisch', null),
  ('Mini Loempias (8st)', 'Mini Loempia''s (8st)', 4.50, 'vegetarisch', null),
  ('Mini kaassouflesse', 'Mini kaassoufflé (4st)', 4.00, 'vegetarisch', null),
  ('Mozzarella fingers (5st)', 'Mozzarella fingers (5st)', 3.90, 'vegetarisch', null),
  ('Kaassouflesse', 'Kaassoufflé', 3.00, 'vegetarisch', null),
  ('K3 kaashartjes (3st)', 'K3 kaashartjes (3st)', 4.50, 'vegetarisch', null),
  -- Burgers
  ('Bicky burger', 'Bicky burger', 4.00, 'burgers', null),
  ('Bicky cheese', 'Bicky cheese', 4.40, 'burgers', null),
  ('Bicky Fish', 'Bicky Fish', 4.90, 'burgers', 'Met tartaarsaus en verse ajuin'),
  ('Bicky Crunchy Chicken', 'Bicky Crunchy Chicken', 4.50, 'burgers', null),
  ('Bicky v/h Huis', 'Bicky v/h Huis', 4.70, 'burgers', 'Met toscaanse saus en verse ajuin'),
  ('Bicky Rib', 'Bicky Rib', 5.00, 'burgers', 'Met andalousesaus'),
  ('Bicky vegi', 'Bicky vegi', 4.50, 'burgers', null),
  ('Bicky mexicano', 'Bicky mexicano', 5.00, 'burgers', null),
  ('Bicky Royale', 'Bicky Royale', 6.80, 'burgers', null),
  ('Hamburger natuur', 'Hamburger natuur', 3.60, 'burgers', 'Enkel vlees en broodje'),
  ('Hamburger tomatenketchup', 'Hamburger met enkel tomatenketchup', 3.80, 'burgers', null),
  ('Hamburger curry ketchup', 'Hamburger met enkel curry ketchup', 3.80, 'burgers', null),
  -- Spaghetti
  ('Spaghetti Kinder', 'Spaghetti Kinder', 9.00, 'spaghetti', null),
  ('Spaghetti Klein', 'Spaghetti Klein', 10.00, 'spaghetti', null),
  ('Spaghetti Groot', 'Spaghetti Groot', 11.00, 'spaghetti', null);

-- 1. Bestaande items aanpassen (zelfde id)
update public.frituur_items f
set name = m.naam, price = m.prijs, category = m.categorie, description = m.omschrijving
from nieuw_menu m
where m.oud is not null and f.name = m.oud;

-- 2. Nieuwe items toevoegen (en items waarvan de oude naam niet meer bestond)
insert into public.frituur_items (name, price, category, description)
select m.naam, m.prijs, m.categorie, m.omschrijving
from nieuw_menu m
where not exists (select 1 from public.frituur_items f where f.name = m.naam);

-- 3. Wat niet meer op het menu staat
delete from public.frituur_items where name in ('Frankfurter', 'Perlut');

commit;
