import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { createClaudeReviewer } from '@/lib/claude-reviewer';
import { serverConfig } from '@/lib/config';
import { createDemoDependencies, demoFixture } from '@/lib/demo';
import { parsePullRequestUrl } from '@/lib/github';
import { fetchPullRequest } from '@/lib/github-api';
import { isKnownModel } from '@/lib/models';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';
import { type ReviewDependencies, runReview } from '@/lib/review-service';
import { toSseStream } from '@/lib/sse';
import type { ReviewErrorCode } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A large pull request takes a few minutes at concurrency 2.
export const maxDuration = 300;

const bodySchema = z.object({
  url: z.string().trim().min(1).max(500),
  model: z.string().max(100).optional(),
  includeSkipped: z.boolean().optional(),
  selectedFiles: z.array(z.string().max(1000)).max(1000).optional(),
});

const MAX_BODY_BYTES = 64_000;

let limiter: ReturnType<typeof createRateLimiter> | null = null;

function jsonError(
  status: number,
  code: ReviewErrorCode,
  message: string,
  headers: HeadersInit = {},
): Response {
  return Response.json({ code, message }, { status, headers });
}

/** Browsers send Origin on cross-site POSTs; only this app's own pages may start a review. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function readBody(request: Request): Promise<z.infer<typeof bodySchema> | null> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    const parsed = bodySchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const config = serverConfig();

  if (!isSameOrigin(request))
    return jsonError(403, 'bad_request', 'Reviews can only be started from this site.');

  const body = await readBody(request);
  if (!body) return jsonError(400, 'bad_request', 'Send a JSON body with a pull request URL.');

  const ref = parsePullRequestUrl(body.url);
  if (!ref)
    return jsonError(
      400,
      'invalid_url',
      'That does not look like a GitHub pull request URL, for example https://github.com/owner/repo/pull/123.',
    );

  limiter ??= createRateLimiter(config.rateLimitPerWindow, config.rateLimitWindowMs);
  const limit = limiter(clientIp(request.headers));
  if (!limit.allowed) {
    return jsonError(
      429,
      'too_many_requests',
      `You have started a lot of reviews. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
      {
        'Retry-After': String(limit.retryAfterSeconds),
      },
    );
  }

  const demo = !config.apiKey;
  const requested = body.model && isKnownModel(body.model) ? body.model : config.defaultModel;
  // Demo mode replays a saved review, so report the model that produced it.
  const model = demo ? demoFixture.model : requested;

  let answered = false;
  const reviewer = createClaudeReviewer(
    new Anthropic({ apiKey: config.apiKey }),
    config.effort,
    config.maxOutputTokens,
  );
  const deps: ReviewDependencies = demo
    ? createDemoDependencies()
    : {
        fetchPullRequest: (pullRef, signal) =>
          fetchPullRequest(pullRef, { token: config.githubToken, signal }),
        reviewChunk: async (input) => {
          const output = await reviewer(input);
          if (output.usage.inputTokens > 0) answered = true;
          return output;
        },
      };

  const events = runReview(
    {
      ref,
      model,
      includeSkipped: body.includeSkipped ?? false,
      selectedFiles: body.selectedFiles,
      maxChangedLines: config.maxChangedLines,
      maxInputTokens: config.maxInputTokens,
      maxOutputTokens: config.maxOutputTokens,
      demo,
      signal: request.signal,
    },
    deps,
  );

  async function* counted() {
    try {
      yield* events;
    } finally {
      limit.settle(answered);
    }
  }

  return new Response(toSseStream(counted()), {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
