# Gather

An event workspace built with React, TypeScript, and Vite. It supports separate User and Organizer workflows without requiring sign-in during this prototype stage.

## Included workflows

- Organizers can create drafts, edit event information, publish or cancel events, choose public/private visibility, set open/approval/closed registration, set capacity, manage guest requests, check in guests, and export the active guest list as CSV.
- Users can browse public events, search and filter by category, open event details, save an event, RSVP or request approval, see their plans in My Events and Calendar, and download an `.ics` calendar entry.
- Event, saved-event, and guest state persists in this browser using local storage, so the full flow can be tried without credentials. Supabase will replace this local data layer next.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` creates the production site in `dist`. `npm run lint` runs the linter.

## Structure

- `src/App.tsx`: screen composition and hash-navigation subscription.
- `src/components/AppShell.tsx`: navigation, User / Organizer switch, and responsive shell.
- `src/components/EventCard.tsx` and `src/components/EventForm.tsx`: reusable discovery cards and organizer event editor.
- `src/features/events.tsx`: local event data provider and actions, ready to be swapped for a Supabase repository.
- `src/features/event-utils.ts`: date, RSVP, capacity, and guest-list helpers.
- `src/features/workspace.ts`: typed routes and section definitions.
- `src/index.css`: shared design tokens and responsive styling.

Direct links such as `/#/organizer/calendar` work on static hosting. Browser back and forward work across sections. Switching modes preserves the current section. The mode switch is navigation only, not an authorization boundary.

## Design and verification

The interface follows `design/gather-concept.png`: a white sidebar, cool gray workspace, forest-green selected controls, Manrope typography, and an airy layout. All UI text, icons, and controls are implemented in React; the concept image is documentation only.

The desktop and mobile shell, plus the end-to-end event flow, were checked in the browser. The tested path was: create and publish an event, discover it as a user, save and RSVP, verify My Events and Calendar, then check in the guest as an organizer. Build and lint both pass. Final previews are `design/gather-desktop.png`, `design/gather-mobile.png`, and `design/gather-features.png`.
