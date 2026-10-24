import type { Section } from '../features/workspace'

export function EmptySection({ section }: { section: Section }) {
  const Icon = section.emptyIcon
  return (
    <section className="feature-section" aria-labelledby="section-title">
      <div className="section-heading">
        <h1 id="section-title">{section.label}</h1>
        <p>{section.subtitle}</p>
      </div>
      <div className="feature-content" data-feature={section.id}>
        {/* Mount future event lists, calendars, and connected features here. */}
        <div className="empty-state" role="status">
          <div className="empty-icon"><Icon size={58} strokeWidth={1.35} aria-hidden="true" /></div>
          <h2>{section.emptyTitle}</h2>
          <p>{section.emptyDescription}</p>
        </div>
      </div>
    </section>
  )
}
