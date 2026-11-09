import { z } from "zod";
import { ReviewError } from "./errors";
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

interface FetchPullRequestOptions {
    token?: string;
    fetchImpl?: typeof fetch;
    /** Diffs larger than this many bytes are refused before parsing. */
    maxDiffBytes?: number;
    signal?: AbortSignal;
}

const API = "https://api.github.com";
const DEFAULT_MAX_DIFF_BYTES = 3_000_000;

function headers(token: string | undefined, accept: string): HeadersInit {
    const result: Record<string, string> = {
        Accept: accept,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "review-companion",
    };
    if (token) result.Authorization = `Bearer ${token}`;
    return result;
}

function rateLimitError(response: Response, authenticated: boolean): ReviewError | null {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const retryAfter = response.headers.get("retry-after");
    if (response.status !== 429 && !(response.status === 403 && (remaining === "0" || retryAfter))) return null;

    const reset = Number(response.headers.get("x-ratelimit-reset"));
    const when = Number.isFinite(reset) && reset > 0 ? ` It resets at ${new Date(reset * 1000).toISOString().slice(11, 16)} UTC.` : "";
    const hint = authenticated ? "" : " Set GITHUB_TOKEN on the server for 5,000 requests per hour instead of 60.";
    return new ReviewError("rate_limited", `GitHub rate limit reached.${when}${hint}`);
}

async function request(url: string, accept: string, options: FetchPullRequestOptions): Promise<Response> {
    const fetchImpl = options.fetchImpl ?? fetch;
    try {
        return await fetchImpl(url, { headers: headers(options.token, accept), signal: options.signal, cache: "no-store" });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        throw new ReviewError("upstream", "Could not reach GitHub. Check your connection and try again.");
    }
}

async function explainNotFound(ref: PullRequestRef, options: FetchPullRequestOptions): Promise<ReviewError> {
    const repo = await request(`${API}/repos/${ref.owner}/${ref.repo}`, "application/vnd.github+json", options);
    if (repo.ok) return new ReviewError("not_found", `Pull request #${ref.number} does not exist in ${ref.owner}/${ref.repo}.`);
    if (options.token) return new ReviewError("not_found", `Repository ${ref.owner}/${ref.repo} was not found, or the token cannot read it.`);
    return new ReviewError(
        "private_repo",
        `Repository ${ref.owner}/${ref.repo} was not found. If it is private, set GITHUB_TOKEN on the server with read access to it.`,
    );
}

const githubPullSchema = z.object({
    title: z.string(),
    body: z.string().nullable(),
    html_url: z.string(),
    user: z.object({ login: z.string() }).nullable(),
    head: z.object({ sha: z.string(), ref: z.string() }),
    base: z.object({ ref: z.string() }),
});

/** Fetches pull request metadata and its unified diff through the GitHub REST API. */
export async function fetchPullRequest(ref: PullRequestRef, options: FetchPullRequestOptions = {}): Promise<{ pr: PullRequestMeta; diff: string }> {
    const base = `${API}/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`;
    const authenticated = Boolean(options.token);

    const metaResponse = await request(base, "application/vnd.github+json", options);
    if (!metaResponse.ok) {
        throw (
            rateLimitError(metaResponse, authenticated) ??
            (metaResponse.status === 404 ? await explainNotFound(ref, options) : new ReviewError("upstream", `GitHub returned ${metaResponse.status}.`))
        );
    }
    const parsedPull = githubPullSchema.safeParse(await metaResponse.json().catch(() => null));
    if (!parsedPull.success) throw new ReviewError("upstream", "GitHub returned an unexpected response. Try again in a moment.");
    const pull = parsedPull.data;

    const diffResponse = await request(base, "application/vnd.github.diff", options);
    if (!diffResponse.ok) {
        const limited = rateLimitError(diffResponse, authenticated);
        if (limited) throw limited;
        // GitHub refuses to render diffs over 300 files or 20,000 lines with 406 (sometimes 422).
        if (diffResponse.status === 406 || diffResponse.status === 422) {
            throw new ReviewError("too_large", "GitHub will not produce a diff this large. Try a smaller pull request.");
        }
        throw new ReviewError("upstream", `GitHub returned ${diffResponse.status} for the diff.`);
    }

    const maxBytes = options.maxDiffBytes ?? DEFAULT_MAX_DIFF_BYTES;
    const declared = Number(diffResponse.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
        throw new ReviewError("too_large", "This diff is too large to review here. Try a smaller pull request.");
    }
    const diff = await diffResponse.text();
    if (diff.length > maxBytes) throw new ReviewError("too_large", "This diff is too large to review here. Try a smaller pull request.");

    return {
        diff,
        pr: {
            owner: ref.owner,
            repo: ref.repo,
            number: ref.number,
            title: pull.title,
            body: pull.body ?? "",
            url: pull.html_url,
            author: pull.user?.login ?? "unknown",
            headSha: pull.head.sha,
            headRef: pull.head.ref,
            baseRef: pull.base.ref,
        },
    };
}

/** Link to a line of the pull request's head commit on GitHub. */
export function lineUrl(pr: Pick<PullRequestMeta, "owner" | "repo" | "headSha">, file: string, line: number, endLine?: number): string {
    const path = file.split("/").map(encodeURIComponent).join("/");
    const range = endLine && endLine > line ? `#L${line}-L${endLine}` : `#L${line}`;
    return `https://github.com/${pr.owner}/${pr.repo}/blob/${pr.headSha}/${path}${range}`;
}
