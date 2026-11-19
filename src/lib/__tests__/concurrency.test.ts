import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '../concurrency';

describe('mapWithConcurrency', () => {
  it('runs at most the limit at once and yields results in completion order, including failures', async () => {
    let inFlight = 0;
    let peak = 0;
    const results: (number | string)[] = [];

    for await (const result of mapWithConcurrency([30, 5, 10, 1], 2, async (delay, index) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, delay));
      inFlight -= 1;
      if (index === 2) throw new Error('nope');
      return index;
    })) {
      results.push(result.ok ? result.value : 'error');
    }

    expect(peak).toBe(2);
    expect(results).toEqual([1, 'error', 3, 0]);
  });
});
