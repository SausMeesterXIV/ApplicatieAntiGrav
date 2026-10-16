-- =====================================================================
-- Aankoopfacturen: facturen die KSA krijgt (brouwer, drankcentrale, ...)
--
-- Per factuur: leverancier, bedrag, mededeling, factuurdatum, betaald ja/nee en een foto of PDF.
-- Elke factuur hoort bij een drankperiode, zo staan ze in de app per periode gebundeld.
-- Team Drank en Financiën (en hoofdleiding) mogen ze invoeren, aanpassen, bekijken en verwijderen.
-- De foto's staan in een privé-bucket 'aankoopfacturen' (max. 10 MB, afbeelding of PDF).
-- =====================================================================

begin;

create or replace function public.mag_aankoopfacturen()
returns boolean language sql stable security definer set search_path = public as $$
  select public.heeft_recht('drank_beheren') or public.heeft_recht('financien');
$$;
revoke all on function public.mag_aankoopfacturen() from public, anon;
grant execute on function public.mag_aankoopfacturen() to authenticated;

create table if not exists public.aankoopfacturen (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.billing_periods(id) on delete restrict,
  leverancier text not null check (length(trim(leverancier)) between 1 and 80),
  bedrag numeric(10, 2) not null check (bedrag >= 0),
  mededeling text check (mededeling is null or length(mededeling) <= 140),
  factuurdatum date,
  betaald boolean not null default false,
  notitie text check (notitie is null or length(notitie) <= 500),
  foto_pad text,
  aangemaakt_door uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aankoopfacturen_periode on public.aankoopfacturen (period_id);

alter table public.aankoopfacturen enable row level security;
revoke all on public.aankoopfacturen from anon;
grant select, insert, update, delete on public.aankoopfacturen to authenticated;

drop policy if exists "drankteam en financien beheren aankoopfacturen" on public.aankoopfacturen;
create policy "drankteam en financien beheren aankoopfacturen" on public.aankoopfacturen for all
  using (public.mag_aankoopfacturen())
  with check (public.mag_aankoopfacturen());

create or replace function public.aankoopfactuur_bijgewerkt()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists aankoopfactuur_bijgewerkt on public.aankoopfacturen;
create trigger aankoopfactuur_bijgewerkt before update on public.aankoopfacturen
  for each row execute function public.aankoopfactuur_bijgewerkt();

-- Foto's en PDF's
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aankoopfacturen', 'aankoopfacturen', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "aankoopfacturen bekijken" on storage.objects;
create policy "aankoopfacturen bekijken" on storage.objects for select
  using (bucket_id = 'aankoopfacturen' and public.mag_aankoopfacturen());
drop policy if exists "aankoopfacturen uploaden" on storage.objects;
create policy "aankoopfacturen uploaden" on storage.objects for insert
  with check (bucket_id = 'aankoopfacturen' and public.mag_aankoopfacturen());
drop policy if exists "aankoopfacturen vervangen" on storage.objects;
create policy "aankoopfacturen vervangen" on storage.objects for update
  using (bucket_id = 'aankoopfacturen' and public.mag_aankoopfacturen())
  with check (bucket_id = 'aankoopfacturen' and public.mag_aankoopfacturen());
drop policy if exists "aankoopfacturen verwijderen" on storage.objects;
create policy "aankoopfacturen verwijderen" on storage.objects for delete
  using (bucket_id = 'aankoopfacturen' and public.mag_aankoopfacturen());

notify pgrst, 'reload schema';

commit;
