import { Bookmark, Calendar, CalendarDays, Compass, type LucideIcon } from 'lucide-react'

export type WorkspaceMode = 'user' | 'organizer'
export type SectionId = 'happening-events' | 'my-events' | 'calendar'
export type WorkspaceRoute = { mode: WorkspaceMode; section: SectionId }
type SectionCopy = { subtitle: string; emptyTitle: string; emptyDescription: string }
export type Section = SectionCopy & { id: SectionId; label: string; icon: LucideIcon; emptyIcon: LucideIcon }

// Future feature screens can replace EmptySection without changing routing.
export const navigation = [
  { id: 'happening-events', label: 'Happening Events', icon: Calendar, emptyIcon: Compass },
  { id: 'my-events', label: 'My Events', icon: Bookmark, emptyIcon: Bookmark },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, emptyIcon: CalendarDays },
] satisfies Pick<Section, 'id' | 'label' | 'icon' | 'emptyIcon'>[]

const copy: Record<WorkspaceMode, Record<SectionId, SectionCopy>> = {
  user: {
    'happening-events': { subtitle: 'Find your next good thing.', emptyTitle: 'A little quiet, for now.', emptyDescription: 'Events will appear here when they are added.' },
    'my-events': { subtitle: 'Your plans, all in one place.', emptyTitle: 'Room for your next memory.', emptyDescription: 'Your events will appear here when they are added.' },
    calendar: { subtitle: 'Make space for what matters.', emptyTitle: 'An open calendar. Endless possibilities.', emptyDescription: 'Your calendar will appear here when it is ready.' },
  },
  organizer: {
    'happening-events': { subtitle: 'A space for the events you bring to life.', emptyTitle: 'Great gatherings start somewhere.', emptyDescription: 'Your happening events will appear here when they are added.' },
    'my-events': { subtitle: 'From first idea to getting together.', emptyTitle: 'A home for your next event.', emptyDescription: 'The events you organize will appear here when they are added.' },
    calendar: { subtitle: 'Give your gatherings a place to grow.', emptyTitle: 'A fresh page for your plans.', emptyDescription: 'Your organizer calendar will appear here when it is ready.' },
  },
}

export function getRoute(): WorkspaceRoute {
  const [mode, section] = window.location.hash.replace(/^#\/?/, '').split('/')
  return {
    mode: mode === 'organizer' ? 'organizer' : 'user',
    section: navigation.some((item) => item.id === section) ? section as SectionId : 'happening-events',
  }
}

export function routeHref({ mode, section }: WorkspaceRoute): string {
  return `#/${mode}/${section}`
}

export function getSection(route: WorkspaceRoute): Section {
  const item = navigation.find((entry) => entry.id === route.section)!
  return { ...item, ...copy[route.mode][route.section] }
}
