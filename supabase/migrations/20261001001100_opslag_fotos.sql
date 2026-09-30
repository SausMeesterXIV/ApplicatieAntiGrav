-- =====================================================================
-- Opslag (Supabase Storage): kastickets en profielfoto's
--  - receipts (kastickets): PRIVÉ. Enkel actieve leiding kan ze bekijken (via een tijdelijke link)
--    en uploaden; enkel Drankteam/hoofdleiding verwijdert.
--  - avatars (profielfoto's): blijven publiek zichtbaar (worden overal in de app getoond),
--    maar je kan enkel je EIGEN foto uploaden, vervangen of verwijderen (hoofdleiding: alle).
--    Bestandsnamen zijn <user-id>-<tijd>.<ext>.
-- Oude policies voor deze twee buckets worden eerst verwijderd.
-- Vereist: 20261001000100_rollen_en_rechten.sql
-- =====================================================================

begin;

-- 1. Buckets (bestaan normaal al; enkel de zichtbaarheid wordt gezet)
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
on conflict (id) do update set public = false;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 2. Oude policies op storage.objects die over deze buckets gaan
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(receipts|avatars)'
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- 3. Kastickets
create policy "leiding bekijkt kastickets" on storage.objects for select
  using (bucket_id = 'receipts' and public.is_leiding());
create policy "leiding uploadt kastickets" on storage.objects for insert
  with check (bucket_id = 'receipts' and public.is_leiding());
create policy "leiding vervangt kastickets" on storage.objects for update
  using (bucket_id = 'receipts' and public.is_leiding())
  with check (bucket_id = 'receipts' and public.is_leiding());
create policy "drankteam verwijdert kastickets" on storage.objects for delete
  using (bucket_id = 'receipts' and public.heeft_recht('drank_beheren'));

-- 4. Profielfoto's (lezen gaat via de publieke URL, daar is geen policy voor nodig)
create policy "leiding ziet profielfotos" on storage.objects for select
  using (bucket_id = 'avatars' and public.is_leiding());
create policy "eigen profielfoto uploaden" on storage.objects for insert
  with check (bucket_id = 'avatars' and name like auth.uid()::text || '-%' and public.is_leiding());
create policy "eigen profielfoto vervangen" on storage.objects for update
  using (bucket_id = 'avatars' and (name like auth.uid()::text || '-%' or public.is_hoofdleiding()))
  with check (bucket_id = 'avatars' and (name like auth.uid()::text || '-%' or public.is_hoofdleiding()));
create policy "eigen profielfoto verwijderen" on storage.objects for delete
  using (bucket_id = 'avatars' and (name like auth.uid()::text || '-%' or public.is_hoofdleiding()));

commit;

-- Controle: policies op storage.objects die NIET over een bucket gaan, gelden voor alle buckets
-- (en kunnen bovenstaande regels openzetten). Staat hier iets, bekijk het dan:
-- select policyname, cmd, qual, with_check from pg_policies
-- where schemaname = 'storage' and tablename = 'objects'
--   and (coalesce(qual, '') || coalesce(with_check, '')) !~ 'bucket_id';
