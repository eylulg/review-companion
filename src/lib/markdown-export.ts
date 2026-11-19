import { lineUrl } from './github';
import type { PullRequestMeta, Severity, TriagedFinding } from './types';

export const SEVERITY_LABEL: Record<Severity, string> = {
  blocker: 'Blocker',
  bug: 'Bug',
  risk: 'Risk',
  nit: 'Nit',
};

export interface ExportOptions {
  /** Export pending findings too, not only accepted ones. Dismissed findings are never exported. */
  includePending: boolean;
  /** Add links to the cited lines on GitHub. Off for the demo pull request, which does not exist. */
  linkLines: boolean;
  /** File order from the pull request, so the export follows the diff. */
  fileOrder?: string[];
}

/** A code fence longer than any run of backticks inside the code, so the block cannot be closed early. */
function fenceFor(code: string): string {
  const longest = Math.max(0, ...Array.from(code.matchAll(/`+/g), (match) => match[0].length));
  return '`'.repeat(Math.max(3, longest + 1));
}

function lineLabel(finding: TriagedFinding): string {
  return finding.endLine && finding.endLine > finding.line
    ? `lines ${finding.line} to ${finding.endLine}`
    : `line ${finding.line}`;
}

/** Findings that would be exported, in file order then line order. */
export function exportableFindings(
  findings: TriagedFinding[],
  options: Pick<ExportOptions, 'includePending' | 'fileOrder'>,
): TriagedFinding[] {
  const order = new Map((options.fileOrder ?? []).map((path, index) => [path, index]));
  return findings
    .filter(
      (finding) =>
        finding.status === 'accepted' || (options.includePending && finding.status === 'pending'),
    )
    .sort((a, b) => {
      const fileA = order.get(a.file) ?? Number.MAX_SAFE_INTEGER;
      const fileB = order.get(b.file) ?? Number.MAX_SAFE_INTEGER;
      if (fileA !== fileB) return fileA - fileB;
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.line - b.line;
    });
}

/** One finding as a ready to paste GitHub review comment. */
function findingToComment(finding: TriagedFinding): string {
  const parts = [
    `**${SEVERITY_LABEL[finding.severity]} (${finding.category}): ${finding.title}**`,
    '',
    finding.explanation,
  ];
  if (finding.suggestion !== undefined) {
    const fence = fenceFor(finding.suggestion);
    parts.push('', `${fence}suggestion`, finding.suggestion, fence);
  }
  return parts.join('\n');
}

/**
 * Builds the export: findings grouped by file, each one a comment block that can be pasted on the
 * cited line in GitHub. Suggestions use GitHub's `suggestion` blocks so the author can apply them in one click.
 */
export function buildReviewMarkdown(
  findings: TriagedFinding[],
  pr: PullRequestMeta | null,
  options: ExportOptions,
): string {
  const selected = exportableFindings(findings, options);
  const heading = pr
    ? `## Review notes for ${pr.owner}/${pr.repo}#${pr.number}`
    : '## Review notes';
  if (selected.length === 0)
    return `${heading}\n\nNo findings to export yet. Accept findings to add them here.\n`;

  const out: string[] = [
    heading,
    '',
    `${selected.length} comment${selected.length === 1 ? '' : 's'}, grouped by file.`,
  ];
  let currentFile: string | null = null;

  for (const finding of selected) {
    if (finding.file !== currentFile) {
      currentFile = finding.file;
      out.push('', `### \`${finding.file}\``);
    }
    const where = lineLabel(finding);
    const link =
      options.linkLines && pr
        ? ` ([view on GitHub](${lineUrl(pr, finding.file, finding.line, finding.endLine)}))`
        : '';
    out.push(
      '',
      `#### ${where.charAt(0).toUpperCase()}${where.slice(1)}${link}`,
      '',
      findingToComment(finding),
    );
  }

  return `${out.join('\n')}\n`;
}
