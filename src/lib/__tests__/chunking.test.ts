import { describe, expect, it } from 'vitest';
import { sampleFile, sampleFiles } from '@/test-utils/review-stream';
import { buildChunks, renderChunk, selectReviewSet } from '../chunking';
import type { DiffFile, DiffHunk } from '../types';

function syntheticFile(path: string, hunkSizes: number[]): DiffFile {
  let start = 1;
  const hunks = hunkSizes.map((size): DiffHunk => {
    const hunk = {
      header: `@@ -${start},0 +${start},${size} @@`,
      oldStart: start,
      oldLines: 0,
      newStart: start,
      newLines: size,
      lines: Array.from({ length: size }, (_, index) => ({
        type: 'add' as const,
        content: `line ${start + index}`,
        newLine: start + index,
      })),
    };
    start += size + 10;
    return hunk;
  });
  return {
    path,
    oldPath: path,
    status: 'modified',
    isBinary: false,
    hunks,
    additions: hunkSizes.reduce((a, b) => a + b, 0),
    deletions: 0,
  };
}

describe('selectReviewSet', () => {
  it.each([
    {
      name: 'skips lockfiles by default',
      options: { includeSkipped: false, maxChangedLines: 1500 },
      files: ['src/api/users.ts', 'src/components/user-table.tsx', 'src/utils/paginate.ts'],
      changedLines: 82,
      overCap: false,
    },
    {
      name: 'includes lockfiles when asked',
      options: { includeSkipped: true, maxChangedLines: 1500 },
      files: [
        'package-lock.json',
        'src/api/users.ts',
        'src/components/user-table.tsx',
        'src/utils/paginate.ts',
      ],
      changedLines: 84,
      overCap: false,
    },
    {
      name: 'flags a set over the cap',
      options: { includeSkipped: false, maxChangedLines: 50 },
      files: ['src/api/users.ts', 'src/components/user-table.tsx', 'src/utils/paginate.ts'],
      changedLines: 82,
      overCap: true,
    },
    {
      name: 'keeps only the files the user picked',
      options: {
        includeSkipped: false,
        maxChangedLines: 50,
        selectedFiles: ['src/utils/paginate.ts', 'src/api/users.ts'],
      },
      files: ['src/api/users.ts', 'src/utils/paginate.ts'],
      changedLines: 19,
      overCap: false,
    },
  ])('$name', ({ options, files, changedLines, overCap }) => {
    const set = selectReviewSet(sampleFiles(), options);

    expect(set.files.map((file) => file.path)).toEqual(files);
    expect(set.changedLines).toBe(changedLines);
    expect(set.overCap).toBe(overCap);
  });

  it('never selects a binary file, even with skipped files included', () => {
    const binary = { ...syntheticFile('logo.png', [1]), isBinary: true };

    const set = selectReviewSet([binary], { includeSkipped: true, maxChangedLines: 1500 });

    expect(set.summaries[0]).toMatchObject({ skipReason: 'binary', selected: false });
  });
});

describe('buildChunks', () => {
  it('splits a large file into batches of whole hunks and keeps small files whole', () => {
    const chunks = buildChunks(
      [syntheticFile('big.ts', [150, 150, 150, 500, 20]), syntheticFile('small.ts', [10])],
      400,
    );

    expect(chunks.map((chunk) => [chunk.id, chunk.changedLines, chunk.parts])).toEqual([
      ['big.ts#1', 300, 4],
      ['big.ts#2', 150, 4],
      ['big.ts#3', 500, 4],
      ['big.ts#4', 20, 4],
      ['small.ts#1', 10, 1],
    ]);
  });
});

describe('renderChunk', () => {
  it('prefixes each line with its new-side number, leaving removed lines unnumbered', () => {
    const [chunk] = buildChunks([sampleFile('src/api/users.ts')]);
    if (!chunk) throw new Error('expected a chunk');

    const lines = renderChunk(chunk).split('\n');

    expect(lines).toContain(
      '   14 +   const response = await fetch(`/api/users?q=${query}&page=${page}`);',
    );
    expect(lines).toContain('      - export async function fetchUsers(): Promise<User[]> {');
  });
});
