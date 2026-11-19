import { changedLineCount } from './diff-parser';
import { defaultSkipReason } from './file-filters';
import type { Chunk, DiffFile, DiffHunk, FileSummary } from './types';

export const DEFAULT_MAX_CHANGED_LINES = 1500;
const DEFAULT_MAX_LINES_PER_CHUNK = 400;

interface ReviewSetOptions {
  includeSkipped: boolean;
  selectedFiles?: string[];
  maxChangedLines: number;
}

interface ReviewSet {
  summaries: FileSummary[];
  files: DiffFile[];
  changedLines: number;
  overCap: boolean;
}

/**
 * Decides which files go into the review. Lockfiles, generated files, deleted files and binaries are
 * skipped unless `includeSkipped` is set; binaries never have reviewable text so they are always skipped.
 * When the user picked files (because the diff was over the cap), only those are kept.
 */
export function selectReviewSet(all: DiffFile[], options: ReviewSetOptions): ReviewSet {
  const picked = options.selectedFiles ? new Set(options.selectedFiles) : null;

  const summaries: FileSummary[] = all.map((file) => {
    const skipReason = defaultSkipReason(file);
    const eligible =
      skipReason === undefined || (options.includeSkipped && skipReason !== 'binary');
    const selected = eligible && (picked ? picked.has(file.path) : true);
    return {
      path: file.path,
      additions: file.additions,
      deletions: file.deletions,
      skipReason,
      selected,
    };
  });

  const selectedPaths = new Set(
    summaries.filter((summary) => summary.selected).map((summary) => summary.path),
  );
  const files = all.filter((file) => selectedPaths.has(file.path) && file.hunks.length > 0);
  const changedLines = files.reduce((total, file) => total + changedLineCount(file), 0);

  return { summaries, files, changedLines, overCap: changedLines > options.maxChangedLines };
}

function hunkChangedLines(hunk: DiffHunk): number {
  return hunk.lines.filter((line) => line.type !== 'context').length;
}

/**
 * Splits the review into model requests. Each file is one chunk; a file with more changed lines than
 * `maxLinesPerChunk` is split into batches of whole hunks so every request keeps complete hunks.
 */
export function buildChunks(
  files: DiffFile[],
  maxLinesPerChunk = DEFAULT_MAX_LINES_PER_CHUNK,
): Chunk[] {
  const chunks: Chunk[] = [];

  for (const file of files) {
    const batches: DiffHunk[][] = [];
    let batch: DiffHunk[] = [];
    let batchLines = 0;

    for (const hunk of file.hunks) {
      const lines = hunkChangedLines(hunk);
      if (batch.length > 0 && batchLines + lines > maxLinesPerChunk) {
        batches.push(batch);
        batch = [];
        batchLines = 0;
      }
      batch.push(hunk);
      batchLines += lines;
    }
    if (batch.length > 0) batches.push(batch);

    batches.forEach((hunks, index) => {
      chunks.push({
        id: `${file.path}#${index + 1}`,
        path: file.path,
        hunks,
        changedLines: hunks.reduce((total, hunk) => total + hunkChangedLines(hunk), 0),
        part: index + 1,
        parts: batches.length,
      });
    });
  }

  return chunks;
}

/**
 * Renders a chunk with explicit new-side line numbers so the model can cite exact lines.
 * Removed lines have no new-side number and are shown with a blank gutter.
 */
export function renderChunk(chunk: Chunk): string {
  const out: string[] = [];
  for (const hunk of chunk.hunks) {
    out.push(hunk.header);
    for (const line of hunk.lines) {
      const marker = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';
      const gutter = line.newLine === undefined ? '     ' : String(line.newLine).padStart(5, ' ');
      out.push(`${gutter} ${marker} ${line.content}`);
    }
  }
  return out.join('\n');
}

/** New-side line numbers a finding may cite for this chunk. */
export function commentableLines(chunk: Chunk): Map<number, string> {
  const map = new Map<number, string>();
  for (const hunk of chunk.hunks) {
    for (const line of hunk.lines) {
      if (line.newLine !== undefined) map.set(line.newLine, line.content);
    }
  }
  return map;
}

/** Rough token estimate (about 3.5 characters per token for code), used by the cost guard before any request. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
