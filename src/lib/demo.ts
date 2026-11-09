import { z } from "zod";
import fixtureJson from "../fixtures/demo-review.json";
import type { ReviewDependencies } from "./review-service";
import { pullRequestMetaSchema, usageSchema } from "./schemas";
import type { ChunkReviewer, DemoFixture } from "./types";

const demoFixtureSchema: z.ZodType<DemoFixture> = z.object({
    source: z.string(),
    model: z.string(),
    pr: pullRequestMetaSchema,
    diff: z.string(),
    chunks: z.record(z.string(), z.object({ usage: usageSchema, response: z.unknown() })),
});

export const demoFixture = demoFixtureSchema.parse(fixtureJson);

function wait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (ms <= 0) return resolve();
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
            "abort",
            () => {
                clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
        );
    });
}

/**
 * Dependencies that replay the saved fixture instead of calling GitHub and Claude. The fixture still
 * goes through the real diff parser, chunker and finding validation, so demo mode exercises the same path.
 */
export function createDemoDependencies(fixture: DemoFixture = demoFixture, delayMs = 600): ReviewDependencies {
    const reviewChunk: ChunkReviewer = async ({ chunk, signal }) => {
        await wait(delayMs, signal);
        const saved = fixture.chunks[chunk.id];
        if (!saved) return { raw: { findings: [] }, usage: { inputTokens: 0, outputTokens: 0 } };
        return { raw: saved.response, usage: saved.usage };
    };

    return {
        fetchPullRequest: async (_ref, signal) => {
            await wait(delayMs / 2, signal);
            return { pr: fixture.pr, diff: fixture.diff };
        },
        reviewChunk,
    };
}
