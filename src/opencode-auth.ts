import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { AccountCredentials } from './types.js'

const PROVIDER_ID = 'openai'

// Matches OpenCode's Global.Path.data (xdg-basedir): $XDG_DATA_HOME/opencode.
function getDataDir(): string {
  const xdg = (process.env.XDG_DATA_HOME || '').trim()
  const base = xdg || path.join(os.homedir(), '.local', 'share')
  return path.join(base, 'opencode')
}

export function getOpenCodeAuthPath(): string {
  return path.join(getDataDir(), 'auth.json')
}

interface OpenCodeOAuthEntry {
  type: 'oauth'
  refresh: string
  access: string
  expires: number
  accountId?: string
}

function readAuthFile(file: string): Record<string, unknown> {
  try {
    if (!fs.existsSync(file)) return {}
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * Register an account in OpenCode's own auth store.
 *
 * OpenCode only invokes a plugin's `auth.loader` when its auth store already has
 * an entry for the provider (`if (!stored) continue`). Accounts added through
 * the plugin CLI only land in the plugin store, so without this the provider
 * never gets its custom fetch and requests fail with
 * "OpenAI API key is missing".
 *
 * Existing entries are left untouched so an OpenCode-managed login is not
 * clobbered.
 */
export function ensureOpenCodeAuth(account: AccountCredentials): void {
  if (!account.accessToken || !account.refreshToken) return

  const file = getOpenCodeAuthPath()
  const data = readAuthFile(file)
  if (data[PROVIDER_ID]) return

  const entry: OpenCodeOAuthEntry = {
    type: 'oauth',
    refresh: account.refreshToken,
    access: account.accessToken,
    expires: account.expiresAt
  }
  if (account.accountId) entry.accountId = account.accountId

  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  fs.writeFileSync(file, JSON.stringify({ ...data, [PROVIDER_ID]: entry }, null, 2), {
    mode: 0o600
  })
}

export function hasOpenCodeAuth(): boolean {
  return Boolean(readAuthFile(getOpenCodeAuthPath())[PROVIDER_ID])
}
