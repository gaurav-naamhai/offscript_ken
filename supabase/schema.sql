-- Run once in the Supabase SQL Editor for the Gather project.
create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz,
  location text not null default '',
  category text not null default 'Community',
  capacity integer check (capacity is null or capacity > 0),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  registration text not null default 'open' check (registration in ('open', 'approval', 'closed')),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  image_url text not null default '/images/moonlit-studio.png',
  created_at timestamptz not null default now()
);

create table if not exists public.event_saves (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('going', 'requested', 'declined')),
  checked_in boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists events_discovery_idx on public.events (status, visibility, start_at);
create index if not exists event_rsvps_event_idx on public.event_rsvps (event_id);

revoke all on public.events, public.event_saves, public.event_rsvps from anon;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.event_saves to authenticated;
grant select, insert, update, delete on public.event_rsvps to authenticated;

alter table public.events enable row level security;
alter table public.event_saves enable row level security;
alter table public.event_rsvps enable row level security;

drop policy if exists "read discoverable or owned events" on public.events;
drop policy if exists "create own events" on public.events;
drop policy if exists "manage own events" on public.events;
drop policy if exists "delete own events" on public.events;
create policy "read discoverable or owned events" on public.events for select to authenticated using (owner_id = (select auth.uid()) or (status = 'published' and visibility = 'public'));
create policy "create own events" on public.events for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "manage own events" on public.events for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "delete own events" on public.events for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "manage own saves" on public.event_saves;
create policy "manage own saves" on public.event_saves for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "read own or managed rsvps" on public.event_rsvps;
drop policy if exists "create own rsvps" on public.event_rsvps;
drop policy if exists "attendees update own rsvps" on public.event_rsvps;
drop policy if exists "organizers manage event rsvps" on public.event_rsvps;
drop policy if exists "attendees delete own rsvps" on public.event_rsvps;
create policy "read own or managed rsvps" on public.event_rsvps for select to authenticated using (user_id = (select auth.uid()) or exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid())));
create policy "create own rsvps" on public.event_rsvps for insert to authenticated with check (user_id = (select auth.uid()));
create policy "attendees update own rsvps" on public.event_rsvps for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "organizers manage event rsvps" on public.event_rsvps for update to authenticated using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid()))) with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid())));
create policy "attendees delete own rsvps" on public.event_rsvps for delete to authenticated using (user_id = (select auth.uid()));
