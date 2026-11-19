import { describe, expect, it } from 'vitest';
import { sampleFile, sampleFiles } from '@/test-utils/review-stream';
import { newSideLines, parseUnifiedDiff } from '../diff-parser';

describe('parseUnifiedDiff', () => {
  it('splits a git diff into files with statuses and the same counts as git numstat', () => {
    const files = sampleFiles();

    expect(files.map((file) => [file.path, file.status, file.additions, file.deletions])).toEqual([
      ['package-lock.json', 'modified', 1, 1],
      ['src/api/users.ts', 'modified', 7, 2],
      ['src/components/user-table.tsx', 'modified', 43, 20],
      ['src/utils/paginate.ts', 'added', 10, 0],
    ]);
  });

  it('numbers lines on both sides, including empty context lines', () => {
    const users = sampleFile('src/api/users.ts');
    const table = newSideLines(sampleFile('src/components/user-table.tsx'));

    expect(users.hunks[0]?.lines.find((line) => line.type === 'del')).toEqual({
      type: 'del',
      content: 'export async function fetchUsers(): Promise<User[]> {',
      oldLine: 8,
    });
    expect(newSideLines(users).get(14)).toBe(
      '  const response = await fetch(`/api/users?q=${query}&page=${page}`);',
    );
    expect(table.get(4)).toBe('');
    expect(table.get(54)).toBe('}');
  });

  it('reads renamed, deleted and binary files', () => {
    const diff = [
      'diff --git a/old name.ts b/new name.ts',
      'similarity index 90%',
      'rename from old name.ts',
      'rename to new name.ts',
      '--- a/old name.ts',
      '+++ b/new name.ts',
      '@@ -1 +1 @@',
      '-a',
      '+b',
      'diff --git a/gone.ts b/gone.ts',
      'deleted file mode 100644',
      '--- a/gone.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-one',
      '-two',
      'diff --git a/logo.png b/logo.png',
      'new file mode 100644',
      'Binary files /dev/null and b/logo.png differ',
    ].join('\n');

    const parsed = parseUnifiedDiff(diff);

    expect(
      parsed.map((file) => [file.oldPath, file.path, file.status, file.isBinary, file.deletions]),
    ).toEqual([
      ['old name.ts', 'new name.ts', 'renamed', false, 1],
      ['gone.ts', 'gone.ts', 'deleted', false, 2],
      ['logo.png', 'logo.png', 'added', true, 0],
    ]);
  });

  it('treats a removed line that starts with dashes as content, not a file header', () => {
    const diff = [
      '--- a/q.sql',
      '+++ b/q.sql',
      '@@ -1,2 +1,1 @@',
      '--- old comment',
      ' select 1;',
      '\\ No newline at end of file',
    ].join('\n');

    const parsed = parseUnifiedDiff(diff);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.hunks[0]?.lines[0]).toEqual({
      type: 'del',
      content: '-- old comment',
      oldLine: 1,
    });
  });

  it('reads hunk headers without counts and CRLF line endings', () => {
    const parsed = parseUnifiedDiff(
      '--- a/x.txt\r\n+++ b/x.txt\r\n@@ -3 +3 @@\r\n-old\r\n+new\r\n',
    );

    expect(parsed[0]?.hunks[0]).toMatchObject({
      oldStart: 3,
      oldLines: 1,
      newStart: 3,
      newLines: 1,
    });
  });
});
