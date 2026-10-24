import { Calendar, MapPin, Tag } from 'lucide-react'
import type { GatherEventWithDistance } from '../../types/event'
import { formatDistance } from '../../features/location/haversine'

interface EventCardProps {
  event: GatherEventWithDistance
  isSelected?: boolean
  onClick?: () => void
}

export function EventCard({ event, isSelected, onClick }: EventCardProps) {
  // Format readable date and time
  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      if (isNaN(date.getTime())) return isoString
      return new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      }).format(date)
    } catch {
      return isoString
    }
  }

  return (
    <article
      className={`event-card ${isSelected ? 'is-selected' : ''}`}
      aria-labelledby={`event-title-${event.id}`}
      onClick={onClick}
    >
      <div className="event-card-header">
        <span className="event-category-badge">
          <Tag size={12} aria-hidden="true" />
          <span>{event.category}</span>
        </span>
        {event.price && <span className="event-price-tag">{event.price}</span>}
      </div>

      <h3 id={`event-title-${event.id}`} className="event-title">
        {event.title}
      </h3>

      <p className="event-description">{event.description}</p>

      <div className="event-meta-list">
        <div className="event-meta-row">
          <Calendar size={15} className="meta-icon" aria-hidden="true" />
          <time dateTime={event.startDateTime}>
            {formatDateTime(event.startDateTime)}
          </time>
        </div>

        <div className="event-meta-row">
          <MapPin size={15} className="meta-icon" aria-hidden="true" />
          <div className="venue-details">
            <span className="venue-name">{event.venueName}</span>
            <span className="venue-address">{event.address}</span>
          </div>
        </div>
      </div>

      <div className="event-card-footer">
        {event.distanceKm !== null ? (
          <span className="event-distance-badge" title="Straight-line distance">
            <MapPin size={13} aria-hidden="true" />
            <span>{formatDistance(event.distanceKm)}</span>
          </span>
        ) : (
          <span className="event-distance-badge distance-unfiltered">
            <span>Location specified</span>
          </span>
        )}

        {event.organizerName && (
          <span className="event-organizer">by {event.organizerName}</span>
        )}
      </div>
    </article>
  )
}
