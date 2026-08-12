/**
 * Future entitlement checking interface.
 * Do not build payments until the core form-filling flow is reliable.
 */

export type EntitlementPlan = 'free' | 'pro' | 'team' | 'unknown';

export interface EntitlementStatus {
  plan: EntitlementPlan;
  canFill: boolean;
  canImportSheets: boolean;
  maxAuthors: number | null;
  message?: string;
}

export interface EntitlementClient {
  getStatus(): Promise<EntitlementStatus>;
}

/** Local-only stub: everything allowed while core fill flow matures. */
export function createOpenEntitlementClient(): EntitlementClient {
  return {
    async getStatus(): Promise<EntitlementStatus> {
      return {
        plan: 'free',
        canFill: true,
        canImportSheets: true,
        maxAuthors: null,
        message: 'Entitlements not enforced in this build.',
      };
    },
  };
}
