-- =====================================================================
-- Startscherm: volgorde van de bollen per leider
--  - lijst van bol-id's (bv. {friet,agenda,polls,...}) in de gekozen volgorde
--  - null = standaardvolgorde
--  - iedereen past enkel het eigen profiel aan (bestaande RLS op profiles)
-- =====================================================================

begin;

alter table public.profiles add column if not exists startscherm_bollen text[];

commit;
