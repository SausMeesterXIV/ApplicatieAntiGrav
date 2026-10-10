-- Opkuis vóór de testavond (Supabase SQL Editor). ONOMKEERBAAR: maak eerst een backup.
--  - Alle accounts weg, behalve it.takes.jaguarke@gmail.com (dat wordt godmode = hoofdleiding, buiten de leiding)
--    Met een account verdwijnen ook: profiel, strepen, facturen, frietbestellingen, meldingen, stemmen,
--    aanwezigheden en pushabonnementen van die persoon. Agenda-items, verslagen en polls blijven (zonder maker).
--  - Alle strepen, facturen, correcties en drankperiodes weg; voorraad op 0; één nieuwe open periode.
--  - Niemand heeft nog een groep of werkgroep (de werkgroepen zelf, bv. Drankteam, blijven bestaan).
-- Stopt zonder iets te wijzigen als het godmode-account niet bestaat.

begin;

do $$
declare
  v_god uuid;
begin
  select id into v_god from auth.users where lower(email) = 'it.takes.jaguarke@gmail.com';
  if v_god is null then
    raise exception 'Account it.takes.jaguarke@gmail.com bestaat niet: registreer het eerst in de app. Er is niets gewijzigd.';
  end if;

  -- 1. Godmode eerst (anders blokkeert "er moet altijd een hoofdleiding zijn" het verwijderen)
  insert into public.profiles (id, naam, email, rol, actief)
  select id, 'Godmode', email, 'godmode', true from auth.users where id = v_god
  on conflict (id) do nothing;
  update public.profiles set is_hoofdleiding = true, actief = true, rol = 'godmode' where id = v_god;
  delete from public.profiel_groepen where profile_id = v_god;
  delete from public.profiel_werkgroepen where profile_id = v_god;

  -- 2. Strepen en alles wat erbij hoort
  delete from public.consumpties;
  delete from public.billing_corrections;
  delete from public.facturen;
  delete from public.voorraad_correcties;
  delete from public.billing_periods;
  update public.dranken set huidige_voorraad = 0;

  -- 3. Alle andere accounts (profielen en hun gegevens volgen via cascade)
  delete from auth.users where id <> v_god;

  -- 4. Eén nieuwe open periode, zodat er gestreept kan worden
  insert into public.billing_periods (naam, start_datum, is_closed, geschatte_kost, werkjaar)
  values ('Testavond ' || to_char(current_date, 'DD/MM/YYYY'), now(), false, 0,
          case when extract(month from current_date) < 8
                 or (extract(month from current_date) = 8 and extract(day from current_date) < 15)
               then (extract(year from current_date)::int - 1) || '-' || extract(year from current_date)::int
               else extract(year from current_date)::int || '-' || (extract(year from current_date)::int + 1) end);
end $$;

commit;

-- Controle
select (select count(*) from auth.users) as accounts,
       (select count(*) from public.profiles) as profielen,
       (select count(*) from public.consumpties) as strepen,
       (select count(*) from public.facturen) as facturen,
       (select count(*) from public.profiel_werkgroepen) + (select count(*) from public.profiel_groepen) as rollen,
       (select string_agg(naam, ', ') from public.billing_periods where not is_closed) as open_periode;
select email, rol, is_hoofdleiding, actief from public.profiles;
