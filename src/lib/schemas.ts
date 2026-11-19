import { z } from 'zod';
import {
  type FileSummary,
  type Finding,
  type PullRequestMeta,
  REVIEW_ERROR_CODES,
  type ReviewEvent,
  SEVERITIES,
  type TriagedFinding,
  type Usage,
} from './types';

export const errorCodeSchema = z.enum(REVIEW_ERROR_CODES);

export const usageSchema: z.ZodType<Usage> = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
});

export const pullRequestMetaSchema: z.ZodType<PullRequestMeta> = z.object({
  owner: z.string(),
  repo: z.string(),
  number: z.number(),
  title: z.string(),
  author: z.string(),
  url: z.string(),
  headSha: z.string(),
  baseRef: z.string(),
  headRef: z.string(),
  body: z.string(),
});

export const fileSummarySchema: z.ZodType<FileSummary> = z.object({
  path: z.string(),
  additions: z.number(),
  deletions: z.number(),
  skipReason: z.enum(['lockfile', 'generated', 'binary', 'deleted']).optional(),
  selected: z.boolean(),
});

const findingSchema: z.ZodType<Finding> = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  line: z.number().int().positive(),
  endLine: z.number().int().positive().optional(),
  severity: z.enum(SEVERITIES),
  category: z.string(),
  title: z.string(),
  explanation: z.string(),
  suggestion: z.string().optional(),
  confidence: z.number().min(0).max(1),
  originalCode: z.string().optional(),
});

export const triagedFindingSchema: z.ZodType<TriagedFinding> = z.intersection(
  findingSchema,
  z.object({ status: z.enum(['pending', 'accepted', 'dismissed']), edited: z.boolean() }),
);

/** Validates every server-sent event before it reaches the store. */
export const reviewEventSchema: z.ZodType<ReviewEvent> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stage'),
    stage: z.enum(['fetching', 'chunking', 'reviewing', 'done']),
    message: z.string(),
    current: z.number().optional(),
    total: z.number().optional(),
  }),
  z.object({
    type: z.literal('meta'),
    pr: pullRequestMetaSchema,
    files: z.array(fileSummarySchema),
    changedLines: z.number(),
    maxChangedLines: z.number(),
    demo: z.boolean(),
    model: z.string(),
  }),
  z.object({
    type: z.literal('needs_selection'),
    changedLines: z.number(),
    maxChangedLines: z.number(),
  }),
  z.object({ type: z.literal('finding'), finding: findingSchema }),
  z.object({ type: z.literal('usage'), usage: usageSchema }),
  z.object({ type: z.literal('warning'), message: z.string() }),
  z.object({ type: z.literal('error'), code: errorCodeSchema, message: z.string() }),
  z.object({ type: z.literal('done'), usage: usageSchema, findingCount: z.number() }),
]);

/** Body of a non-streaming error response from POST /api/review. */
export const errorBodySchema = z.object({ code: errorCodeSchema, message: z.string() });
