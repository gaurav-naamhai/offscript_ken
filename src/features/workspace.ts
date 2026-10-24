import { Bookmark, Calendar, CalendarDays, type LucideIcon } from 'lucide-react'

export type WorkspaceMode = 'user' | 'organizer'
export type SectionId = 'happening-events' | 'my-events' | 'calendar'
export type WorkspaceRoute = { mode: WorkspaceMode; section: SectionId; eventId?: string; create?: boolean; editId?: string }
export type Section = { id: SectionId; label: string; icon: LucideIcon }

export const navigation: Section[] = [
  { id: 'happening-events', label: 'Happening Events', icon: Calendar },
  { id: 'my-events', label: 'My Events', icon: Bookmark },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
]

export function getRoute(): WorkspaceRoute {
  const [modePart, pagePart, id] = window.location.hash.replace(/^#\/?/, '').split('/')
  const mode: WorkspaceMode = modePart === 'organizer' ? 'organizer' : 'user'
  if (mode === 'organizer' && pagePart === 'create') return { mode, section: 'my-events', create: true }
  if (mode === 'organizer' && pagePart === 'edit' && id) return { mode, section: 'my-events', editId: id }
  if (pagePart === 'event' && id) return { mode, section: mode === 'organizer' ? 'my-events' : 'happening-events', eventId: id }
  return { mode, section: navigation.some((item) => item.id === pagePart) ? pagePart as SectionId : 'happening-events' }
}

export const routeHref = ({ mode, section }: Pick<WorkspaceRoute, 'mode' | 'section'>) => `#/${mode}/${section}`
export const eventHref = (mode: WorkspaceMode, eventId: string) => `#/${mode}/event/${eventId}`
export const createHref = '#/organizer/create'
export const editHref = (eventId: string) => `#/organizer/edit/${eventId}`
