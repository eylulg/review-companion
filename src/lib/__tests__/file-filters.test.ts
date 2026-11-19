import { describe, expect, it } from 'vitest';
import { defaultSkipReason } from '../file-filters';

describe('defaultSkipReason', () => {
  it.each([
    ['package-lock.json', 'modified', 'lockfile'],
    ['apps/web/pnpm-lock.yaml', 'modified', 'lockfile'],
    ['dist/index.js', 'modified', 'generated'],
    ['src/__snapshots__/a.test.ts.snap', 'modified', 'generated'],
    ['public/logo.png', 'added', 'binary'],
    ['src/old.ts', 'deleted', 'deleted'],
    ['src/index.ts', 'modified', undefined],
  ] as const)('%s (%s) -> %s', (path, status, reason) => {
    expect(defaultSkipReason({ path, status, isBinary: false, hunks: [] })).toBe(reason);
  });
});
