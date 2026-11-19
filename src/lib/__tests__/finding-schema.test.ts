import { describe, expect, it } from 'vitest';
import { findingsJsonSchema, validateFindings } from '../finding-schema';

const lines = new Map([
  [10, 'const a = 1;'],
  [11, 'const b = 2;'],
  [12, 'return a + b;'],
]);

const valid = {
  file: 'src/a.ts',
  line: 10,
  endLine: null,
  severity: 'bug',
  category: 'Correctness',
  title: '  Wrong constant ',
  explanation: 'Should be 2.',
  suggestion: 'const a = 2;\n',
  confidence: 0.876,
};

function validate(findings: unknown[]) {
  let id = 0;
  return validateFindings({ findings }, { path: 'src/a.ts', lines, makeId: () => `id-${++id}` });
}

describe('validateFindings', () => {
  it('normalises a valid finding and copies the cited code from the diff', () => {
    const result = validate([valid]);

    expect(result).toEqual({
      rejected: 0,
      findings: [
        {
          id: 'id-1',
          file: 'src/a.ts',
          line: 10,
          endLine: undefined,
          severity: 'bug',
          category: 'correctness',
          title: 'Wrong constant',
          explanation: 'Should be 2.',
          suggestion: 'const a = 2;',
          confidence: 0.88,
          originalCode: 'const a = 1;',
        },
      ],
    });
  });

  it.each([
    ['another file', { ...valid, file: 'src/b.ts' }],
    ['a line outside the diff', { ...valid, line: 99 }],
    ['an unknown severity', { ...valid, severity: 'critical' }],
    ['a confidence above 1', { ...valid, confidence: 2 }],
    ['an empty title', { ...valid, title: '' }],
    ['a value that is not an object', 'nope'],
  ])('rejects a finding with %s', (_name, finding) => {
    expect(validate([finding])).toEqual({ findings: [], rejected: 1 });
  });

  it.each([
    [
      'keeps a range whose lines are all in the diff',
      12,
      12,
      'const a = 1;\nconst b = 2;\nreturn a + b;',
    ],
    ['drops a range that leaves the diff', 14, undefined, 'const a = 1;'],
  ])('%s', (_name, endLine, expectedEnd, originalCode) => {
    const [finding] = validate([{ ...valid, endLine }]).findings;

    expect(finding?.endLine).toBe(expectedEnd);
    expect(finding?.originalCode).toBe(originalCode);
  });

  it('drops a suggestion that is identical to the current code', () => {
    const [finding] = validate([{ ...valid, suggestion: 'const a = 1;' }]).findings;

    expect(finding?.suggestion).toBeUndefined();
  });

  it('returns nothing for a response without a findings array', () => {
    expect(
      validateFindings({ nope: true }, { path: 'src/a.ts', lines, makeId: () => 'x' }),
    ).toEqual({ findings: [], rejected: 0 });
  });

  it('lists every finding property as required, which structured outputs needs to accept the schema', () => {
    const item = findingsJsonSchema.properties.findings.items;

    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort());
  });
});
