import { afterEach, describe, expect, test } from 'bun:test'
import { probeRateLimitsForAccount } from '../src/probe-limits.js'
import type { AccountCredentials } from '../src/types.js'

function account(): AccountCredentials {
  return {
    alias: 'test',
    accessToken: 'token',
    refreshToken: 'refresh',
    accountId: 'acct',
    expiresAt: Date.now() + 3600_000,
    usageCount: 0
  }
}

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

function mockUsage(body: unknown, status = 200) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })) as typeof fetch
}

describe('probeRateLimitsForAccount', () => {
  test('maps primary/secondary windows to 5h/weekly', async () => {
    mockUsage({
      rate_limit: {
        primary_window: { used_percent: 0, limit_window_seconds: 18000, reset_at: 1790151777 },
        secondary_window: { used_percent: 61, limit_window_seconds: 604800, reset_at: 1790604584 }
      }
    })
    const result = await probeRateLimitsForAccount(account())
    expect(result.error).toBeUndefined()
    expect(result.rateLimits?.fiveHour?.remaining).toBe(100)
    expect(result.rateLimits?.weekly?.remaining).toBe(39)
    expect(result.rateLimits?.weekly?.resetAt).toBe(1790604584000)
  })

  test('classifies windows by length, not position', async () => {
    mockUsage({
      rate_limit: {
        primary_window: { used_percent: 30, limit_window_seconds: 604800 },
        secondary_window: { used_percent: 10, limit_window_seconds: 18000 }
      }
    })
    const result = await probeRateLimitsForAccount(account())
    expect(result.rateLimits?.weekly?.remaining).toBe(70)
    expect(result.rateLimits?.fiveHour?.remaining).toBe(90)
  })

  test('derives resetAt from reset_after_seconds', async () => {
    const now = Date.now()
    mockUsage({
      rate_limit: { primary_window: { used_percent: 5, limit_window_seconds: 18000, reset_after_seconds: 60 } }
    })
    const result = await probeRateLimitsForAccount(account())
    expect(result.rateLimits?.fiveHour?.resetAt).toBeGreaterThanOrEqual(now + 60_000 - 1000)
  })

  test('reports HTTP failures', async () => {
    mockUsage({ detail: 'nope' }, 401)
    const result = await probeRateLimitsForAccount(account())
    expect(result.rateLimits).toBeUndefined()
    expect(result.error).toContain('401')
  })

  test('reports missing windows', async () => {
    mockUsage({ rate_limit: {} })
    const result = await probeRateLimitsForAccount(account())
    expect(result.error).toContain('no rate limit windows')
  })
})
