import { ArrowUpRight, CalendarDays, MapPin } from 'lucide-react'
import type { GatherEventWithDistance } from '../../types/event'
import { formatDistance } from '../../features/location/haversine'

interface EventCardProps {
  event: GatherEventWithDistance
  isSelected?: boolean
  onClick?: () => void
}

export function EventCard({ event, isSelected, onClick }: EventCardProps) {
  const date = new Date(event.startDateTime)
  const dateLabel = Number.isNaN(date.getTime())
    ? event.startDateTime
    : new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'short', day: 'numeric' }).format(date)
  const timeLabel = Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(date)

  return (
    <article
      className={`builder-event-card ${isSelected ? 'is-selected' : ''}`}
      aria-labelledby={`event-title-${event.id}`}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(keyboardEvent) => { if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') { keyboardEvent.preventDefault(); onClick?.() } }}
    >
      <div className="builder-card-image-wrap">
        <img className="builder-card-image" src={event.imageUrl || '/images/gather-hackathon-hero.png'} alt="" loading="lazy" />
        <span className="builder-card-category">{event.category}</span>
        {event.price ? <span className="builder-card-price">{event.price}</span> : null}
      </div>
      <div className="builder-card-copy">
        <h3 id={`event-title-${event.id}`}>{event.title}</h3>
        <p>{event.description}</p>
        <div className="builder-card-meta">
          <span><CalendarDays size={15} aria-hidden="true" /><time dateTime={event.startDateTime}>{dateLabel} <i>·</i> {timeLabel}</time></span>
          <span><MapPin size={15} aria-hidden="true" /><span>{event.venueName}</span></span>
        </div>
        <div className="builder-card-footer">
          <span>{event.distanceKm !== null ? formatDistance(event.distanceKm) : event.address}</span>
          <span className="builder-card-arrow" aria-hidden="true"><ArrowUpRight size={17} /></span>
        </div>
        {event.registrationHref ? <a className="builder-card-register" href={event.registrationHref} onClick={(clickEvent) => clickEvent.stopPropagation()}>View event &amp; register <ArrowUpRight size={15} aria-hidden="true" /></a> : null}
      </div>
    </article>
  )
}
