export const SEVERITIES = ['blocker', 'bug', 'risk', 'nit'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** A finding as produced by the model and validated by the server. */
export interface Finding {
  id: string;
  file: string;
  line: number;
  /** Last line of a multi-line range, when the finding spans several lines. */
  endLine?: number;
  severity: Severity;
  category: string;
  title: string;
  explanation: string;
  /** Replacement code for the cited line range, only when a concrete fix is certain. */
  suggestion?: string;
  /** 0 to 1. */
  confidence: number;
  /** The new-side source lines the finding cites, copied from the diff on the server. */
  originalCode?: string;
}

export type TriageStatus = 'pending' | 'accepted' | 'dismissed';

export interface TriagedFinding extends Finding {
  status: TriageStatus;
  edited: boolean;
}

export interface PullRequestMeta {
  owner: string;
  repo: string;
  number: number;
  title: string;
  author: string;
  url: string;
  headSha: string;
  baseRef: string;
  headRef: string;
  body: string;
}

type DiffLineType = 'add' | 'del' | 'context';

interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export type FileStatus = 'added' | 'deleted' | 'modified' | 'renamed';

export interface DiffFile {
  path: string;
  oldPath: string;
  status: FileStatus;
  isBinary: boolean;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export type SkipReason = 'lockfile' | 'generated' | 'binary' | 'deleted';

export interface FileSummary {
  path: string;
  additions: number;
  deletions: number;
  skipReason?: SkipReason;
  /** True when the file is part of this review. */
  selected: boolean;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export const REVIEW_ERROR_CODES = [
  'invalid_url',
  'not_found',
  'private_repo',
  'rate_limited',
  'too_large',
  'too_costly',
  'nothing_to_review',
  'too_many_requests',
  'bad_request',
  'upstream',
  'model_error',
] as const;
export type ReviewErrorCode = (typeof REVIEW_ERROR_CODES)[number];

type ReviewStage = 'fetching' | 'chunking' | 'reviewing' | 'done';

/** Server-sent events emitted by POST /api/review, one JSON object per `data:` line. */
export type ReviewEvent =
  | { type: 'stage'; stage: ReviewStage; message: string; current?: number; total?: number }
  | {
      type: 'meta';
      pr: PullRequestMeta;
      files: FileSummary[];
      changedLines: number;
      maxChangedLines: number;
      demo: boolean;
      model: string;
    }
  | { type: 'needs_selection'; changedLines: number; maxChangedLines: number }
  | { type: 'finding'; finding: Finding }
  | { type: 'usage'; usage: Usage }
  | { type: 'warning'; message: string }
  | { type: 'error'; code: ReviewErrorCode; message: string }
  | { type: 'done'; usage: Usage; findingCount: number };

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ReviewRequest {
  url: string;
  model: string;
  includeSkipped: boolean;
  selectedFiles?: string[];
}

export type ReviewStatus =
  'idle' | 'streaming' | 'needs_selection' | 'done' | 'error' | 'interrupted' | 'stopped';

export interface Progress {
  message: string;
  current?: number;
  total?: number;
}

export type FindingEdit = Partial<
  Pick<Finding, 'title' | 'explanation' | 'suggestion' | 'severity'>
>;

export interface ChunkReviewInput {
  pr: PullRequestMeta;
  chunk: Chunk;
  model: string;
  signal?: AbortSignal;
}

interface ChunkReviewOutput {
  /** Parsed JSON returned by the model, validated by the caller. */
  raw: unknown;
  usage: Usage;
  warning?: string;
}

export type ChunkReviewer = (input: ChunkReviewInput) => Promise<ChunkReviewOutput>;

export interface Chunk {
  id: string;
  path: string;
  hunks: DiffHunk[];
  changedLines: number;
  /** 1-based part number when a large file is split across several chunks. */
  part: number;
  parts: number;
}

export interface DemoFixture {
  source: string;
  model: string;
  pr: PullRequestMeta;
  diff: string;
  chunks: Record<string, { usage: Usage; response: unknown }>;
}
