import { z } from 'zod';

/**
 * Declarative site files may only name element IDs.
 * No CSS selectors, XPath, or click actions — those would let a PR
 * automate submit/certify/pay.
 */
const IdTemplate = z
  .string()
  .min(1)
  .regex(/^[A-Za-z][A-Za-z0-9_{}-]*$/, 'Site files may only use element IDs');

const DetectId = z.union([
  IdTemplate,
  z.object({
    id: IdTemplate,
    score: z.number().positive().max(1),
  }),
]);

const AuthorFieldKey = z.enum([
  'givenName',
  'middleName',
  'familyName',
  'email',
  'orcid',
  'institution',
  'department',
  'city',
  'state',
  'country',
  'sequence',
]);

export const SiteAuthorsSchema = z.object({
  /** ID of the first-name (or other always-present) field; `{n}` is 1-based. */
  slot: IdTemplate,
  start: z.number().int().positive().default(1),
  fields: z.record(AuthorFieldKey, IdTemplate),
  linkedPid: IdTemplate.optional(),
});

export const SiteCorrespondingSchema = z
  .object({
    givenName: IdTemplate.optional(),
    middleName: IdTemplate.optional(),
    familyName: IdTemplate.optional(),
    email: IdTemplate.optional(),
    sequence: IdTemplate.optional(),
  })
  .optional();

export const SiteDetectSchema = z.object({
  ids: z.array(DetectId).default([]),
  text: z.array(z.string().min(1)).default([]),
  maxConfidence: z.number().min(0).max(1).optional(),
});

export const SiteDefinitionSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Site id must be lowercase kebab-case'),
  label: z.string().min(1),
  /**
   * When false, the site may be detected as a hint but never fills.
   * Use this until a redacted fixture exists.
   */
  autofill: z.boolean().default(false),
  detect: SiteDetectSchema.default({ ids: [], text: [] }),
  authors: SiteAuthorsSchema.optional(),
  corresponding: SiteCorrespondingSchema,
  countField: IdTemplate.optional(),
  notes: z.string().optional(),
});

export type SiteDefinition = z.infer<typeof SiteDefinitionSchema>;
export type AuthorFieldKey = z.infer<typeof AuthorFieldKey>;

export function parseSiteDefinition(raw: unknown): SiteDefinition {
  return SiteDefinitionSchema.parse(raw);
}

export function expandId(template: string, n: number): string {
  return template.replaceAll('{n}', String(n));
}
