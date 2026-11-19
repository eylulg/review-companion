import { z } from 'zod';
import {
  errorCodeSchema,
  fileSummarySchema,
  pullRequestMetaSchema,
  triagedFindingSchema,
  usageSchema,
} from '@/lib/schemas';

const persistedSchema = z.object({
  request: z
    .object({
      url: z.string(),
      model: z.string(),
      includeSkipped: z.boolean(),
      selectedFiles: z.array(z.string()).optional(),
    })
    .nullable(),
  status: z.enum([
    'idle',
    'streaming',
    'needs_selection',
    'done',
    'error',
    'interrupted',
    'stopped',
  ]),
  pr: pullRequestMetaSchema.nullable(),
  files: z.array(fileSummarySchema),
  changedLines: z.number(),
  maxChangedLines: z.number(),
  demo: z.boolean(),
  model: z.string().nullable(),
  findings: z.array(triagedFindingSchema),
  usage: usageSchema,
  warnings: z.array(z.string()),
  error: z.object({ code: errorCodeSchema, message: z.string() }).nullable(),
  activeId: z.string().nullable(),
});

export type PersistedSession = z.infer<typeof persistedSchema>;

const envelopeSchema = z.object({ state: persistedSchema, version: z.number() });

/** Returns the saved session, or null when the stored text is not a session this version can read. */
export function parsePersistedSession(
  raw: string,
): { state: PersistedSession; version: number } | null {
  try {
    const parsed = envelopeSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    // A stream cannot survive a reload: keep what arrived and say so.
    const { state } = parsed.data;
    return {
      ...parsed.data,
      state: { ...state, status: state.status === 'streaming' ? 'interrupted' : state.status },
    };
  } catch {
    return null;
  }
}
