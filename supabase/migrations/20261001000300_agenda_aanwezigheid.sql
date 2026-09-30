-- =====================================================================
-- Agenda: aanwezigheid per leider per agenda-item (komt / komt niet / misschien)
-- Vereist: 20261001000100_rollen_en_rechten.sql (is_leiding)
-- =====================================================================

begin;

create table if not exists public.event_aanwezigheid (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('komt', 'komt_niet', 'misschien')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_aanwezigheid enable row level security;

create policy "leiding ziet aanwezigheid" on public.event_aanwezigheid for select using (public.is_leiding());
create policy "eigen aanwezigheid invullen" on public.event_aanwezigheid for insert
  with check (user_id = auth.uid() and public.is_leiding());
create policy "eigen aanwezigheid aanpassen" on public.event_aanwezigheid for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "eigen aanwezigheid wissen" on public.event_aanwezigheid for delete using (user_id = auth.uid());

commit;
