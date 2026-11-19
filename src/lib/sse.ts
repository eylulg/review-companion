import { reviewEventSchema } from './schemas';
import type { ReviewEvent } from './types';

export function encodeEvent(event: ReviewEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Turns an async iterable of events into an SSE byte stream. */
export function toSseStream(events: AsyncIterable<ReviewEvent>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = events[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(encodeEvent(value)));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.(undefined);
    },
  });
}

/** Reads `data:` events from an SSE response body. Used by the browser client. */
export async function* readSseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ReviewEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const parseBlock = (block: string): ReviewEvent | null => {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) return null;
    try {
      const parsed = reviewEventSchema.safeParse(JSON.parse(data));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const event = parseBlock(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (event) yield event;
        boundary = buffer.indexOf('\n\n');
      }
    }
    buffer += decoder.decode();
    const tail = parseBlock(buffer);
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}
