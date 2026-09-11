import { z } from 'zod';
import { RosterSchema } from '@/schema/author';

/** Treat replies as untrusted until the complete payload has been checked. */
export const WebsiteResponseSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PONG'), version: z.string() }),
  z.object({ type: z.literal('SAVED'), roster: RosterSchema }),
  z.object({ type: z.literal('ROSTER'), roster: RosterSchema }),
  z.object({ type: z.literal('SELECTED_ROSTER'), roster: RosterSchema.nullable() }),
  z.object({ type: z.literal('SELECTED'), id: z.string().min(1) }),
  z.object({ type: z.literal('ROSTER_LIST'), rosters: z.array(z.object({
    id: z.string().min(1), name: z.string(), authorCount: z.number().int().nonnegative(), updatedAt: z.string(),
  })) }),
  z.object({ type: z.literal('ERROR'), code: z.enum(['FORBIDDEN', 'INVALID', 'NOT_FOUND', 'INVALID_ROSTER']), message: z.string() }),
]);
