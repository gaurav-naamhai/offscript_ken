# Gather

An event workspace built with React, TypeScript, and Vite. It supports separate User and Organizer workflows without requiring sign-in during this prototype stage.

## Included workflows

- Organizers can create drafts, edit event information, publish or cancel events, choose public/private visibility, set open/approval/closed registration, set capacity, manage guest requests, check in guests, and export the active guest list as CSV.
- Users can browse public events, search and filter by category, open event details, save an event, RSVP or request approval, see their plans in My Events and Calendar, and download an `.ics` calendar entry.
- Event, saved-event, and guest state uses Supabase. Anonymous sessions preserve the no-sign-up experience while RLS keeps each visitor's saved events and RSVP data separated.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` creates the production site in `dist`. `npm run lint` runs the linter. `npm test` runs the unit and integration test suite.

## Email Reminder Feature

A standalone, backend-ready transactional email reminder module powered by **Brevo's official Transactional Email API** (`POST /v3/smtp/email`).

- `src/reminders/`: Domain models, Brevo API client, in-memory store adapter, transactional email template generators, and reminder service.
- Provides methods for event registration confirmation, batch upcoming-event reminder dispatch (`sendUpcomingReminders`), event updates, and cancellation notices.
- Prevents duplicate confirmation and reminder emails for the same registration.
- Safe error handling: transient retry policy (5xx/429), secret redaction, and protection for cancelled/expired events or invalid attendee emails.
- *Note:* Operates as an isolated backend module with an in-memory repository. It is not yet connected to a persistent database, live application UI, or automatic background cron daemon.

### Environment Variables

Configure these variables in your environment or `.env` file (see `.env.example`):

| Variable | Description | Default |
| --- | --- | --- |
| `BREVO_API_KEY` | Official Brevo API v3 key (`xkeysib-...`) | Required in live mode |
| `BREVO_SENDER_EMAIL` | Verified sender email address | `notifications@gather.app` |
| `BREVO_SENDER_NAME` | Sender display name | `Gather Events` |
| `BREVO_MOCK_MODE` | Set to `true` (or `1`) to mock email sends locally without calling Brevo | `false` (defaults to `true` during test runs) |

### Scheduling & Deployment

- **Scheduled Reminders Entrypoint**: Call `runReminderScheduler({ service })` or `startReminderInterval(service, 60000)` in `src/reminders/scheduler.ts`.
- **Recommended Schedule**: Run `runReminderScheduler` every 15 to 60 minutes via serverless cron (e.g. AWS EventBridge, Vercel Cron, GitHub Actions) or a background worker.
- **Production Setup**:
  1. Set `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and `BREVO_SENDER_NAME` in your server environment.
  2. Verify sender domain in the Brevo admin console.
  3. Ensure `BREVO_MOCK_MODE` is unset or `false`.
  4. Ensure `EmailReminderService` runs exclusively on the backend/server environment so `BREVO_API_KEY` is never bundled into client-side assets.

## Supabase setup

1. In **Authentication → Settings**, enable **Allow anonymous sign-ins**.
2. In the project SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). It creates `events`, `event_saves`, and `event_rsvps`, restricts access through RLS, and grants only the necessary authenticated permissions.
3. Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Never add a service-role or secret key to the frontend.

## Structure

- `src/App.tsx`: screen composition and hash-navigation subscription.
- `src/components/AppShell.tsx`: navigation, User / Organizer switch, and responsive shell.
- `src/components/EventCard.tsx` and `src/components/EventForm.tsx`: reusable discovery cards and organizer event editor.
- `src/features/events.tsx`: Supabase-backed event data provider, anonymous-session setup, and event actions.
- `src/lib/supabase.ts`: browser-safe Supabase client using the publishable key.
- `supabase/schema.sql`: one-time database schema, grants, and RLS policies.
- `src/features/event-utils.ts`: date, RSVP, capacity, and guest-list helpers.
- `src/features/workspace.ts`: typed routes and section definitions.
- `src/index.css`: shared design tokens and responsive styling.

Direct links such as `/#/organizer/calendar` work on static hosting. Browser back and forward work across sections. Switching modes preserves the current section. The mode switch is navigation only, not an authorization boundary.

## Design and verification

The interface follows `design/gather-concept.png`: a white sidebar, cool gray workspace, forest-green selected controls, Manrope typography, and an airy layout. All UI text, icons, and controls are implemented in React; the concept image is documentation only.

The redesign uses an image-led, editorial event surface with a warm white and plum palette, serif display type, and the generated event photograph in `public/images/moonlit-studio.png`. Desktop and mobile layouts were checked in the browser. Build succeeds; lint has one non-blocking React Fast Refresh warning.
