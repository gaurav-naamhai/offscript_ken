import { useState } from 'react'
import { Bookmark, MapPin, Users, ArrowUpRight } from 'lucide-react'
import { type EventRecord } from '../features/events'
import { dateLabel } from '../features/event-utils'
import { eventHref, type WorkspaceMode } from '../features/workspace'

export function EventCard({
  event,
  mode,
  saved,
  guestCount,
  onSave,
}: {
  event: EventRecord
  mode: WorkspaceMode
  saved: boolean
  guestCount: number
  onSave?: () => void
}) {
  const [imgError, setImgError] = useState(false)

  // Parse Month and Day for editorial badge
  const parseDate = () => {
    try {
      const d = new Date(`${event.startDate}T12:00:00`)
      if (isNaN(d.getTime())) return { month: 'TBD', day: '--' }
      return {
        month: new Intl.DateTimeFormat('en', { month: 'short' }).format(d).toUpperCase(),
        day: d.getDate().toString(),
      }
    } catch {
      return { month: 'TBD', day: '--' }
    }
  }

  const { month, day } = parseDate()
  const imageUrl = (!imgError && event.imageUrl) ? event.imageUrl : '/images/moonlit-studio.png'

  return (
    <article className="event-card">
      <div className="event-card-media">
        <a href={eventHref(mode, event.id)} className="event-card-media-link" tabIndex={-1} aria-hidden="true">
          <img
            className="event-card-image"
            src={imageUrl}
            alt={event.title}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        </a>

        {/* Date badge */}
        <div className="card-date-badge" aria-label={`Date: ${month} ${day}`}>
          <span className="card-date-month">{month}</span>
          <span className="card-date-day">{day}</span>
        </div>

        {/* Category & Status badges */}
        <div className="event-card-badges">
          <span className="event-category-badge">{event.category}</span>
          {event.status !== 'published' && (
            <span className={`status-pill status-${event.status}`}>
              {event.status}
            </span>
          )}
        </div>

        {onSave && (
          <button
            type="button"
            className={`save-button ${saved ? 'is-saved' : ''}`}
            onClick={onSave}
            aria-label={saved ? `Remove ${event.title} from saved events` : `Save ${event.title}`}
          >
            <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      <div className="event-card-body">
        <div className="event-card-time-row">
          <span className="event-card-date">{dateLabel(event.startDate, event.startTime)}</span>
        </div>

        <h3 className="event-title">
          <a href={eventHref(mode, event.id)} className="event-title-link">
            {event.title}
          </a>
        </h3>

        <p className="event-description">{event.description || 'Details are coming soon.'}</p>

        <div className="event-meta-row venue-row">
          <MapPin size={15} className="meta-icon" aria-hidden="true" />
          <strong className="venue-name">{event.location || 'Location to be announced'}</strong>
        </div>

        <div className="event-card-footer">
          <span className="guest-count-badge">
            <Users size={14} aria-hidden="true" />
            <span>{guestCount} going</span>
          </span>

          <a href={eventHref(mode, event.id)} className="event-cta-link" aria-label={`View details for ${event.title}`}>
            <span>View details</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  )
}
