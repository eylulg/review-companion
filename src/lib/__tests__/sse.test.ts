import { describe, expect, it } from 'vitest';
import { collect } from '@/test-utils/review-stream';
import { encodeEvent, readSseEvents } from '../sse';
import type { ReviewEvent } from '../types';

function streamOf(text: string, chunkSize: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      for (let index = 0; index < bytes.length; index += chunkSize)
        controller.enqueue(bytes.slice(index, index + chunkSize));
      controller.close();
    },
  });
}

describe('readSseEvents', () => {
  it('reassembles events split across arbitrary chunks and skips events that fail validation', async () => {
    const events: ReviewEvent[] = [
      { type: 'stage', stage: 'fetching', message: 'Fetching\nwith newline' },
      { type: 'warning', message: 'data: not a field' },
      { type: 'done', usage: { inputTokens: 1, outputTokens: 2 }, findingCount: 0 },
    ];
    const text = `${encodeEvent(events[0] as ReviewEvent)}data: {"type":"finding","finding":{}}\n\n${events.slice(1).map(encodeEvent).join('')}`;

    const received = await collect(readSseEvents(streamOf(text, 7)));

    expect(received).toEqual(events);
  });
});
