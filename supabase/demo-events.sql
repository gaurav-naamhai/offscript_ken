-- Gather Club sample listings for Mumbai. Run after schema.sql.
-- These are club-curated demo listings and do not belong to an individual organizer.
alter table public.events alter column owner_id drop not null;

with demo_events(title, description, starts_at, ends_at, location, category, capacity, image_url, latitude, longitude) as (
  values
    (
      'Mumbai AI Builders Night',
      'A friendly evening for people building with AI. Bring a small demo, a curious question, or just yourself. Short lightning talks, open conversation, and chai between sessions.',
      '2026-11-06 18:30:00+05:30'::timestamptz,
      '2026-11-06 21:00:00+05:30'::timestamptz,
      'WeWork, Bandra Kurla Complex, Mumbai',
      'Technology', 60,
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85', 19.0677, 72.8691
    ),
    (
      'Product & Engineering Social',
      'A low-key meetup for product thinkers and engineers. Swap notes on what you are shipping, what you are learning, and what you wish more teams talked about.',
      '2026-11-14 16:00:00+05:30'::timestamptz,
      '2026-11-14 19:00:00+05:30'::timestamptz,
      'The Quorum, Lower Parel, Mumbai',
      'Technology', 45,
      'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1200&q=85', 18.9945, 72.8246
    ),
    (
      'Mumbai Open Source Social',
      'Meet local maintainers, first-time contributors, and the people who make useful things on the internet. Come with a project or find one to help with.',
      '2026-11-20 19:00:00+05:30'::timestamptz,
      '2026-11-20 21:30:00+05:30'::timestamptz,
      'Social, Khar West, Mumbai',
      'Technology', 50,
      'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85', 19.0726, 72.8373
    ),
    (
      'Founders’ Breakfast: Your First 100 Customers',
      'An honest breakfast conversation about finding the first people who care. Hear how Mumbai founders tested their way to early traction, then trade notes over coffee.',
      '2026-11-07 10:00:00+05:30'::timestamptz,
      '2026-11-07 12:00:00+05:30'::timestamptz,
      'The Pantry, Kala Ghoda, Mumbai',
      'Startup & Founders', 24,
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=85', 18.9275, 72.8324
    ),
    (
      'Mumbai Startup Pitch & Pour',
      'Five early-stage teams, five short pitches, and an open room of builders and backers. Stay after for thoughtful questions and a relaxed drink.',
      '2026-11-12 18:30:00+05:30'::timestamptz,
      '2026-11-12 21:00:00+05:30'::timestamptz,
      'Jio World Drive, Bandra Kurla Complex, Mumbai',
      'Startup & Founders', 80,
      'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=85', 19.0595, 72.8526
    ),
    (
      'Build in Public Demo Evening',
      'A small stage for projects that are still in progress. Share what you made, what surprised you, and what comes next. Side projects and first launches are very welcome.',
      '2026-11-21 16:00:00+05:30'::timestamptz,
      '2026-11-21 19:00:00+05:30'::timestamptz,
      'WeWork, Andheri East, Mumbai',
      'Startup & Founders', 55,
      'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=85', 19.1156, 72.8697
    )
)
insert into public.events (owner_id, title, description, start_at, end_at, location, category, capacity, visibility, registration, status, image_url, latitude, longitude)
select null, demo.title, demo.description, demo.starts_at, demo.ends_at, demo.location, demo.category, demo.capacity, 'public', 'open', 'published', demo.image_url, demo.latitude, demo.longitude
from demo_events as demo
where not exists (
  select 1
  from public.events as existing
  where existing.title = demo.title
    and existing.start_at = demo.starts_at
    and existing.location = demo.location
);
