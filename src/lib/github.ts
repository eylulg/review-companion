import type { PullRequestMeta } from "./types";

export interface PullRequestRef {
    owner: string;
    repo: string;
    number: number;
}

const NAME = "[A-Za-z0-9_.-]+";
const URL_PATTERN = new RegExp(`^(?:https?://)?(?:www\\.)?github\\.com/(${NAME})/(${NAME})/pull/(\\d+)(?:[/?#].*)?$`);
const SHORT_PATTERN = new RegExp(`^(${NAME})/(${NAME})#(\\d+)$`);

/** Accepts `https://github.com/owner/repo/pull/123` (with any trailing path) or `owner/repo#123`. */
export function parsePullRequestUrl(input: string): PullRequestRef | null {
    const value = input.trim();
    const match = URL_PATTERN.exec(value) ?? SHORT_PATTERN.exec(value);
    const [, owner, repo, digits] = match ?? [];
    if (!owner || !repo || !digits) return null;
    const number = Number(digits);
    if (!Number.isSafeInteger(number) || number <= 0) return null;
    return { owner, repo: repo.replace(/\.git$/, ""), number };
}

/** Link to a line of the pull request's head commit on GitHub. */
export function lineUrl(pr: Pick<PullRequestMeta, "owner" | "repo" | "headSha">, file: string, line: number, endLine?: number): string {
    const path = file.split("/").map(encodeURIComponent).join("/");
    const range = endLine && endLine > line ? `#L${line}-L${endLine}` : `#L${line}`;
    return `https://github.com/${pr.owner}/${pr.repo}/blob/${pr.headSha}/${path}${range}`;
}
