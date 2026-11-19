import { errorBodySchema } from './schemas';
import { readSseEvents } from './sse';
import type { ReviewEvent, ReviewRequest } from './types';

/**
 * Calls POST /api/review and hands every server-sent event to `onEvent`. Returns true when the stream
 * ended with a terminal event (done, error or needs_selection), false when it was cut off.
 */
export async function streamReview(
  body: ReviewRequest,
  onEvent: (event: ReviewEvent) => void,
  signal: AbortSignal,
): Promise<boolean> {
  const response = await fetch('/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    const parsed = errorBodySchema.safeParse(await response.json().catch(() => null));
    onEvent({
      type: 'error',
      code: parsed.success ? parsed.data.code : 'upstream',
      message: parsed.success
        ? parsed.data.message
        : `The review could not start (HTTP ${response.status}).`,
    });
    return true;
  }

  let terminal = false;
  for await (const event of readSseEvents(response.body)) {
    if (event.type === 'done' || event.type === 'error' || event.type === 'needs_selection')
      terminal = true;
    onEvent(event);
  }
  return terminal;
}
