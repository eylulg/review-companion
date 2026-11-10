import { describe, expect, it } from "vitest";
import { collect } from "@/test-utils/review-stream";
import { createDemoDependencies, demoFixture } from "../demo";
import { runReview } from "../review-service";
import type { ChunkReviewer, ReviewEvent } from "../types";

const options = {
    ref: { owner: "sample", repo: "team-directory", number: 42 },
    model: "claude-opus-5-5",
    includeSkipped: false,
    maxChangedLines: 1500,
    maxInputTokens: 100_000,
    demo: true,
};

function deps(reviewChunk?: ChunkReviewer) {
    const demo = createDemoDependencies(demoFixture, 0);
    return { ...demo, reviewChunk: reviewChunk ?? demo.reviewChunk };
}

function messages(events: ReviewEvent[], type: "stage" | "warning"): string[] {
    return events.flatMap((event) => (event.type === type ? [event.message] : []));
}

describe("runReview", () => {
    it("announces each file, streams every valid finding and finishes with the summed usage", async () => {
        const events = await collect(runReview(options, deps()));

        expect(messages(events, "stage")).toEqual([
            "Fetching sample/team-directory#42",
            "Reading the diff",
            "Reviewing 3 files",
            "Reviewed 1 of 3 files",
            "Reviewed 2 of 3 files",
            "Reviewed 3 of 3 files",
            "Review complete: 9 findings",
        ]);
        expect(events.filter((event) => event.type === "finding")).toHaveLength(9);
        expect(events.at(-1)).toEqual({ type: "done", findingCount: 9, usage: { inputTokens: 4983, outputTokens: 2690 } });
    });

    it.each([
        { name: "asks for a selection when over the cap", selectedFiles: undefined, last: { type: "needs_selection", changedLines: 82, maxChangedLines: 20 } },
        {
            name: "refuses a selection that is still over the cap",
            selectedFiles: ["src/components/user-table.tsx"],
            last: { type: "error", code: "too_large" },
        },
        { name: "reviews a selection under the cap", selectedFiles: ["src/utils/paginate.ts"], last: { type: "done", findingCount: 2 } },
    ])("$name", async ({ selectedFiles, last }) => {
        const events = await collect(runReview({ ...options, maxChangedLines: 20, selectedFiles }, deps()));

        expect(events.at(-1)).toMatchObject(last);
    });

    it("stops starting files once the output limit is reached and says so", async () => {
        let calls = 0;
        const reviewer: ChunkReviewer = async () => {
            calls += 1;
            return { raw: { findings: [] }, usage: { inputTokens: 100, outputTokens: 500 } };
        };

        const events = await collect(runReview({ ...options, concurrency: 1, maxOutputTokens: 500 }, deps(reviewer)));

        expect(calls).toBe(1);
        expect(messages(events, "warning")).toEqual(["Some files were not reviewed: this review reached the output limit set for this site."]);
    });

    it("stops before calling the model when the estimated input is over the cost limit", async () => {
        let called = false;
        const reviewer: ChunkReviewer = async () => {
            called = true;
            return { raw: { findings: [] }, usage: { inputTokens: 0, outputTokens: 0 } };
        };

        const events = await collect(runReview({ ...options, maxInputTokens: 500 }, deps(reviewer)));

        expect(called).toBe(false);
        expect(events.at(-1)).toMatchObject({ type: "error", code: "too_costly" });
    });

    it("passes on reviewer warnings and counts findings that cite lines outside the diff", async () => {
        const reviewer: ChunkReviewer = async ({ chunk }) => ({
            raw: {
                findings: [
                    {
                        file: chunk.path,
                        line: 999,
                        endLine: null,
                        severity: "bug",
                        category: "x",
                        title: "t",
                        explanation: "e",
                        suggestion: null,
                        confidence: 0.9,
                    },
                ],
            },
            usage: { inputTokens: 1, outputTokens: 1 },
            warning: `warned ${chunk.path}`,
        });

        const warnings = messages(await collect(runReview(options, deps(reviewer))), "warning");

        expect(warnings).toEqual([
            "warned src/api/users.ts",
            "warned src/components/user-table.tsx",
            "warned src/utils/paginate.ts",
            "3 findings did not cite a line from the diff and were left out.",
        ]);
    });

    it("reports an error when every file is skipped", async () => {
        const lockfileOnly = { ...demoFixture, diff: demoFixture.diff.split("diff --git a/src/api")[0] ?? "" };

        const events = await collect(runReview(options, createDemoDependencies(lockfileOnly, 0)));

        expect(events.at(-1)).toMatchObject({ type: "error", code: "nothing_to_review" });
    });

    it("turns an unexpected failure into a generic error the user can act on", async () => {
        const failing = { ...deps(), fetchPullRequest: () => Promise.reject(new Error("boom")) };

        const events = await collect(runReview(options, failing));

        expect(events.at(-1)).toEqual({ type: "error", code: "upstream", message: "Something went wrong while reviewing. Please try again." });
    });
});
