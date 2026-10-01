-- =====================================================================
-- 1. Gelezen-status van meldingen per persoon (op elk toestel dezelfde)
--    Meldingen aan iedereen ('all') hebben geen eigen gelezen-vlag per leider; die bewaren we
--    hier. Persoonlijke meldingen houden hun kolom notificaties.gelezen.
-- 2. Hoogstens één lopende frietronde tegelijk (ook als twee mensen tegelijk op "Openen" tikken)
-- =====================================================================

begin;

-- 1. Gelezen
create table if not exists public.notificatie_gelezen (
  notificatie_id uuid not null references public.notificaties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  gelezen_op timestamptz not null default now(),
  primary key (notificatie_id, user_id)
);

alter table public.notificatie_gelezen enable row level security;

create policy "eigen gelezen-status lezen" on public.notificatie_gelezen for select
  using (user_id = auth.uid());
create policy "eigen gelezen-status zetten" on public.notificatie_gelezen for insert
  with check (user_id = auth.uid() and public.is_leiding());
create policy "eigen gelezen-status wissen" on public.notificatie_gelezen for delete
  using (user_id = auth.uid());

grant select, insert, delete on public.notificatie_gelezen to authenticated;

-- 2. Eén lopende frietronde: een tweede insert met een actieve status faalt (unieke index)
create unique index if not exists een_lopende_frietronde
  on public.frituur_sessies ((true))
  where status in ('open', 'ordering', 'ordered');

commit;
