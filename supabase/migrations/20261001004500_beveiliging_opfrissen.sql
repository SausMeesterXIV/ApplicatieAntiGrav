-- =====================================================================
-- Veiligheidscontrole oktober 2026 (Supabase-adviseurs + eigen controle)
--
-- 1. controleer_resetcode: enkel de edge function wachtwoord-reset (service role) mag ze aanroepen.
--    Nu kon elke ingelogde gebruiker andermans resetcode "opgebruiken".
-- 2. Vaste search_path voor twee functies (advies function_search_path_mutable).
-- 3. Opslag: profielfoto's enkel afbeeldingen tot 5 MB, kastickets enkel afbeelding/PDF tot 10 MB.
-- 4. Oude uploadregel van de ongebruikte map 'invoices' weg (gebaseerd op de oude kolom profiles.rol).
-- 5. Dubbele index op consumpties weg (idx_consumpties_user_factuur bestaat al met dezelfde definitie).
-- =====================================================================

begin;

-- 1
revoke execute on function public.controleer_resetcode(text, text) from public, anon, authenticated;
grant execute on function public.controleer_resetcode(text, text) to service_role;

-- 2
alter function public.groep_werkjaar(date) set search_path = public;
alter function public.aankoopfactuur_bijgewerkt() set search_path = public;

-- 3
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']
where id = 'avatars';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
where id = 'receipts';

-- 4
drop policy if exists "Team drank can upload invoices" on storage.objects;

-- 5
drop index if exists public.idx_consumpties_user_id;

commit;
