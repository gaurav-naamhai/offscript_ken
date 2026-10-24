import type { Attendee, Event, Registration, SendEmailOptions } from './types'

function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toUTCString()
  } catch {
    return isoString
  }
}

export function buildConfirmationEmail(
  event: Event,
  attendee: Attendee,
  registration: Registration
): SendEmailOptions {
  const formattedStart = formatDateTime(event.startTime)
  const formattedEnd = event.endTime ? formatDateTime(event.endTime) : undefined
  const locationText = event.location || 'Online / To be announced'

  const subject = `Registration Confirmed: ${event.title}`

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f8fa; margin: 0; padding: 24px; color: #202524; }
    .card { background: #ffffff; max-width: 560px; margin: 0 auto; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .badge { display: inline-block; background-color: #edf5f1; color: #1d5542; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px; margin-bottom: 16px; }
    h1 { font-size: 22px; margin-top: 0; color: #1d5542; }
    p { line-height: 1.5; font-size: 15px; margin: 8px 0; }
    .details { background: #f9fafb; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .detail-item { margin-bottom: 8px; }
    .detail-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    .detail-value { font-size: 15px; font-weight: 500; color: #111827; }
    .footer { font-size: 12px; color: #9ca3af; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Registration Confirmed</span>
    <h1>You're registered for ${event.title}</h1>
    <p>Hi ${attendee.name || 'there'},</p>
    <p>We've reserved your spot! Here are the details of the upcoming event:</p>
    <div class="details">
      <div class="detail-item">
        <div class="detail-label">Date & Time</div>
        <div class="detail-value">${formattedStart}${formattedEnd ? ` &ndash; ${formattedEnd}` : ''}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Location</div>
        <div class="detail-value">${locationText}</div>
      </div>
      ${event.organizerName ? `
      <div class="detail-item">
        <div class="detail-label">Organizer</div>
        <div class="detail-value">${event.organizerName}</div>
      </div>` : ''}
      <div class="detail-item">
        <div class="detail-label">Registration ID</div>
        <div class="detail-value"><code>${registration.id}</code></div>
      </div>
    </div>
    ${event.description ? `<p>${event.description}</p>` : ''}
    <p>We'll send you a reminder before the event begins.</p>
    <div class="footer">Gather &bull; Made for getting together</div>
  </div>
</body>
</html>
`.trim()

  const textContent = `
Registration Confirmed: ${event.title}
Hi ${attendee.name || 'there'},

You're confirmed for "${event.title}".
Date & Time: ${formattedStart}${formattedEnd ? ` - ${formattedEnd}` : ''}
Location: ${locationText}
Registration ID: ${registration.id}

We will send you a reminder before the event begins.
`.trim()

  return {
    to: [{ email: attendee.email, name: attendee.name }],
    subject,
    htmlContent,
    textContent,
    tags: ['event-confirmation', `event-${event.id}`],
  }
}

export function buildReminderEmail(
  event: Event,
  attendee: Attendee,
  registration: Registration
): SendEmailOptions {
  const formattedStart = formatDateTime(event.startTime)
  const locationText = event.location || 'Online / To be announced'
  const subject = `Reminder: "${event.title}" is coming up soon!`

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f8fa; margin: 0; padding: 24px; color: #202524; }
    .card { background: #ffffff; max-width: 560px; margin: 0 auto; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .badge { display: inline-block; background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px; margin-bottom: 16px; }
    h1 { font-size: 22px; margin-top: 0; color: #1d5542; }
    p { line-height: 1.5; font-size: 15px; margin: 8px 0; }
    .details { background: #f9fafb; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .detail-item { margin-bottom: 8px; }
    .detail-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    .detail-value { font-size: 15px; font-weight: 500; color: #111827; }
    .footer { font-size: 12px; color: #9ca3af; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Upcoming Reminder</span>
    <h1>Upcoming: ${event.title}</h1>
    <p>Hi ${attendee.name || 'there'},</p>
    <p>This is a quick reminder that your event is starting soon:</p>
    <div class="details">
      <div class="detail-item">
        <div class="detail-label">Start Time</div>
        <div class="detail-value">${formattedStart}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Location</div>
        <div class="detail-value">${locationText}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Registration ID</div>
        <div class="detail-value"><code>${registration.id}</code></div>
      </div>
    </div>
    <p>We look forward to seeing you there!</p>
    <div class="footer">Gather &bull; Made for getting together</div>
  </div>
</body>
</html>
`.trim()

  const textContent = `
Upcoming Event Reminder: ${event.title}
Hi ${attendee.name || 'there'},

This is a reminder that "${event.title}" is coming up soon!
Start Time: ${formattedStart}
Location: ${locationText}
Registration ID: ${registration.id}

See you there!
`.trim()

  return {
    to: [{ email: attendee.email, name: attendee.name }],
    subject,
    htmlContent,
    textContent,
    tags: ['event-reminder', `event-${event.id}`],
  }
}

export function buildEventUpdateEmail(
  event: Event,
  attendee: Attendee,
  options?: { reason?: string; timeChanged?: boolean; previousStartTime?: string }
): SendEmailOptions {
  const formattedStart = formatDateTime(event.startTime)
  const locationText = event.location || 'Online / To be announced'
  const subject = `Update: Changes to "${event.title}"`

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f8fa; margin: 0; padding: 24px; color: #202524; }
    .card { background: #ffffff; max-width: 560px; margin: 0 auto; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .badge { display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px; margin-bottom: 16px; }
    h1 { font-size: 22px; margin-top: 0; color: #1e3a8a; }
    p { line-height: 1.5; font-size: 15px; margin: 8px 0; }
    .details { background: #f9fafb; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .detail-item { margin-bottom: 8px; }
    .detail-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    .detail-value { font-size: 15px; font-weight: 500; color: #111827; }
    .footer { font-size: 12px; color: #9ca3af; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Event Update</span>
    <h1>Important updates to ${event.title}</h1>
    <p>Hi ${attendee.name || 'there'},</p>
    <p>There has been an update to an event you are registered for.</p>
    ${options?.reason ? `<p><strong>Update details:</strong> ${options.reason}</p>` : ''}
    <div class="details">
      <div class="detail-item">
        <div class="detail-label">Current Date & Time</div>
        <div class="detail-value">${formattedStart}</div>
      </div>
      ${options?.previousStartTime ? `
      <div class="detail-item">
        <div class="detail-label">Previous Time</div>
        <div class="detail-value" style="text-decoration: line-through; color: #9ca3af;">${formatDateTime(options.previousStartTime)}</div>
      </div>` : ''}
      <div class="detail-item">
        <div class="detail-label">Location</div>
        <div class="detail-value">${locationText}</div>
      </div>
    </div>
    <div class="footer">Gather &bull; Made for getting together</div>
  </div>
</body>
</html>
`.trim()

  const textContent = `
Event Update: ${event.title}
Hi ${attendee.name || 'there'},

There has been an update to "${event.title}".
${options?.reason ? `Details: ${options.reason}\n` : ''}
Date & Time: ${formattedStart}
Location: ${locationText}
`.trim()

  return {
    to: [{ email: attendee.email, name: attendee.name }],
    subject,
    htmlContent,
    textContent,
    tags: ['event-update', `event-${event.id}`],
  }
}

export function buildEventCancelledEmail(
  event: Event,
  attendee: Attendee,
  reason?: string
): SendEmailOptions {
  const subject = `Cancelled: "${event.title}" has been cancelled`

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f8fa; margin: 0; padding: 24px; color: #202524; }
    .card { background: #ffffff; max-width: 560px; margin: 0 auto; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .badge { display: inline-block; background-color: #fee2e2; color: #991b1b; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px; margin-bottom: 16px; }
    h1 { font-size: 22px; margin-top: 0; color: #991b1b; }
    p { line-height: 1.5; font-size: 15px; margin: 8px 0; }
    .footer { font-size: 12px; color: #9ca3af; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Event Cancelled</span>
    <h1>Event Cancelled: ${event.title}</h1>
    <p>Hi ${attendee.name || 'there'},</p>
    <p>We regret to inform you that <strong>${event.title}</strong> has been cancelled by the organizer.</p>
    ${reason ? `<p><strong>Reason provided:</strong> ${reason}</p>` : ''}
    <p>You do not need to take any further action.</p>
    <div class="footer">Gather &bull; Made for getting together</div>
  </div>
</body>
</html>
`.trim()

  const textContent = `
Event Cancelled: ${event.title}
Hi ${attendee.name || 'there'},

We regret to inform you that "${event.title}" has been cancelled by the organizer.
${reason ? `Reason: ${reason}\n` : ''}
You do not need to take any further action.
`.trim()

  return {
    to: [{ email: attendee.email, name: attendee.name }],
    subject,
    htmlContent,
    textContent,
    tags: ['event-cancellation', `event-${event.id}`],
  }
}
