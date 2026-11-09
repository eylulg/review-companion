import type { FileSummary, TriagedFinding } from "./types";

export interface FileGroup {
    path: string;
    findings: TriagedFinding[];
}

/** Groups findings by file in diff order, sorted by line inside each file. */
export function groupFindingsByFile(findings: TriagedFinding[], files: FileSummary[]): FileGroup[] {
    const order = new Map(files.map((file, index) => [file.path, index]));
    const groups = new Map<string, TriagedFinding[]>();
    for (const finding of findings) {
        const list = groups.get(finding.file) ?? [];
        list.push(finding);
        groups.set(finding.file, list);
    }
    return Array.from(groups, ([path, list]) => ({ path, findings: [...list].sort((a, b) => a.line - b.line) })).sort(
        (a, b) => (order.get(a.path) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.path) ?? Number.MAX_SAFE_INTEGER) || a.path.localeCompare(b.path),
    );
}

/** Stable DOM id for a file section. */
export function fileAnchor(path: string): string {
    return `file-${path.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

export function formatTokens(count: number): string {
    if (count < 1000) return String(count);
    return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k`;
}
