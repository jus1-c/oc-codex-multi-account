import type { AccountCredentials, ModelCatalogEntry } from './types.js';
export declare function isRetiredModel(modelId: string): boolean;
export declare function fetchCodexCatalog(token: string, accountId: string | undefined): Promise<ModelCatalogEntry[]>;
export declare function getCodexCatalog(account: AccountCredentials, options?: {
    force?: boolean;
}): Promise<ModelCatalogEntry[]>;
export declare function getCatalogSlugs(account: AccountCredentials): string[];
/**
 * Pick the model to route a retired/unknown request to.
 * Priority: explicit env override > gpt-6-astra (when the account has it) >
 * lowest catalog priority > gpt-5.6-sol.
 */
export declare function pickDefaultModel(account: AccountCredentials): string;
export declare function getCatalogContextWindow(account: AccountCredentials, slug: string): number | undefined;
export declare function getKnownCatalogSlugs(): string[];
//# sourceMappingURL=models.d.ts.map