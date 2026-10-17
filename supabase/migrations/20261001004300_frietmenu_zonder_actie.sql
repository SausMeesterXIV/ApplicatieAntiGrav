-- De twee actie-items (vol-au-vent en balletjes in tomatensaus met frietjes en mayo) horen niet op het menu.
-- Ze werden net toegevoegd in 004200 en zijn nog nooit besteld.
delete from public.frituur_items
where category = 'actie'
  and name in ('Vol-au-vent met frietjes mayo', 'Balletjes in tomatensaus met frietjes en mayonaise');
