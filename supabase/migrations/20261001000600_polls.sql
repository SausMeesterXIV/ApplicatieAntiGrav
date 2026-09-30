-- =====================================================================
-- Polls (CLAUDE.md: Polls — nieuw)
--  - vraag met meerdere opties en een deadline
--  - resultaten zichtbaar voor alle leiding
--  - één stem per persoon, aan te passen tot de deadline
--  - maken: hoofdleiding + werkgroepen met het recht polls_maken
-- Vereist: 20261001000100_rollen_en_rechten.sql
-- =====================================================================

begin;

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  vraag text not null check (length(trim(vraag)) > 0),
  deadline timestamptz not null,
  gemaakt_door uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_opties (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  tekst text not null check (length(trim(tekst)) > 0),
  volgorde smallint not null default 0
);

create table if not exists public.poll_stemmen (
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  optie_id uuid not null references public.poll_opties(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index if not exists poll_opties_poll_idx on public.poll_opties(poll_id);

-- Een stem moet horen bij een optie van dezelfde poll, en de poll moet nog open zijn
create or replace function public.controleer_stem()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from poll_opties where id = new.optie_id and poll_id = new.poll_id) then
    raise exception 'Deze optie hoort niet bij deze poll';
  end if;
  if exists (select 1 from polls where id = new.poll_id and deadline <= now()) then
    raise exception 'De deadline van deze poll is voorbij';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists controleer_stem on public.poll_stemmen;
create trigger controleer_stem
  before insert or update on public.poll_stemmen
  for each row execute function public.controleer_stem();

-- RLS
alter table public.polls enable row level security;
alter table public.poll_opties enable row level security;
alter table public.poll_stemmen enable row level security;

create policy "leiding ziet polls" on public.polls for select using (public.is_leiding());
create policy "pollmakers maken polls" on public.polls for insert
  with check (public.heeft_recht('polls_maken') and gemaakt_door = auth.uid());
create policy "maker of hoofdleiding past poll aan" on public.polls for update
  using (gemaakt_door = auth.uid() or public.is_hoofdleiding());
create policy "maker of hoofdleiding verwijdert poll" on public.polls for delete
  using (gemaakt_door = auth.uid() or public.is_hoofdleiding());

create policy "leiding ziet opties" on public.poll_opties for select using (public.is_leiding());
create policy "maker beheert opties" on public.poll_opties for all
  using (exists (select 1 from polls p where p.id = poll_id and (p.gemaakt_door = auth.uid() or public.is_hoofdleiding())))
  with check (exists (select 1 from polls p where p.id = poll_id and (p.gemaakt_door = auth.uid() or public.is_hoofdleiding())));

create policy "leiding ziet stemmen" on public.poll_stemmen for select using (public.is_leiding());
create policy "zelf stemmen" on public.poll_stemmen for insert with check (user_id = auth.uid() and public.is_leiding());
create policy "eigen stem aanpassen" on public.poll_stemmen for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "eigen stem intrekken" on public.poll_stemmen for delete
  using (user_id = auth.uid() and exists (select 1 from polls p where p.id = poll_id and p.deadline > now()));

-- Melding naar alle leiding bij een nieuwe poll
create or replace function public.melding_nieuwe_poll()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  insert into notificaties (zender_id, ontvanger_id, titel, bericht, zender_naam, type, action)
  values (auth.uid(), 'all', 'Nieuwe poll: ' || new.vraag,
          'Stem voor ' || to_char(new.deadline at time zone 'Europe/Brussels', 'DD/MM/YYYY HH24:MI'),
          'Polls', 'poll', 'Stemmen');
  return new;
end;
$$;

drop trigger if exists melding_nieuwe_poll on public.polls;
create trigger melding_nieuwe_poll
  after insert on public.polls
  for each row execute function public.melding_nieuwe_poll();

commit;
