import { useState, type FormEvent } from 'react'
import { ArrowLeft, Check, Save } from 'lucide-react'
import { type EventInput, type EventRecord, type EventStatus } from '../features/events'

const categories = ['Community', 'Music', 'Technology', 'Arts & Culture', 'Food & Drink', 'Sports', 'Other']
const blank = (): EventInput => ({ title: '', description: '', startDate: '', endDate: '', startTime: '18:00', endTime: '20:00', location: '', category: 'Community', capacity: null, visibility: 'public', registration: 'open' })

export function EventForm({ event, onSubmit }: { event?: EventRecord; onSubmit: (input: EventInput, status: EventStatus) => void }) {
  const [form, setForm] = useState<EventInput>(event ? { title: event.title, description: event.description, startDate: event.startDate, endDate: event.endDate, startTime: event.startTime, endTime: event.endTime, location: event.location, category: event.category, capacity: event.capacity, visibility: event.visibility, registration: event.registration } : blank())
  const [error, setError] = useState('')
  const update = <K extends keyof EventInput>(key: K, value: EventInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (status: EventStatus) => (e: FormEvent) => { e.preventDefault(); if (!form.title.trim() || !form.startDate || !form.location.trim()) { setError('Add an event name, date, and location before continuing.'); return } if (form.endDate && form.endDate < form.startDate) { setError('Your end date needs to come after the start date.'); return } onSubmit({ ...form, title: form.title.trim(), location: form.location.trim() }, status) }
  return <section className="form-screen" aria-labelledby="event-form-title">
    <a className="back-link" href="#/organizer/my-events"><ArrowLeft size={18} />Back to My Events</a>
    <div className="form-heading"><h1 id="event-form-title">{event ? 'Edit event' : 'Create an event'}</h1><p>Start with the essentials. You can keep this as a draft until it feels right.</p></div>
    <form className="event-form" onSubmit={submit('published')}>
      <label className="form-field field-wide"><span>Event name</span><input autoFocus value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="What are you bringing together?" required /></label>
      <label className="form-field field-wide"><span>About this event</span><textarea value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Give people a reason to be there." rows={4} /></label>
      <label className="form-field"><span>Start date</span><input type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} required /></label><label className="form-field"><span>Start time</span><input type="time" value={form.startTime} onChange={(e) => update('startTime', e.target.value)} required /></label>
      <label className="form-field"><span>End date</span><input type="date" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} /></label><label className="form-field"><span>End time</span><input type="time" value={form.endTime} onChange={(e) => update('endTime', e.target.value)} /></label>
      <label className="form-field field-wide"><span>Location</span><input value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Venue, address, or online link" required /></label>
      <label className="form-field"><span>Category</span><select value={form.category} onChange={(e) => update('category', e.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="form-field"><span>Capacity <em>optional</em></span><input type="number" min="1" value={form.capacity ?? ''} onChange={(e) => update('capacity', e.target.value ? Number(e.target.value) : null)} placeholder="No limit" /></label>
      <fieldset className="form-field field-wide choice-field"><legend>Visibility</legend><div className="choice-row"><label><input type="radio" checked={form.visibility === 'public'} onChange={() => update('visibility', 'public')} /> Public</label><label><input type="radio" checked={form.visibility === 'private'} onChange={() => update('visibility', 'private')} /> Private</label></div></fieldset>
      <fieldset className="form-field field-wide choice-field"><legend>Registration</legend><div className="choice-row"><label><input type="radio" checked={form.registration === 'open'} onChange={() => update('registration', 'open')} /> Open RSVP</label><label><input type="radio" checked={form.registration === 'approval'} onChange={() => update('registration', 'approval')} /> Request to join</label><label><input type="radio" checked={form.registration === 'closed'} onChange={() => update('registration', 'closed')} /> Closed</label></div></fieldset>
      {error ? <p className="form-error" role="alert">{error}</p> : null}<div className="form-actions"><button type="button" className="button button-secondary" onClick={(e) => submit('draft')(e as unknown as FormEvent)}><Save size={18} />Save draft</button><button className="button button-primary" type="submit"><Check size={18} />{event?.status === 'published' ? 'Save changes' : 'Publish event'}</button></div>
    </form>
  </section>
}
