-- =====================================================================
-- Agenda voor iedereen, bijlagen en verslagen van groepsraden
--
-- Agenda:
--  - alle leiding kan agenda-items toevoegen
--  - aanpassen: wie het item maakte, plus hoofdleiding en werkgroepen met agenda_beheren (Sfeerbeheer)
--  - verwijderen: enkel je eigen items; hoofdleiding kan alles verwijderen
--  - bestaande items zonder maker kan enkel hoofdleiding (of agenda_beheren: aanpassen) beheren
--  - aftelklokken blijven voor agenda_beheren
--
-- Verslagen (groepsraden):
--  - alle leiding leest en schrijft verslagen, optioneel gekoppeld aan een agenda-item
--  - aanpassen/verwijderen: de auteur en hoofdleiding
--  - melding naar alle leiding bij een nieuw verslag
--
-- Bijlagen (bv. intro voor de groepsraad, pdf van een verslag):
--  - bij een agenda-item of een verslag; privé-opslag (bucket 'bijlagen', max 10 MB per bestand)
--  - alle leiding kan ze openen (tijdelijke link)
--  - toevoegen: wie het agenda-item/verslag mag aanpassen
--  - verwijderen: wie de bijlage uploadde, wie het item/verslag mag aanpassen, of hoofdleiding
--
-- Vereist: 20261001000100_rollen_en_rechten.sql, 20261001000200_rls_policies.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Agenda: maker bijhouden en rechten
-- ---------------------------------------------------------------------
alter table public.events add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.events alter column created_by set default auth.uid();

-- De maker van een item kan achteraf niet veranderen
create or replace function public.bewaar_maker_event()
returns trigger language plpgsql as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

drop trigger if exists bewaar_maker_event on public.events;
create trigger bewaar_maker_event
  before update on public.events
  for each row execute function public.bewaar_maker_event();

drop policy if exists "leiding leest events" on public.events;
drop policy if exists "agendabeheer schrijft events" on public.events;
drop policy if exists "leiding maakt events" on public.events;
drop policy if exists "maker of agendabeheer past events aan" on public.events;
drop policy if exists "maker of hoofdleiding verwijdert events" on public.events;

create policy "leiding leest events" on public.events for select using (public.is_leiding());
create policy "leiding maakt events" on public.events for insert
  with check (public.is_leiding() and created_by = auth.uid());
create policy "maker of agendabeheer past events aan" on public.events for update
  using (public.is_leiding() and (created_by = auth.uid() or public.heeft_recht('agenda_beheren')))
  with check (public.is_leiding() and (created_by = auth.uid() or public.heeft_recht('agenda_beheren')));
create policy "maker of hoofdleiding verwijdert events" on public.events for delete
  using (public.is_leiding() and (created_by = auth.uid() or public.is_hoofdleiding()));

-- ---------------------------------------------------------------------
-- 2. Verslagen
-- ---------------------------------------------------------------------
create table if not exists public.verslagen (
  id uuid primary key default gen_random_uuid(),
  titel text not null check (length(trim(titel)) > 0),
  datum date not null default current_date,
  inhoud text,
  event_id uuid references public.events(id) on delete set null,
  auteur_id uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verslagen_datum_idx on public.verslagen(datum desc);

create or replace function public.verslag_bijwerken()
returns trigger language plpgsql as $$
begin
  new.auteur_id := old.auteur_id;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists verslag_bijwerken on public.verslagen;
create trigger verslag_bijwerken
  before update on public.verslagen
  for each row execute function public.verslag_bijwerken();

alter table public.verslagen enable row level security;

create policy "leiding leest verslagen" on public.verslagen for select using (public.is_leiding());
create policy "leiding schrijft verslagen" on public.verslagen for insert
  with check (public.is_leiding() and auteur_id = auth.uid());
create policy "auteur of hoofdleiding past verslag aan" on public.verslagen for update
  using (public.is_leiding() and (auteur_id = auth.uid() or public.is_hoofdleiding()))
  with check (public.is_leiding() and (auteur_id = auth.uid() or public.is_hoofdleiding()));
create policy "auteur of hoofdleiding verwijdert verslag" on public.verslagen for delete
  using (public.is_leiding() and (auteur_id = auth.uid() or public.is_hoofdleiding()));

create or replace function public.melding_nieuw_verslag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
  values (auth.uid(), 'all', 'Nieuw verslag: ' || new.titel,
          'Verslag van ' || to_char(new.datum, 'DD/MM/YYYY') || ' staat in de app.',
          coalesce((select coalesce(nullif(nickname, ''), naam) from profiles where id = auth.uid()), 'Verslagen'),
          'verslag', 'Lezen|/verslagen');
  return new;
end;
$$;

drop trigger if exists melding_nieuw_verslag on public.verslagen;
create trigger melding_nieuw_verslag
  after insert on public.verslagen
  for each row execute function public.melding_nieuw_verslag();

-- ---------------------------------------------------------------------
-- 3. Bijlagen
-- ---------------------------------------------------------------------
create table if not exists public.bijlagen (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  verslag_id uuid references public.verslagen(id) on delete cascade,
  pad text not null unique,
  naam text not null,
  grootte bigint,
  mime text,
  geupload_door uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint bijlage_hoort_bij_een_item check (num_nonnulls(event_id, verslag_id) = 1)
);

create index if not exists bijlagen_event_idx on public.bijlagen(event_id);
create index if not exists bijlagen_verslag_idx on public.bijlagen(verslag_id);

-- Mag de ingelogde leider het agenda-item of verslag aanpassen (en dus bijlagen beheren)?
create or replace function public.mag_item_aanpassen(p_event_id uuid, p_verslag_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_leiding() and (
    (p_event_id is not null and exists (
      select 1 from events e where e.id = p_event_id
        and (e.created_by = auth.uid() or public.heeft_recht('agenda_beheren'))))
    or
    (p_verslag_id is not null and exists (
      select 1 from verslagen v where v.id = p_verslag_id
        and (v.auteur_id = auth.uid() or public.is_hoofdleiding())))
  );
$$;

revoke all on function public.mag_item_aanpassen(uuid, uuid) from public, anon;
grant execute on function public.mag_item_aanpassen(uuid, uuid) to authenticated;

alter table public.bijlagen enable row level security;

create policy "leiding ziet bijlagen" on public.bijlagen for select using (public.is_leiding());
create policy "beheerder voegt bijlage toe" on public.bijlagen for insert
  with check (geupload_door = auth.uid() and public.mag_item_aanpassen(event_id, verslag_id));
create policy "uploader, beheerder of hoofdleiding verwijdert bijlage" on public.bijlagen for delete
  using (
    public.is_leiding() and (
      geupload_door = auth.uid() or public.is_hoofdleiding() or public.mag_item_aanpassen(event_id, verslag_id)
    )
  );

-- ---------------------------------------------------------------------
-- 4. Opslag voor bijlagen (privé, max 10 MB)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('bijlagen', 'bijlagen', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "leiding opent bijlagen" on storage.objects;
drop policy if exists "leiding uploadt bijlagen" on storage.objects;
drop policy if exists "bijlagen verwijderen" on storage.objects;

create policy "leiding opent bijlagen" on storage.objects for select
  using (bucket_id = 'bijlagen' and public.is_leiding());
create policy "leiding uploadt bijlagen" on storage.objects for insert
  with check (bucket_id = 'bijlagen' and public.is_leiding());
-- Verwijderen: wie uploadde, hoofdleiding, of wie de bijhorende bijlage mag verwijderen
create policy "bijlagen verwijderen" on storage.objects for delete
  using (
    bucket_id = 'bijlagen' and public.is_leiding() and (
      owner = auth.uid() or public.is_hoofdleiding()
      or exists (
        select 1 from public.bijlagen b
        where b.pad = storage.objects.name
          and (b.geupload_door = auth.uid() or public.mag_item_aanpassen(b.event_id, b.verslag_id))
      )
    )
  );

commit;
