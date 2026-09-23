import type { AccountCredentials, AccountRateLimits } from './types.js';
export interface ProbeResult {
    rateLimits?: AccountRateLimits;
    error?: string;
}
export declare function probeRateLimitsForAccount(account: AccountCredentials): Promise<ProbeResult>;
//# sourceMappingURL=probe-limits.d.ts.map