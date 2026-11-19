import { createDemoDependencies, demoFixture } from '@/lib/demo';
import { parseUnifiedDiff } from '@/lib/diff-parser';
import { runReview } from '@/lib/review-service';
import { encodeEvent } from '@/lib/sse';
import type { DiffFile, ReviewEvent } from '@/lib/types';

export const SAMPLE_PR_URL = 'https://github.com/sample/team-directory/pull/42';

/** The files of the sample pull request, in diff order. */
export function sampleFiles(): DiffFile[] {
  return parseUnifiedDiff(demoFixture.diff);
}

export function sampleFile(path: string): DiffFile {
  const file = sampleFiles().find((candidate) => candidate.path === path);
  if (!file) throw new Error(`No sample file ${path}`);
  return file;
}

export async function collect<T>(events: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const event of events) out.push(event);
  return out;
}

/** The events the server sends for the sample pull request, produced by the real pipeline. */
export function sampleEvents(
  maxChangedLines = 1500,
  selectedFiles?: string[],
): Promise<ReviewEvent[]> {
  let id = 0;
  const deps = { ...createDemoDependencies(demoFixture, 0), makeId: () => `f${++id}` };
  return collect(
    runReview(
      {
        ref: { owner: 'sample', repo: 'team-directory', number: 42 },
        model: 'claude-opus-5-5',
        includeSkipped: false,
        maxChangedLines,
        maxInputTokens: 1_000_000,
        demo: false,
        selectedFiles,
      },
      deps,
    ),
  );
}

export function sseResponse(events: ReviewEvent[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(encodeEvent(event)));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
}
