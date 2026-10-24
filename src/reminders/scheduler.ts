import { EmailReminderService } from './reminder-service'
import type { BatchReminderResult } from './types'

export interface SchedulerOptions {
  service: EmailReminderService
  leadTimeMinutes?: number
  logger?: (msg: string) => void
}

/**
 * Production-ready scheduled task entrypoint.
 * Suitable for execution via cron (e.g. crontab, GitHub Actions, AWS EventBridge, Vercel Cron).
 */
export async function runReminderScheduler(
  options: SchedulerOptions
): Promise<BatchReminderResult> {
  const now = new Date()
  const result = await options.service.sendUpcomingReminders({
    now,
    leadTimeMinutes: options.leadTimeMinutes,
  })

  if (options.logger) {
    options.logger(
      `[ReminderScheduler] Processed: ${result.processed}, Sent: ${result.sent}, Skipped: ${result.skipped}, Failed: ${result.failed}`
    )
  }

  return result
}

/**
 * Minimal in-process interval runner for local or standalone server deployments.
 */
export function startReminderInterval(
  service: EmailReminderService,
  intervalMs = 60000,
  leadTimeMinutes?: number
): { stop: () => void } {
  const timer = setInterval(() => {
    runReminderScheduler({ service, leadTimeMinutes }).catch(() => {
      // Errors handled inside scheduler
    })
  }, intervalMs)

  // Do not block Node.js process exit if unref is available
  if (typeof timer === 'object' && 'unref' in timer && typeof timer.unref === 'function') {
    timer.unref()
  }

  return {
    stop: () => clearInterval(timer),
  }
}
