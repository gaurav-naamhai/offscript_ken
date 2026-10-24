# Gather

An event workspace built with React, TypeScript, and Vite. It supports separate User and Organizer workflows without requiring sign-in during this prototype stage.

## Included workflows

- Organizers can create drafts, edit event information, publish or cancel events, choose public/private visibility, set open/approval/closed registration, review registrations in the app, approve or reject applicants, mark attendance, and send reminders to all approved attendees or selected people.
- Users can browse public events, search and filter by category, open event details, save an event, register or request approval, see their registration decision, see their plans in My Events and Calendar, and download an `.ics` calendar entry.
- Visitors enter their contact details once. The app creates a silent browser session, then stores the profile, event ownership, saves, and registrations in Supabase with row-level security. Brevo is used later for event email.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` creates the production site in `dist`. `npm run lint` runs the linter. `npm test` runs the unit and integration test suite.

## Transactional email

Supabase remains the source of truth. `profiles` stores each signed-in member’s name and email. `event_registrations` records their pending, approved, rejected, or cancelled status, plus attended or no-show status. `email_campaigns` stores organizer-created reminder jobs, while `email_deliveries` records every individual Brevo delivery. A unique dedupe key prevents duplicates.

`supabase/functions/event-email/index.ts` is the server-only Brevo delivery function. The browser invokes it only after writing an RSVP or organizer-owned event change; the function re-checks the caller, reads the persisted rows, and then sends the email. No Brevo credential is ever included in the React bundle.

To activate delivery after deployment, set these **Supabase Edge Function secrets**:

| Secret | Purpose |
| --- | --- |
| `BREVO_API_KEY` | Brevo Transactional Email API key |
| `BREVO_SENDER_EMAIL` | Brevo-verified sender address |
| `BREVO_SENDER_NAME` | Sender display name |
| `REMINDER_CRON_SECRET` | Private token for the scheduled reminder caller |

Schedule the function once per hour with Supabase Cron/`pg_net` and the cron secret, calling it with the `run_scheduled_reminders` action. It sends reminder campaigns whose organizer-selected time has arrived.

## Supabase setup

1. In Supabase **Authentication → URL Configuration**, set the local site URL and allow `http://127.0.0.1:5173/**` and `http://localhost:5173/**` as redirect URLs. Add the deployed site URL before production.
2. In the project SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). It includes a migration from the earlier RSVP table to the current registration model.
3. In **Authentication → Providers**, enable **Anonymous Sign-ins**. This gives each browser a protected internal identifier without asking visitors to authenticate or sending a login email.
4. Run [`supabase/demo-events.sql`](supabase/demo-events.sql) to add six upcoming Mumbai technology and startup gatherings.
5. Deploy the `event-email` Edge Function, then set its secrets in the Supabase Dashboard. Do not put Brevo or service-role secrets in `.env.local`.
6. Keep client-side settings in `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and optionally `VITE_GEOAPIFY_API_KEY` for worldwide place search. The curated Mumbai suggestions work without Geoapify. Never put Brevo or service-role secrets in a `VITE_` variable.

## Structure

- `src/App.tsx`: screen composition and hash-navigation subscription.
- `src/components/AppShell.tsx`: navigation, User / Organizer switch, and responsive shell.
- `src/components/EventCard.tsx` and `src/components/EventForm.tsx`: reusable discovery cards and organizer event editor.
- `src/features/events.tsx`: Supabase Auth session, profile sync, event data, and event actions.
- `src/lib/supabase.ts`: browser-safe Supabase client using the publishable key.
- `supabase/schema.sql`: one-time database schema, grants, and RLS policies.
- `supabase/demo-events.sql`: idempotent Mumbai technology and startup demo listings.
- `supabase/profile-signup.sql`: role and phone fields for existing profile tables.
- `src/features/event-utils.ts`: date, RSVP, capacity, and guest-list helpers.
- `src/features/workspace.ts`: typed routes and section definitions.
- `src/index.css`: shared design tokens and responsive styling.

Direct links such as `/#/organizer/calendar` work on static hosting. Browser back and forward work across sections. Switching modes preserves the current section. The mode switch is navigation only, not an authorization boundary.

## Design and discovery

The current interface uses an image-led Gather Club design with nearby-event discovery, location search, radius filters, map view, event details, and attendee registration. Organizer-created events can store coordinates from place suggestions so location filtering works for real listings. Browser geolocation is requested only after the visitor chooses **Use my location**. The curated Mumbai listings include approximate coordinates for the demo flow.
