import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureOpenCodeAuth, getOpenCodeAuthPath, hasOpenCodeAuth } from '../src/opencode-auth.js'
import type { AccountCredentials } from '../src/types.js'

const originalXdg = process.env.XDG_DATA_HOME
let dir: string

function account(overrides: Partial<AccountCredentials> = {}): AccountCredentials {
  return {
    alias: 'test',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    accountId: 'acct-1',
    expiresAt: 1234567890,
    usageCount: 0,
    ...overrides
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'oc-auth-'))
  process.env.XDG_DATA_HOME = dir
})

afterEach(() => {
  if (originalXdg === undefined) delete process.env.XDG_DATA_HOME
  else process.env.XDG_DATA_HOME = originalXdg
  rmSync(dir, { recursive: true, force: true })
})

describe('ensureOpenCodeAuth', () => {
  test('writes an oauth entry for the provider', () => {
    expect(hasOpenCodeAuth()).toBe(false)
    ensureOpenCodeAuth(account())
    expect(hasOpenCodeAuth()).toBe(true)

    const data = JSON.parse(readFileSync(getOpenCodeAuthPath(), 'utf-8'))
    expect(data.openai).toEqual({
      type: 'oauth',
      refresh: 'refresh-token',
      access: 'access-token',
      expires: 1234567890,
      accountId: 'acct-1'
    })
  })

  test('preserves unrelated providers', () => {
    mkdirSync(join(dir, 'opencode'), { recursive: true })
    writeFileSync(getOpenCodeAuthPath(), JSON.stringify({ vilao: { type: 'api', key: 'k' } }))
    ensureOpenCodeAuth(account())
    const data = JSON.parse(readFileSync(getOpenCodeAuthPath(), 'utf-8'))
    expect(data.vilao).toEqual({ type: 'api', key: 'k' })
    expect(data.openai.type).toBe('oauth')
  })

  test('does not clobber an existing entry', () => {
    mkdirSync(join(dir, 'opencode'), { recursive: true })
    writeFileSync(
      getOpenCodeAuthPath(),
      JSON.stringify({ openai: { type: 'oauth', refresh: 'r', access: 'a', expires: 1 } })
    )
    ensureOpenCodeAuth(account())
    const data = JSON.parse(readFileSync(getOpenCodeAuthPath(), 'utf-8'))
    expect(data.openai.access).toBe('a')
  })

  test('skips accounts without tokens', () => {
    ensureOpenCodeAuth(account({ refreshToken: '' }))
    expect(hasOpenCodeAuth()).toBe(false)
  })
})
