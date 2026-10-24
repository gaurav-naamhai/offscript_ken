import { Bookmark, MapPin, Users } from 'lucide-react'
import { type EventRecord } from '../features/events'
import { dateLabel } from '../features/event-utils'
import { eventHref, type WorkspaceMode } from '../features/workspace'

export function EventCard({ event, mode, saved, guestCount, onSave }: { event: EventRecord; mode: WorkspaceMode; saved: boolean; guestCount: number; onSave?: () => void }) {
  return <article className="event-card">
    <a className="event-card-main" href={eventHref(mode, event.id)}>
      <div className="event-card-date">{dateLabel(event.startDate, event.startTime)}</div><h2>{event.title}</h2>
      <p className="event-card-description">{event.description || 'Details are coming soon.'}</p>
      <div className="event-card-meta"><span><MapPin size={16} />{event.location || 'Location to be announced'}</span><span><Users size={16} />{guestCount} going</span></div>
    </a>
    {onSave ? <button className={`save-button ${saved ? 'is-saved' : ''}`} onClick={onSave} aria-label={saved ? `Remove ${event.title} from saved events` : `Save ${event.title}`}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'} /></button> : null}
  </article>
}
