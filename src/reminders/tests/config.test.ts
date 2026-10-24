import { describe, expect, it } from 'vitest'
import { loadBrevoConfig, maskApiKey, validateBrevoConfig } from '../config'

describe('Brevo Configuration & Mock Mode', () => {
  it('loads default mock mode in test environment', () => {
    const config = loadBrevoConfig()
    expect(config.mockMode).toBe(true)
    expect(config.senderEmail).toBe('notifications@gather.app')
    expect(config.senderName).toBe('Gather Events')
  })

  it('honors environment variable overrides', () => {
    const custom = loadBrevoConfig({
      apiKey: 'xkeysib-test-1234567890-abcdef',
      senderEmail: 'custom@gather.app',
      senderName: 'Gather Custom',
      mockMode: false,
    })

    expect(custom.apiKey).toBe('xkeysib-test-1234567890-abcdef')
    expect(custom.senderEmail).toBe('custom@gather.app')
    expect(custom.senderName).toBe('Gather Custom')
    expect(custom.mockMode).toBe(false)
  })

  it('validates config in live mode and throws if API key is missing', () => {
    const invalidConfig = loadBrevoConfig({
      apiKey: '',
      mockMode: false,
    })

    expect(() => validateBrevoConfig(invalidConfig)).toThrow(
      /BREVO_API_KEY environment variable is required/
    )
  })

  it('validates config in live mode and throws if sender email is invalid', () => {
    const invalidSender = loadBrevoConfig({
      apiKey: 'xkeysib-validkey-123456789',
      senderEmail: 'not-an-email',
      mockMode: false,
    })

    expect(() => validateBrevoConfig(invalidSender)).toThrow(
      /BREVO_SENDER_EMAIL is invalid/
    )
  })

  it('passes validation when mockMode is true even without real API key', () => {
    const mockConfig = loadBrevoConfig({
      apiKey: '',
      mockMode: true,
    })

    expect(() => validateBrevoConfig(mockConfig)).not.toThrow()
  })

  it('masks sensitive API keys properly', () => {
    expect(maskApiKey('xkeysib-1234567890abcdef')).toBe('xkey...cdef')
    expect(maskApiKey('short')).toBe('****')
    expect(maskApiKey(undefined)).toBe('[NOT_SET]')
  })
})
