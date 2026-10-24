# Gather

A minimal React + TypeScript + Vite event workspace. User and Organizer each have Happening Events, My Events, and Calendar sections. These intentionally contain no event data, calendar data, authentication, forms, or API integrations yet.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` creates the production site in `dist`. `npm run lint` runs the linter.

## Structure

- `src/App.tsx`: screen composition and hash navigation subscription.
- `src/components/AppShell.tsx`: navigation, User / Organizer switch, and responsive shell.
- `src/components/EmptySection.tsx`: empty feature area; replace or extend this with future feature screens.
- `src/features/workspace.ts`: typed routes, section definitions, and mode-specific text.
- `src/index.css`: shared design tokens and responsive styling.

Direct links such as `/#/organizer/calendar` work on static hosting. Browser back and forward work across sections. Switching modes preserves the current section. The mode switch is navigation only, not an authorization boundary.

## Design

The primary screen follows `design/gather-concept.png`, generated with the built-in image tool. The brief: an airy event app with a white sidebar, cool gray workspace, forest-green selected controls, Manrope typography, User / Organizer switch, and three intentionally empty sections. All UI text, icons, and controls are implemented in React; the concept image is documentation only.

Tokens: background `#f7f8fa`, sidebar `#ffffff`, text `#202524`, accent `#1d5542`, selected navigation `#edf5f1`. Outline icons use Lucide. Mobile replaces the desktop rail with horizontal section navigation. Reduced-motion preferences and keyboard focus are supported.

## Verification

The frontend design skill shaped the image concept and implementation. The concept and final desktop/mobile captures were inspected with `view_image`. Desktop was checked at the concept's native 1505 × 1045 dimensions; mobile at 390 × 844. All six views, switching mode while keeping the current section, and browser back/forward were checked in the built-in browser. No browser errors or horizontal overflow were observed. Final screenshots use Playwright with installed Chrome because the built-in browser's display scaling clipped screenshot captures.

| Comparison | Concept and final render review |
| --- | --- |
| Layout | Sidebar width, open workspace, heading alignment, and mode switch follow the concept. |
| Typography | Heading scale was enlarged after comparison; Manrope provides consistent text and control styling. |
| Palette | White sidebar, cool gray workspace, and green selected states preserved. |
| Spacing | Empty-state circle enlarged and moved up to match the concept. |
| Icons | Outline calendar, bookmark, and compass metaphors preserved with Lucide. |
| Copy | Primary visible copy matches the concept; organizer and other section copy intentionally varies by context. |
| Responsive behavior | Mobile intentionally uses horizontal navigation and smaller text. |

No material visual mismatches remain against the selected design. The interface was faithfully verified against the concept, with font/icon geometry, flat rather than raster-textured surfaces, mode-specific copy, and mobile navigation as intentional implementation adaptations. Final previews are `design/gather-desktop.png` and `design/gather-mobile.png`.
