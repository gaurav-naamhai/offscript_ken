import { useState } from 'react'
import { Calendar, MapPin, Tag, Bookmark, ArrowUpRight } from 'lucide-react'
import type { GatherEventWithDistance } from '../../types/event'
import { formatDistance } from '../../features/location/haversine'

interface EventCardProps {
  event: GatherEventWithDistance
  isSelected?: boolean
  onClick?: () => void
  saved?: boolean
  onToggleSave?: (id: string) => void
  href?: string
}

export function EventCard({
  event,
  isSelected,
  onClick,
  saved,
  onToggleSave,
  href,
}: EventCardProps) {
  const [imgError, setImgError] = useState(false)

  const eventHref = href || `#/user/event/${event.id}`

  const parseDateParts = (isoString: string) => {
    try {
      const date = new Date(isoString)
      if (isNaN(date.getTime())) return { month: 'TBD', day: '--', timeStr: isoString }
      const month = new Intl.DateTimeFormat('en', { month: 'short' }).format(date).toUpperCase()
      const day = date.getDate().toString()
      const timeStr = new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      }).format(date)
      return { month, day, timeStr }
    } catch {
      return { month: 'TBD', day: '--', timeStr: isoString }
    }
  }

  const { month, day, timeStr } = parseDateParts(event.startDateTime)
  const imageUrl = (!imgError && event.imageUrl) ? event.imageUrl : '/images/moonlit-studio.png'

  return (
    <article
      className={`event-card ${isSelected ? 'is-selected' : ''}`}
      aria-labelledby={`event-title-${event.id}`}
      onClick={onClick}
    >
      {/* Image Container with editorial badges */}
      <div className="event-card-media">
        <a href={eventHref} className="event-card-media-link" tabIndex={-1} aria-hidden="true">
          <img
            src={imageUrl}
            alt={event.title}
            className="event-card-image"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        </a>

        {/* Editorial Date Badge */}
        <div className="card-date-badge" aria-label={`Date: ${month} ${day}`}>
          <span className="card-date-month">{month}</span>
          <span className="card-date-day">{day}</span>
        </div>

        {/* Top Badges (Category & Sample Pill) */}
        <div className="event-card-badges">
          <span className="event-category-badge">
            <Tag size={12} aria-hidden="true" />
            <span>{event.category}</span>
          </span>
          {event.isSample && (
            <span className="event-sample-badge" title="Curated sample event for preview">
              Preview
            </span>
          )}
        </div>

        {onToggleSave && (
          <button
            type="button"
            className={`save-button ${saved ? 'is-saved' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleSave(event.id)
            }}
            aria-label={saved ? `Remove ${event.title} from saved` : `Save ${event.title}`}
          >
            <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {/* Card Content */}
      <div className="event-card-body">
        {/* Scannable Date & Price Row */}
        <div className="event-card-time-row">
          <span className="event-date-pill">
            <Calendar size={13} className="meta-icon" aria-hidden="true" />
            <time dateTime={event.startDateTime}>{timeStr}</time>
          </span>
          <div className="event-card-status-row">
            {saved && <span className="event-saved-label">Saved</span>}
            {event.price && <span className="event-price-tag">{event.price}</span>}
          </div>
        </div>

        {/* Scannable Event Title */}
        <h3 id={`event-title-${event.id}`} className="event-title">
          <a href={eventHref} className="event-title-link">
            {event.title}
          </a>
        </h3>

        <p className="event-description">{event.description}</p>

        {/* Scannable Venue & Location */}
        <div className="event-meta-row venue-row">
          <MapPin size={15} className="meta-icon" aria-hidden="true" />
          <div className="venue-details">
            <strong className="venue-name">{event.venueName}</strong>
            {event.address && <span className="venue-address">{event.address}</span>}
          </div>
        </div>

        {/* Scannable Distance / Location and CTA */}
        <div className="event-card-footer">
          {event.distanceKm !== null ? (
            <span className="event-distance-badge" title="Straight-line distance from search center">
              <MapPin size={12} aria-hidden="true" />
              <span>{formatDistance(event.distanceKm)} away</span>
            </span>
          ) : (
            <span className="event-distance-badge distance-unfiltered">
              <span>{event.address ? 'Location specified' : 'Location TBA'}</span>
            </span>
          )}

          <a href={eventHref} className="event-cta-link" aria-label={`View details for ${event.title}`}>
            <span>View gathering</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  )
}
