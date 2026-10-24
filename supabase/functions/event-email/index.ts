import { createClient } from 'npm:@supabase/supabase-js@2'

type EventRow = { id: string; owner_id: string; title: string; description: string; start_at: string; end_at: string | null; location: string; status: string; updated_at: string }
type RegistrationRow = { event_id: string; user_id: string; attendee_name: string; attendee_email: string; registration_status: 'pending' | 'approved' | 'rejected' | 'cancelled'; updated_at: string }
type DeliveryKind = 'registration_pending' | 'registration_approved' | 'registration_rejected' | 'event_update' | 'cancellation' | 'reminder'
type Action = 'registration_submitted' | 'registration_decision' | 'event_update' | 'event_cancel' | 'send_reminder' | 'run_scheduled_reminders'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reminder-cron-secret' }
const env = (name: string) => Deno.env.get(name) ?? ''
const platformKey = (modernName: string, legacyName: string) => {
  try {
    const key = JSON.parse(env(modernName)).default
    if (typeof key === 'string' && key) return key
  } catch { /* Older projects expose the legacy variable instead. */ }
  return env(legacyName)
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const eventText = (event: EventRow) => new Date(event.start_at).toLocaleString('en', { dateStyle: 'full', timeStyle: 'short' })
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

async function sendBrevo(to: string, name: string, subject: string, htmlContent: string) {
  const apiKey = env('BREVO_API_KEY')
  const senderEmail = env('BREVO_SENDER_EMAIL')
  if (!apiKey || !senderEmail) throw new Error('Email delivery is not configured.')
  const result = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': apiKey, 'content-type': 'application/json' }, body: JSON.stringify({ sender: { email: senderEmail, name: env('BREVO_SENDER_NAME') || 'Gather' }, to: [{ email: to, name }], subject, htmlContent }) })
  if (!result.ok) throw new Error(`Brevo request failed (${result.status}).`)
  return (await result.json() as { messageId?: string }).messageId ?? null
}

function copy(kind: DeliveryKind, event: EventRow, name: string) {
  const greeting = `<p>Hi ${escapeHtml(name)},</p>`
  const details = `<p><strong>${escapeHtml(event.title)}</strong><br/>${eventText(event)}<br/>${escapeHtml(event.location)}</p>`
  if (kind === 'registration_pending') return { subject: `Request received — ${event.title}`, html: `${greeting}<p>Your registration is waiting for the organizer’s decision.</p>${details}` }
  if (kind === 'registration_approved') return { subject: `Registration confirmed — ${event.title}`, html: `${greeting}<p>You’re registered for <strong>${escapeHtml(event.title)}</strong>. We’re looking forward to seeing you.</p>${details}` }
  if (kind === 'registration_rejected') return { subject: `Registration update — ${event.title}`, html: `${greeting}<p>Unfortunately, the organizer could not approve this registration.</p>${details}` }
  if (kind === 'cancellation') return { subject: `Cancelled — ${event.title}`, html: `${greeting}<p>This event has been cancelled.</p>${details}` }
  if (kind === 'reminder') return { subject: `Reminder — ${event.title}`, html: `${greeting}<p>A quick reminder that this event is coming up soon.</p>${details}` }
  return { subject: `Updated — ${event.title}`, html: `${greeting}<p>The organizer updated this event.</p>${details}` }
}

async function deliver(admin: ReturnType<typeof createClient>, event: EventRow, registration: RegistrationRow, kind: DeliveryKind, dedupeKey: string, campaignId?: string) {
  const { data: existing } = await admin.from('email_deliveries').select('id,status').eq('dedupe_key', dedupeKey).maybeSingle()
  if (existing?.status === 'sent') return { skipped: true }
  const { data: delivery, error: deliveryError } = await admin.from('email_deliveries').upsert({ campaign_id: campaignId ?? null, event_id: event.id, user_id: registration.user_id, kind, dedupe_key: dedupeKey, recipient_email: registration.attendee_email, status: 'queued' }, { onConflict: 'dedupe_key' }).select('id').single()
  if (deliveryError) throw deliveryError
  try {
    const message = copy(kind, event, registration.attendee_name || 'there')
    const messageId = await sendBrevo(registration.attendee_email, registration.attendee_name || 'there', message.subject, message.html)
    await admin.from('email_deliveries').update({ status: 'sent', provider_message_id: messageId, sent_at: new Date().toISOString(), error_message: null }).eq('id', delivery.id)
    return { sent: true }
  } catch (error) {
    await admin.from('email_deliveries').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown delivery error' }).eq('id', delivery.id)
    throw error
  }
}

async function sendCampaign(admin: ReturnType<typeof createClient>, campaign: { id: string; event_id: string; organizer_id: string; audience: 'approved_all' | 'selected'; selected_user_ids: string[] }) {
  const { data: event, error: eventError } = await admin.from('events').select('*').eq('id', campaign.event_id).single()
  if (eventError || !event) throw new Error('Event not found.')
  let query = admin.from('event_registrations').select('*').eq('event_id', campaign.event_id).eq('registration_status', 'approved')
  if (campaign.audience === 'selected') query = query.in('user_id', campaign.selected_user_ids)
  const { data: registrations, error } = await query
  if (error) throw error
  await admin.from('email_campaigns').update({ status: 'sending' }).eq('id', campaign.id)
  let sent = 0
  try {
    for (const registration of (registrations ?? []) as RegistrationRow[]) {
      const result = await deliver(admin, event as EventRow, registration, 'reminder', `reminder:${campaign.id}:${registration.user_id}`, campaign.id)
      if (result.sent) sent++
    }
    await admin.from('email_campaigns').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', campaign.id)
    return sent
  } catch (error) {
    await admin.from('email_campaigns').update({ status: 'failed' }).eq('id', campaign.id)
    throw error
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  const body = await request.json().catch(() => ({})) as { action?: Action; eventId?: string; recipientUserIds?: string[]; scheduledAt?: string }
  const action = body.action
  const url = env('SUPABASE_URL')
  const anonKey = platformKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
  const serviceKey = platformKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey || !action) return response({ error: 'Function configuration is incomplete.' }, 500)
  const cronAuthorized = action === 'run_scheduled_reminders' && request.headers.get('x-reminder-cron-secret') === env('REMINDER_CRON_SECRET')
  const authHeader = request.headers.get('Authorization') ?? ''
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user } } = cronAuthorized ? { data: { user: null } } : await caller.auth.getUser()
  if (!cronAuthorized && !user) return response({ error: 'Unauthorized' }, 401)
  const admin = createClient(url, serviceKey)

  if (action === 'run_scheduled_reminders') {
    const { data: campaigns, error } = await admin.from('email_campaigns').select('*').eq('kind', 'reminder').eq('status', 'scheduled').lte('scheduled_at', new Date().toISOString())
    if (error) return response({ error: error.message }, 500)
    let sent = 0
    for (const campaign of campaigns ?? []) sent += await sendCampaign(admin, campaign as { id: string; event_id: string; organizer_id: string; audience: 'approved_all' | 'selected'; selected_user_ids: string[] })
    return response({ sent })
  }

  if (!body.eventId) return response({ error: 'eventId is required.' }, 400)
  // A registration confirmation only needs the caller's public event and own
  // registration. Using the caller client keeps this path working even when a
  // project has an older service-role key deployed to its function runtime.
  const callerManagedDelivery = action === 'registration_submitted' || action === 'send_reminder'
  const eventClient = callerManagedDelivery ? caller : admin
  const { data: event, error: eventError } = await eventClient.from('events').select('*').eq('id', body.eventId).single()
  if (eventError || !event) return response({ error: 'Event not found.' }, 404)
  const typedEvent = event as EventRow

  if (action === 'registration_submitted') {
    const { data: registration } = await caller.from('event_registrations').select('*').eq('event_id', typedEvent.id).eq('user_id', user!.id).single()
    if (!registration) return response({ error: 'Registration not found.' }, 404)
    const typedRegistration = registration as RegistrationRow
    const kind: DeliveryKind = typedRegistration.registration_status === 'approved' ? 'registration_approved' : 'registration_pending'
    const message = copy(kind, typedEvent, typedRegistration.attendee_name || 'there')
    await sendBrevo(typedRegistration.attendee_email, typedRegistration.attendee_name || 'there', message.subject, message.html)
    return response({ sent: true })
  }

  if (typedEvent.owner_id !== user!.id) return response({ error: 'Forbidden' }, 403)
  if (action === 'registration_decision') {
    const targetId = body.recipientUserIds?.[0]
    if (!targetId) return response({ error: 'recipientUserIds is required.' }, 400)
    const { data: registration } = await admin.from('event_registrations').select('*').eq('event_id', typedEvent.id).eq('user_id', targetId).single()
    if (!registration) return response({ error: 'Registration not found.' }, 404)
    const typedRegistration = registration as RegistrationRow
    if (typedRegistration.registration_status !== 'approved' && typedRegistration.registration_status !== 'rejected') return response({ error: 'Registration has not been decided.' }, 409)
    const kind: DeliveryKind = typedRegistration.registration_status === 'approved' ? 'registration_approved' : 'registration_rejected'
    return response(await deliver(admin, typedEvent, typedRegistration, kind, `${kind}:${typedEvent.id}:${typedRegistration.user_id}:${typedRegistration.updated_at}`))
  }
  if (action === 'send_reminder') {
    let query = caller.from('event_registrations').select('*').eq('event_id', typedEvent.id).eq('registration_status', 'approved')
    if (body.recipientUserIds?.length) query = query.in('user_id', body.recipientUserIds)
    const { data: registrations, error } = await query
    if (error) return response({ error: error.message }, 500)
    let sent = 0
    for (const registration of (registrations ?? []) as RegistrationRow[]) {
      const message = copy('reminder', typedEvent, registration.attendee_name || 'there')
      await sendBrevo(registration.attendee_email, registration.attendee_name || 'there', message.subject, message.html)
      sent++
    }
    return response({ sent })
  }

  const { data: registrations } = await admin.from('event_registrations').select('*').eq('event_id', typedEvent.id).eq('registration_status', 'approved')
  const kind: DeliveryKind = action === 'event_cancel' ? 'cancellation' : 'event_update'
  let sent = 0
  for (const registration of (registrations ?? []) as RegistrationRow[]) { const result = await deliver(admin, typedEvent, registration, kind, `${kind}:${typedEvent.id}:${typedEvent.updated_at}:${registration.user_id}`); if (result.sent) sent++ }
  return response({ sent })
})
