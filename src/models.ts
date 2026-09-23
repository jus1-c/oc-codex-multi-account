import { loadStore, updateAccount } from './store.js'
import type { AccountCredentials, ModelCatalogEntry } from './types.js'

// The ChatGPT Codex backend gates its model catalog on the caller's client
// version. Sending an old version returns an empty list, so keep this current
// with the Codex CLI releases and allow an env override.
const CODEX_CLIENT_VERSION =
  (process.env.OPENCODE_MULTI_AUTH_CODEX_CLIENT_VERSION || '0.156.1').trim()

const CATALOG_BASE_URL = 'https://chatgpt.com/backend-api/codex/models'
const CATALOG_TTL_MS = 12 * 60 * 60 * 1000

// Used only when the catalog endpoint is unreachable. These are the models
// verified callable on a ChatGPT (Kimi OAuth) account as of 2026-09.
const DEFAULT_CATALOG_SLUGS = [
  'gpt-6-astra',
  'gpt-6-luna',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5'
]

// Models retired from Codex when signing in with a ChatGPT account. Requests
// for these 400 with "model is not supported when using Codex with a ChatGPT
// account", so they must be remapped to a currently available model.
const RETIRED_MODEL_PATTERNS: RegExp[] = [
  /^gpt-5$/,
  /^gpt-5-(mini|nano|pro)$/,
  /^gpt-5\.1($|-)/,
  /^gpt-5\.2($|-)/,
  /^gpt-5\.3($|-)/,
  /^gpt-5\.4($|-)/,
  /^gpt-5\.5-pro$/,
  /^gpt-5\.6$/,
  /^gpt-5-codex$/,
  /^gpt-5\.1-codex(-max|-mini)?$/,
  /^gpt-5\.2-codex$/,
  /^gpt-5\.3-codex(-spark)?$/
]

export function isRetiredModel(modelId: string): boolean {
  const base = modelId.includes('/') ? modelId.split('/').pop()! : modelId
  return RETIRED_MODEL_PATTERNS.some((pattern) => pattern.test(base))
}

interface RawCatalogModel {
  slug?: string
  display_name?: string
  context_window?: number
  max_context_window?: number
  visibility?: string
  priority?: number
  supported_reasoning_levels?: Array<{ effort?: string }>
}

export async function fetchCodexCatalog(
  token: string,
  accountId: string | undefined
): Promise<ModelCatalogEntry[]> {
  const url = `${CATALOG_BASE_URL}?client_version=${encodeURIComponent(CODEX_CLIENT_VERSION)}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    originator: 'codex_cli_rs'
  }
  if (accountId) headers['chatgpt-account-id'] = accountId

  try {
    const res = await fetch(url, { headers })
    if (!res.ok) {
      if (process.env.OPENCODE_MULTI_AUTH_DEBUG === '1') {
        console.error(`[multi-auth] catalog fetch failed: ${res.status}`)
      }
      return []
    }
    const data = (await res.json()) as { models?: RawCatalogModel[] }
    const models = Array.isArray(data?.models) ? data.models : []
    return models
      .filter((m) => typeof m.slug === 'string' && m.visibility === 'list')
      .map((m) => ({
        slug: m.slug!,
        displayName: m.display_name || m.slug!,
        contextWindow: m.context_window,
        maxContextWindow: m.max_context_window,
        reasoningLevels: (m.supported_reasoning_levels || [])
          .map((l) => l?.effort)
          .filter((e): e is string => typeof e === 'string'),
        priority: m.priority,
        visibility: m.visibility
      }))
  } catch (err) {
    if (process.env.OPENCODE_MULTI_AUTH_DEBUG === '1') {
      console.error('[multi-auth] catalog fetch error:', err)
    }
    return []
  }
}

export async function getCodexCatalog(
  account: AccountCredentials,
  options?: { force?: boolean }
): Promise<ModelCatalogEntry[]> {
  const cached = account.catalog
  const fetchedAt = account.catalogFetchedAt || 0
  if (!options?.force && cached && cached.length > 0 && Date.now() - fetchedAt < CATALOG_TTL_MS) {
    return cached
  }

  const fresh = await fetchCodexCatalog(account.accessToken, account.accountId)
  if (fresh.length > 0) {
    try {
      updateAccount(account.alias, { catalog: fresh, catalogFetchedAt: Date.now() })
    } catch {
      // store write is best-effort; still return the fresh list
    }
    return fresh
  }

  return cached && cached.length > 0 ? cached : []
}

export function getCatalogSlugs(account: AccountCredentials): string[] {
  const cached = account.catalog
  if (cached && cached.length > 0) {
    return cached.map((entry) => entry.slug)
  }
  return DEFAULT_CATALOG_SLUGS
}

/**
 * Pick the model to route a retired/unknown request to.
 * Priority: explicit env override > gpt-6-astra (when the account has it) >
 * lowest catalog priority > gpt-5.6-sol.
 */
export function pickDefaultModel(account: AccountCredentials): string {
  const override = (process.env.OPENCODE_MULTI_AUTH_CODEX_LATEST_MODEL || '').trim()
  const catalog = account.catalog && account.catalog.length > 0 ? account.catalog : null

  if (override) {
    if (!catalog || catalog.some((entry) => entry.slug === override)) return override
  }

  if (catalog) {
    if (catalog.some((entry) => entry.slug === 'gpt-6-astra')) return 'gpt-6-astra'
    const sorted = [...catalog].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
    if (sorted[0]?.slug) return sorted[0].slug
  }

  return override || 'gpt-6-astra'
}

export function getCatalogContextWindow(
  account: AccountCredentials,
  slug: string
): number | undefined {
  const entry = account.catalog?.find((m) => m.slug === slug)
  return entry?.contextWindow
}

export function getKnownCatalogSlugs(): string[] {
  const store = loadStore()
  const slugs = new Set<string>()
  for (const account of Object.values(store.accounts)) {
    for (const entry of account.catalog || []) slugs.add(entry.slug)
  }
  return slugs.size > 0 ? [...slugs] : DEFAULT_CATALOG_SLUGS
}
