import { describe, expect, test } from 'bun:test'
import { isRetiredModel, pickDefaultModel } from '../src/models.js'
import type { AccountCredentials } from '../src/types.js'

function account(overrides: Partial<AccountCredentials> = {}): AccountCredentials {
  return {
    alias: 'test',
    accessToken: 'token',
    refreshToken: 'refresh',
    expiresAt: Date.now() + 3600_000,
    usageCount: 0,
    ...overrides
  }
}

describe('isRetiredModel', () => {
  const retired = [
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-pro',
    'gpt-5.1',
    'gpt-5.2',
    'gpt-5.2-codex',
    'gpt-5.3-codex',
    'gpt-5.3-codex-spark',
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.5-pro',
    'gpt-5.6',
    'gpt-5-codex',
    'gpt-5.1-codex-max'
  ]
  const available = [
    'gpt-5.5',
    'gpt-5.6-sol',
    'gpt-5.6-terra',
    'gpt-5.6-luna',
    'gpt-6-astra',
    'gpt-6-luna',
    'gpt-6-sol'
  ]

  for (const id of retired) {
    test(`${id} is retired`, () => expect(isRetiredModel(id)).toBe(true))
  }
  for (const id of available) {
    test(`${id} is available`, () => expect(isRetiredModel(id)).toBe(false))
  }
  test('strips provider prefix', () => expect(isRetiredModel('openai/gpt-5.4')).toBe(true))
})

describe('pickDefaultModel', () => {
  test('prefers gpt-6-astra when the account has it', () => {
    const acc = account({
      catalog: [
        { slug: 'gpt-6-sol', displayName: 'x', reasoningLevels: [], priority: 0 },
        { slug: 'gpt-6-astra', displayName: 'x', reasoningLevels: [], priority: 1 }
      ]
    })
    expect(pickDefaultModel(acc)).toBe('gpt-6-astra')
  })

  test('falls back to lowest priority without astra', () => {
    const acc = account({
      catalog: [
        { slug: 'gpt-5.6-sol', displayName: 'x', reasoningLevels: [], priority: 4 },
        { slug: 'gpt-6-luna', displayName: 'x', reasoningLevels: [], priority: 2 }
      ]
    })
    expect(pickDefaultModel(acc)).toBe('gpt-6-luna')
  })

  test('defaults to gpt-6-astra with no catalog', () => {
    expect(pickDefaultModel(account())).toBe('gpt-6-astra')
  })
})
