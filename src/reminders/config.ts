import type { BrevoConfig } from './types'

export function maskApiKey(apiKey?: string): string {
  if (!apiKey) return '[NOT_SET]'
  if (apiKey.length <= 8) return '****'
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
}

export function loadBrevoConfig(override?: Partial<BrevoConfig>): BrevoConfig {
  const env: Record<string, string | undefined> =
    typeof process !== 'undefined' && process && process.env ? process.env : {}

  let isMock: boolean
  if (override?.mockMode !== undefined) {
    isMock = Boolean(override.mockMode)
  } else if (env.BREVO_MOCK_MODE !== undefined || env.EMAIL_MOCK_MODE !== undefined) {
    const raw = env.BREVO_MOCK_MODE ?? env.EMAIL_MOCK_MODE
    isMock = raw === 'true' || raw === '1' || raw === 'yes'
  } else {
    isMock = env.NODE_ENV === 'test' || !env.BREVO_API_KEY
  }

  const apiKey = override?.apiKey ?? env.BREVO_API_KEY ?? (isMock ? 'mock-brevo-key' : '')
  const senderEmail = override?.senderEmail ?? env.BREVO_SENDER_EMAIL ?? 'notifications@gather.app'
  const senderName = override?.senderName ?? env.BREVO_SENDER_NAME ?? 'Gather Events'
  const maxRetries = override?.maxRetries ?? (env.BREVO_MAX_RETRIES ? parseInt(env.BREVO_MAX_RETRIES, 10) : 3)
  const retryDelayMs = override?.retryDelayMs ?? (env.BREVO_RETRY_DELAY_MS ? parseInt(env.BREVO_RETRY_DELAY_MS, 10) : 100)
  const apiUrl = override?.apiUrl ?? env.BREVO_API_URL ?? 'https://api.brevo.com/v3/smtp/email'

  const config: BrevoConfig = {
    apiKey,
    senderEmail,
    senderName,
    mockMode: Boolean(isMock),
    maxRetries,
    retryDelayMs,
    apiUrl,
  }

  return config
}

export function validateBrevoConfig(config: BrevoConfig): void {
  if (config.mockMode) {
    // In mock mode, a dummy or real key is acceptable
    return
  }

  if (!config.apiKey || config.apiKey.trim() === '' || config.apiKey === 'mock-brevo-key') {
    throw new Error('BREVO_API_KEY environment variable is required when not in mock mode.')
  }

  if (!config.senderEmail || !config.senderEmail.includes('@')) {
    throw new Error(`BREVO_SENDER_EMAIL is invalid: "${config.senderEmail}"`)
  }
}
