import type { AccountCredentials, AccountRateLimits, RateLimitWindow } from './types.js'

// ChatGPT usage endpoint: returns the rate-limit windows (and per-model
// availability) without consuming tokens. This replaces spawning the `codex`
// CLI, which fails with ENOENT when the CLI isn't installed.
const USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage'
const USAGE_TIMEOUT_MS = 30_000
const WEEK_SECONDS = 7 * 24 * 60 * 60

export interface ProbeResult {
  rateLimits?: AccountRateLimits
  error?: string
}

interface UsageWindow {
  used_percent?: number
  limit_window_seconds?: number
  reset_after_seconds?: number
  reset_at?: number
}

interface UsageResponse {
  rate_limit?: {
    allowed?: boolean
    limit_reached?: boolean
    primary_window?: UsageWindow | null
    secondary_window?: UsageWindow | null
  } | null
}

function buildWindow(window: UsageWindow | null | undefined, now: number): RateLimitWindow | undefined {
  if (!window) return undefined
  const remaining =
    typeof window.used_percent === 'number' ? Math.max(0, 100 - window.used_percent) : undefined
  const resetAt =
    typeof window.reset_at === 'number' && window.reset_at > 0
      ? window.reset_at * 1000
      : typeof window.reset_after_seconds === 'number'
        ? now + window.reset_after_seconds * 1000
        : undefined
  return { limit: 100, remaining, resetAt, updatedAt: now }
}

function isWeeklyWindow(window: UsageWindow | null | undefined): boolean {
  const seconds = window?.limit_window_seconds
  return typeof seconds === 'number' && seconds >= WEEK_SECONDS
}

export async function probeRateLimitsForAccount(account: AccountCredentials): Promise<ProbeResult> {
  if (!account.accessToken) return { error: 'Missing access token' }
  if (!account.accountId) return { error: 'Missing account id' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), USAGE_TIMEOUT_MS)

  try {
    const res = await fetch(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'chatgpt-account-id': account.accountId,
        originator: 'codex_cli_rs'
      },
      signal: controller.signal
    })

    if (!res.ok) {
      return { error: `Usage request failed: HTTP ${res.status}` }
    }

    const data = (await res.json()) as UsageResponse
    const now = Date.now()
    const primary = data.rate_limit?.primary_window
    const secondary = data.rate_limit?.secondary_window

    // The primary window is the short (5h) one and secondary is weekly, but
    // classify by window length so a reordering upstream doesn't swap them.
    const fiveHour = isWeeklyWindow(primary) ? secondary : primary
    const weekly = isWeeklyWindow(primary) ? primary : secondary

    const rateLimits: AccountRateLimits = {
      fiveHour: buildWindow(fiveHour, now),
      weekly: buildWindow(weekly, now)
    }

    if (!rateLimits.fiveHour && !rateLimits.weekly) {
      return { error: 'Usage response had no rate limit windows' }
    }

    return { rateLimits }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(timer)
  }
}
