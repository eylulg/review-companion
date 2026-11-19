import { describe, expect, it } from 'vitest';
import { formatTokens } from '../ordering';

describe('formatTokens', () => {
  it.each([
    [950, '950'],
    [4983, '5.0k'],
    [123_456, '123k'],
  ])('%i -> %s', (count, expected) => {
    expect(formatTokens(count)).toBe(expected);
  });
});
