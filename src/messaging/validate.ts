import { z } from 'zod';
import { RosterSchema } from '@/schema/author';
import type { ExtensionRequest } from './protocol';

const PingSchema = z.object({ type: z.literal('PING') });
const DetectSchema = z.object({ type: z.literal('DETECT') });
const InspectSchema = z.object({ type: z.literal('INSPECT') });
const DiagnosticSchema = z.object({ type: z.literal('DIAGNOSTIC') });

const PreviewSchema = z.object({
  type: z.literal('PREVIEW'),
  roster: RosterSchema,
  overwrite: z.boolean(),
});

const FillSchema = z.object({
  type: z.literal('FILL'),
  roster: RosterSchema,
  overwrite: z.boolean(),
});

const ValidateSchema = z.object({
  type: z.literal('VALIDATE'),
  roster: RosterSchema,
});

const ExtensionRequestSchema = z.discriminatedUnion('type', [
  PingSchema,
  DetectSchema,
  InspectSchema,
  PreviewSchema,
  FillSchema,
  ValidateSchema,
  DiagnosticSchema,
]);

export type ParseRequestResult =
  | { ok: true; request: ExtensionRequest }
  | { ok: false; error: string };

/** Validate untrusted extension messages before acting on them. */
export function parseExtensionRequest(message: unknown): ParseRequestResult {
  const result = ExtensionRequestSchema.safeParse(message);
  if (!result.success) {
    return {
      ok: false,
      error: `Invalid extension message: ${result.error.issues
        .slice(0, 3)
        .map((i) => i.message)
        .join('; ')}`,
    };
  }
  return { ok: true, request: result.data as ExtensionRequest };
}
