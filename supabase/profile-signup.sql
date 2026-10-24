-- Add contact and role fields to profiles for passwordless Gather Club registration.
-- Run once in the Supabase SQL Editor if schema.sql was applied previously.
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text not null default 'attendee';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_role_check check (role in ('attendee', 'organizer'));
  end if;
end $$;
