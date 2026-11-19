import { describe, expect, it } from 'vitest';
import { clientIp, createRateLimiter } from '../rate-limit';

describe('createRateLimiter', () => {
  it('lets only settled, counted requests use up the allowance of a key and window', () => {
    let time = 0;
    const reserve = createRateLimiter(2, 1000, () => time);

    reserve('a').settle(false);
    const first = reserve('a');
    const second = reserve('a');
    const whileRunning = reserve('a');
    first.settle(true);
    second.settle(true);
    const afterTwo = reserve('a');
    const other = reserve('b').allowed;
    time = 1000;
    const nextWindow = reserve('a').allowed;

    expect([
      whileRunning.allowed,
      afterTwo.allowed,
      afterTwo.retryAfterSeconds,
      other,
      nextWindow,
    ]).toEqual([false, false, 1, true, true]);
  });
});

describe('clientIp', () => {
  it.each([
    [{ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, '1.2.3.4'],
    [{ 'x-real-ip': '5.6.7.8' }, '5.6.7.8'],
    [{}, 'unknown'],
  ])('reads %o', (headers, expected) => {
    expect(clientIp(new Headers(headers))).toBe(expected);
  });
});
