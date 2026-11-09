import { describe, expect, it } from "vitest";
import { buildReviewMarkdown } from "../markdown-export";
import type { PullRequestMeta, TriagedFinding } from "../types";

const pr: PullRequestMeta = {
    owner: "octo",
    repo: "app",
    number: 7,
    title: "Fix things",
    author: "someone",
    url: "https://github.com/octo/app/pull/7",
    headSha: "abc123",
    baseRef: "main",
    headRef: "fix",
    body: "",
};

let nextId = 0;
function finding(overrides: Partial<TriagedFinding>): TriagedFinding {
    nextId += 1;
    return {
        id: `f${nextId}`,
        file: "src/a.ts",
        line: 1,
        severity: "bug",
        category: "correctness",
        title: "Title",
        explanation: "Explanation.",
        confidence: 0.9,
        status: "accepted",
        edited: false,
        ...overrides,
    };
}

const findings = [
    finding({ file: "src/b.ts", line: 3, title: "Later file" }),
    finding({ line: 20, title: "Second in a", severity: "nit", category: "naming" }),
    finding({ line: 5, endLine: 6, title: "First in a", suggestion: "const x = 1;\nconst y = 2;" }),
    finding({ line: 9, title: "Pending", status: "pending" }),
    finding({ line: 10, title: "Dismissed", status: "dismissed" }),
];

describe("buildReviewMarkdown", () => {
    it("groups accepted findings by file in diff order, with suggestion blocks and line links", () => {
        const markdown = buildReviewMarkdown(findings, pr, { includePending: false, linkLines: true, fileOrder: ["src/a.ts", "src/b.ts"] });

        expect(markdown).toBe(
            [
                "## Review notes for octo/app#7",
                "",
                "3 comments, grouped by file.",
                "",
                "### `src/a.ts`",
                "",
                "#### Lines 5 to 6 ([view on GitHub](https://github.com/octo/app/blob/abc123/src/a.ts#L5-L6))",
                "",
                "**Bug (correctness): First in a**",
                "",
                "Explanation.",
                "",
                "```suggestion",
                "const x = 1;",
                "const y = 2;",
                "```",
                "",
                "#### Line 20 ([view on GitHub](https://github.com/octo/app/blob/abc123/src/a.ts#L20))",
                "",
                "**Nit (naming): Second in a**",
                "",
                "Explanation.",
                "",
                "### `src/b.ts`",
                "",
                "#### Line 3 ([view on GitHub](https://github.com/octo/app/blob/abc123/src/b.ts#L3))",
                "",
                "**Bug (correctness): Later file**",
                "",
                "Explanation.",
                "",
            ].join("\n"),
        );
    });

    it("adds pending findings when asked and never exports dismissed ones", () => {
        const markdown = buildReviewMarkdown(findings, pr, { includePending: true, linkLines: false, fileOrder: ["src/a.ts", "src/b.ts"] });

        expect(markdown).toContain("4 comments");
        expect(markdown).toContain("Pending");
        expect(markdown).not.toContain("Dismissed");
        expect(markdown).not.toContain("view on GitHub");
    });

    it("uses a longer fence when the suggestion contains backticks", () => {
        const markdown = buildReviewMarkdown([finding({ suggestion: "const s = ```;" })], pr, { includePending: false, linkLines: false });

        expect(markdown).toContain("````suggestion\nconst s = ```;\n````");
    });

    it("explains an empty export", () => {
        expect(buildReviewMarkdown([], null, { includePending: true, linkLines: false })).toBe(
            "## Review notes\n\nNo findings to export yet. Accept findings to add them here.\n",
        );
    });
});
