-- Run once in the Supabase SQL Editor for the Gather project.
-- This schema is safe for a new project and migrates the earlier event_rsvps table when present.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default 'Gather member',
  phone text,
  role text not null default 'attendee' check (role in ('attendee', 'organizer')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists display_name text not null default 'Gather member';
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text not null default 'attendee';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
create unique index if not exists profiles_email_unique on public.profiles (lower(email)) where email is not null;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz,
  location text not null default '',
  latitude double precision,
  longitude double precision,
  category text not null default 'Community',
  capacity integer check (capacity is null or capacity > 0),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  registration text not null default 'open' check (registration in ('open', 'approval', 'closed')),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  image_url text not null default '/images/moonlit-studio.png',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events add column if not exists latitude double precision;
alter table public.events add column if not exists longitude double precision;

create table if not exists public.event_saves (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- One row represents one person's application to one event.
create table if not exists public.event_registrations (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attendee_name text not null,
  attendee_email text not null,
  registration_status text not null default 'pending' check (registration_status in ('pending', 'approved', 'rejected', 'cancelled')),
  attendance_status text not null default 'not_marked' check (attendance_status in ('not_marked', 'attended', 'no_show')),
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  attendance_marked_at timestamptz,
  attendance_marked_by uuid references auth.users(id) on delete set null,
  organizer_note text,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Carry data forward if the original RSVP table was already applied.
do $$
begin
  if to_regclass('public.event_rsvps') is not null then
    insert into public.event_registrations (
      event_id, user_id, attendee_name, attendee_email, registration_status, attendance_status, applied_at
    )
    select event_id, user_id, coalesce(attendee_name, 'Gather member'), coalesce(attendee_email, ''),
      case status when 'going' then 'approved' when 'requested' then 'pending' else 'rejected' end,
      case when checked_in then 'attended' else 'not_marked' end,
      created_at
    from public.event_rsvps
    on conflict (event_id, user_id) do nothing;
  end if;
end $$;

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reminder', 'event_update', 'cancellation')),
  audience text not null check (audience in ('approved_all', 'selected')),
  selected_user_ids uuid[] not null default '{}',
  scheduled_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.email_campaigns(id) on delete set null,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('registration_pending', 'registration_approved', 'registration_rejected', 'event_update', 'cancellation', 'reminder')),
  dedupe_key text not null unique,
  recipient_email text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Upgrade an existing email-delivery table from the earlier prototype.
alter table public.email_deliveries add column if not exists campaign_id uuid references public.email_campaigns(id) on delete set null;
alter table public.email_deliveries drop constraint if exists email_deliveries_kind_check;
alter table public.email_deliveries add constraint email_deliveries_kind_check check (kind in ('registration_pending', 'registration_approved', 'registration_rejected', 'event_update', 'cancellation', 'reminder')) not valid;

create index if not exists events_discovery_idx on public.events (status, visibility, start_at);
create index if not exists registrations_event_idx on public.event_registrations (event_id, registration_status);
create index if not exists registrations_user_idx on public.event_registrations (user_id, applied_at desc);
create index if not exists email_campaigns_due_idx on public.email_campaigns (status, scheduled_at);
create index if not exists email_deliveries_event_idx on public.email_deliveries (event_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at before update on public.events for each row execute function public.set_updated_at();
drop trigger if exists set_registrations_updated_at on public.event_registrations;
create trigger set_registrations_updated_at before update on public.event_registrations for each row execute function public.set_updated_at();

revoke all on public.profiles, public.events, public.event_saves, public.event_registrations, public.email_campaigns, public.email_deliveries from anon;
revoke all on public.email_campaigns, public.email_deliveries from authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.event_saves to authenticated;
grant select, insert, update on public.event_registrations to authenticated;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_saves enable row level security;
alter table public.event_registrations enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_deliveries enable row level security;

drop policy if exists "read own profile" on public.profiles;
drop policy if exists "insert own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

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

drop policy if exists "read own or managed registrations" on public.event_registrations;
drop policy if exists "apply to open events" on public.event_registrations;
drop policy if exists "organizers manage registrations" on public.event_registrations;
create policy "read own or managed registrations" on public.event_registrations for select to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid()))
);
create policy "apply to open events" on public.event_registrations for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.events e where e.id = event_id and e.status = 'published' and e.registration in ('open', 'approval')
  )
);
create policy "organizers manage registrations" on public.event_registrations for update to authenticated using (
  exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid()))
) with check (
  exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid()))
);

-- Public poster images can be read by signed-in visitors. Uploads stay under the owner's UID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-posters', 'event-posters', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "read event posters" on storage.objects;
drop policy if exists "upload own event posters" on storage.objects;
drop policy if exists "update own event posters" on storage.objects;
drop policy if exists "delete own event posters" on storage.objects;
create policy "read event posters" on storage.objects for select to anon, authenticated using (bucket_id = 'event-posters');
create policy "upload own event posters" on storage.objects for insert to authenticated with check (bucket_id = 'event-posters' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "update own event posters" on storage.objects for update to authenticated using (bucket_id = 'event-posters' and (storage.foldername(name))[1] = (select auth.uid()::text)) with check (bucket_id = 'event-posters' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "delete own event posters" on storage.objects for delete to authenticated using (bucket_id = 'event-posters' and (storage.foldername(name))[1] = (select auth.uid()::text));
