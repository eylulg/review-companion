import { describe, expect, it, vi } from "vitest";
import { ReviewError } from "../errors";
import { fetchPullRequest, lineUrl, parsePullRequestUrl } from "../github";

const ref = { owner: "o", repo: "r", number: 5 };
const pull = {
    title: "T",
    body: null,
    html_url: "https://github.com/o/r/pull/5",
    user: { login: "dev" },
    head: { sha: "sha1", ref: "feature" },
    base: { ref: "main" },
};

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
}

function fetchSequence(...responses: Response[]) {
    const fetchImpl = vi.fn<typeof fetch>();
    for (const response of responses) fetchImpl.mockResolvedValueOnce(response);
    return fetchImpl;
}

async function errorOf(promise: Promise<unknown>): Promise<ReviewError> {
    const error = await promise.then(
        () => null,
        (caught: unknown) => caught,
    );
    if (!(error instanceof ReviewError)) throw new Error("expected a ReviewError");
    return error;
}

describe("parsePullRequestUrl", () => {
    it.each([
        ["https://github.com/vitejs/vite/pull/24041", { owner: "vitejs", repo: "vite", number: 24041 }],
        ["github.com/pmndrs/zustand/pull/3595/files", { owner: "pmndrs", repo: "zustand", number: 3595 }],
        ["https://www.github.com/a-b/c.d/pull/1?diff=split#top", { owner: "a-b", repo: "c.d", number: 1 }],
        ["  owner/repo#12  ", { owner: "owner", repo: "repo", number: 12 }],
        ["", null],
        ["https://github.com/owner/repo", null],
        ["https://github.com/owner/repo/issues/3", null],
        ["https://gitlab.com/o/r/pull/1", null],
        ["https://github.com/o/r/pull/0", null],
    ])("%s", (input, expected) => {
        expect(parsePullRequestUrl(input)).toEqual(expected);
    });
});

describe("fetchPullRequest", () => {
    it("returns metadata and the diff, sending the token when one is set", async () => {
        const fetchImpl = fetchSequence(respond(200, pull), respond(200, "diff --git a/x b/x\n"));

        const result = await fetchPullRequest(ref, { token: "secret", fetchImpl });

        expect(result.pr).toMatchObject({ title: "T", body: "", author: "dev", headSha: "sha1", baseRef: "main" });
        expect(result.diff).toBe("diff --git a/x b/x\n");
        expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({ Accept: "application/vnd.github.diff", Authorization: "Bearer secret" });
    });

    it.each([
        { name: "a missing pull request", responses: [respond(404, {}), respond(200, {})], token: undefined, code: "not_found" },
        { name: "a private repository without a token", responses: [respond(404, {}), respond(404, {})], token: undefined, code: "private_repo" },
        { name: "a repository the token cannot read", responses: [respond(404, {}), respond(404, {})], token: "t", code: "not_found" },
        { name: "a diff GitHub refuses to render", responses: [respond(200, pull), respond(406, {})], token: undefined, code: "too_large" },
        { name: "an unexpected response shape", responses: [respond(200, { title: 1 })], token: undefined, code: "upstream" },
    ])("reports $name", async ({ responses, token, code }) => {
        const error = await errorOf(fetchPullRequest(ref, { token, fetchImpl: fetchSequence(...responses) }));

        expect(error.code).toBe(code);
    });

    it("reports the rate limit reset time and suggests a token", async () => {
        const limited = respond(403, {}, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1700000000" });

        const error = await errorOf(fetchPullRequest(ref, { fetchImpl: fetchSequence(limited) }));

        expect(error.code).toBe("rate_limited");
        expect(error.message).toBe(
            "GitHub rate limit reached. It resets at 22:13 UTC. Set GITHUB_TOKEN on the server for 5,000 requests per hour instead of 60.",
        );
    });

    it("refuses a diff over the byte limit", async () => {
        const fetchImpl = fetchSequence(respond(200, pull), respond(200, "x".repeat(200)));

        const error = await errorOf(fetchPullRequest(ref, { fetchImpl, maxDiffBytes: 100 }));

        expect(error.code).toBe("too_large");
    });

    it("maps network failures to an upstream error", async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));

        const error = await errorOf(fetchPullRequest(ref, { fetchImpl }));

        expect(error.code).toBe("upstream");
    });
});

describe("lineUrl", () => {
    it.each([
        ["src/a b.ts", 4, undefined, "https://github.com/o/r/blob/abc/src/a%20b.ts#L4"],
        ["x.ts", 4, 6, "https://github.com/o/r/blob/abc/x.ts#L4-L6"],
    ])("links %s line %i", (file, line, endLine, expected) => {
        expect(lineUrl({ owner: "o", repo: "r", headSha: "abc" }, file, line, endLine)).toBe(expected);
    });
});
