-- =====================================================================
-- Werkgroep Kampleiding: alle rechten voor Team Drank, Agenda beheren, Financiën, Nieuwe poll en Berichten.
-- Niet voor Winkeltje en niet voor Rollen (dat blijft enkel hoofdleiding).
-- Hoofdleiding zet leiding in of uit deze werkgroep via Rollen & beheer, zoals elke andere werkgroep.
-- =====================================================================

insert into public.werkgroepen (naam, rechten)
select 'Kampleiding', array['drank_beheren', 'agenda_beheren', 'financien', 'polls_maken', 'berichten_sturen']
where not exists (select 1 from public.werkgroepen where lower(naam) = 'kampleiding');
