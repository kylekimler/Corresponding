/**
 * Corresponding Fill is radically free.
 * There is no account, trial, author cap, or paid plan.
 * This module exists so a paywall cannot grow by accident.
 */

export const FREE_ACCESS = {
  license: 'MIT',
  accountRequired: false,
  trialRequired: false,
  paidPlanRequired: false,
  authorLimit: null,
  canFill: true,
  canImport: true,
} as const;

export type FreeAccess = typeof FREE_ACCESS;

export function getAccess(): FreeAccess {
  return FREE_ACCESS;
}
