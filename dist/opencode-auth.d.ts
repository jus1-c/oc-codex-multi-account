import type { AccountCredentials } from './types.js';
export declare function getOpenCodeAuthPath(): string;
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
export declare function ensureOpenCodeAuth(account: AccountCredentials): void;
export declare function hasOpenCodeAuth(): boolean;
//# sourceMappingURL=opencode-auth.d.ts.map