import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { sampleFile } from "@/test-utils/review-stream";
import { buildChunks } from "../chunking";
import { createClaudeReviewer } from "../claude-reviewer";
import { demoFixture } from "../demo";
import { ReviewError } from "../errors";
import type { ChunkReviewInput } from "../types";

type MessageResult = { stop_reason: string; content: { type: "text"; text: string }[] } | Error;

/** Stands in for the SDK client: only the one method the reviewer calls, never the network. */
function fakeClient(result: MessageResult) {
    const stream = vi.fn(() => ({
        finalMessage: async () => {
            if (result instanceof Error) throw result;
            return { ...result, usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50, cache_creation_input_tokens: 0 } };
        },
    }));
    // The fake implements only `beta.messages.stream`, which is all the reviewer uses.
    return { client: { beta: { messages: { stream } } } as unknown as Anthropic, stream };
}

function apiError(status: number) {
    return Anthropic.APIError.generate(status, { error: { message: "x" } }, "x", new Headers());
}

const [chunk] = buildChunks([sampleFile("src/api/users.ts")]);
if (!chunk) throw new Error("expected a chunk");
const input: ChunkReviewInput = { pr: demoFixture.pr, chunk, model: "claude-sonnet-5-5" };

describe("createClaudeReviewer", () => {
    it("requests structured output with server-side fallback and returns the parsed JSON with usage", async () => {
        const { client, stream } = fakeClient({ stop_reason: "end_turn", content: [{ type: "text", text: '{"findings":[]}' }] });

        const output = await createClaudeReviewer(client, "high")(input);

        expect(output).toEqual({ raw: { findings: [] }, usage: { inputTokens: 150, outputTokens: 20 } });
        expect(stream).toHaveBeenCalledWith(
            expect.objectContaining({
                model: "claude-sonnet-5-5",
                betas: ["server-side-fallback-2026-07-01"],
                fallbacks: "default",
                output_config: expect.objectContaining({ effort: "high", format: expect.objectContaining({ type: "json_schema" }) }),
            }),
            expect.anything(),
        );
    });

    it.each([
        ["a refusal", { stop_reason: "refusal", content: [] }, "The model declined to review src/api/users.ts."],
        [
            "a cut off response",
            { stop_reason: "max_tokens", content: [{ type: "text" as const, text: '{"findings":[{"fi' }] },
            "Could not read findings for src/api/users.ts: the response was cut off.",
        ],
        ["a rate limit", apiError(429), "Skipped src/api/users.ts: the model is rate limited right now."],
        ["a server error", apiError(529), "Skipped src/api/users.ts: the model returned an error."],
    ])("skips the chunk with a warning on %s", async (_name, result, warning) => {
        const { client } = fakeClient(result);

        const output = await createClaudeReviewer(client, "high")(input);

        expect(output.raw).toEqual({ findings: [] });
        expect(output.warning).toBe(warning);
    });

    it("fails the whole review when the API key is rejected", async () => {
        const { client } = fakeClient(apiError(401));

        await expect(createClaudeReviewer(client, "high")(input)).rejects.toBeInstanceOf(ReviewError);
    });
});
