import { buildChunks, commentableLines, estimateTokens, selectReviewSet } from "./chunking";
import { mapWithConcurrency } from "./concurrency";
import { parseUnifiedDiff } from "./diff-parser";
import { ReviewError } from "./errors";
import { validateFindings } from "./finding-schema";
import type { PullRequestRef } from "./github";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { ChunkReviewer, PullRequestMeta, ReviewEvent, Usage } from "./types";

interface ReviewOptions {
    ref: PullRequestRef;
    model: string;
    includeSkipped: boolean;
    selectedFiles?: string[];
    maxChangedLines: number;
    maxInputTokens: number;
    /** Stops starting new chunks once the model has produced this many output tokens in one review. */
    maxOutputTokens?: number;
    maxLinesPerChunk?: number;
    concurrency?: number;
    demo: boolean;
    signal?: AbortSignal;
}

export interface ReviewDependencies {
    fetchPullRequest: (ref: PullRequestRef, signal?: AbortSignal) => Promise<{ pr: PullRequestMeta; diff: string }>;
    reviewChunk: ChunkReviewer;
    makeId?: () => string;
}

function defaultIdFactory(): () => string {
    let counter = 0;
    return () => {
        counter += 1;
        return `f${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    };
}

/**
 * The whole review pipeline as a stream of events: fetch the pull request, parse and filter the diff,
 * enforce the size and cost limits, then review chunks two at a time and emit findings as each one finishes.
 */
export async function* runReview(options: ReviewOptions, deps: ReviewDependencies): AsyncGenerator<ReviewEvent> {
    const makeId = deps.makeId ?? defaultIdFactory();
    const usage: Usage = { inputTokens: 0, outputTokens: 0 };
    let findingCount = 0;

    try {
        yield { type: "stage", stage: "fetching", message: `Fetching ${options.ref.owner}/${options.ref.repo}#${options.ref.number}` };
        const { pr, diff } = await deps.fetchPullRequest(options.ref, options.signal);

        yield { type: "stage", stage: "chunking", message: "Reading the diff" };
        const allFiles = parseUnifiedDiff(diff);
        const set = selectReviewSet(allFiles, {
            includeSkipped: options.includeSkipped,
            selectedFiles: options.selectedFiles,
            maxChangedLines: options.maxChangedLines,
        });

        yield {
            type: "meta",
            pr,
            files: set.summaries,
            changedLines: set.changedLines,
            maxChangedLines: options.maxChangedLines,
            demo: options.demo,
            model: options.model,
        };

        if (set.overCap) {
            if (options.selectedFiles) {
                throw new ReviewError(
                    "too_large",
                    `The selected files have ${set.changedLines} changed lines. Pick files that add up to ${options.maxChangedLines} or fewer.`,
                );
            }
            yield { type: "needs_selection", changedLines: set.changedLines, maxChangedLines: options.maxChangedLines };
            return;
        }

        if (set.files.length === 0) {
            throw new ReviewError(
                "nothing_to_review",
                "There is nothing to review: every changed file is skipped by default. Turn on skipped files to include them.",
            );
        }

        const chunks = buildChunks(set.files, options.maxLinesPerChunk);
        const estimatedInput = chunks.reduce((total, chunk) => total + estimateTokens(SYSTEM_PROMPT) + estimateTokens(buildUserPrompt(pr, chunk)), 0);
        if (estimatedInput > options.maxInputTokens) {
            throw new ReviewError(
                "too_costly",
                `This review would send about ${estimatedInput.toLocaleString("en-US")} input tokens, over the limit of ${options.maxInputTokens.toLocaleString("en-US")}. Pick fewer files.`,
            );
        }

        yield {
            type: "stage",
            stage: "reviewing",
            message: `Reviewing ${chunks.length} ${chunks.length === 1 ? "file" : "files"}`,
            current: 0,
            total: chunks.length,
        };
        let outputCeilingHit = false;
        let outputSpent = 0;
        const results = mapWithConcurrency(chunks, options.concurrency ?? 2, async (chunk) => {
            if (options.maxOutputTokens !== undefined && outputSpent >= options.maxOutputTokens) {
                outputCeilingHit = true;
                return { raw: { findings: [] }, usage: { inputTokens: 0, outputTokens: 0 } };
            }
            const output = await deps.reviewChunk({ pr, chunk, model: options.model, signal: options.signal });
            outputSpent += output.usage.outputTokens;
            return output;
        });

        let completed = 0;
        let rejected = 0;
        let next = results.next();
        for (let result = await next; !result.done; result = await next) {
            next = results.next();
            const settled = result.value;

            if (!settled.ok) throw settled.error;

            const output = settled.value;
            usage.inputTokens += output.usage.inputTokens;
            usage.outputTokens += output.usage.outputTokens;
            if (output.warning) yield { type: "warning", message: output.warning };

            const validated = validateFindings(output.raw, { path: settled.item.path, lines: commentableLines(settled.item), makeId });
            rejected += validated.rejected;
            for (const finding of validated.findings) {
                findingCount += 1;
                yield { type: "finding", finding };
            }
            yield { type: "usage", usage: { ...usage } };
            completed += 1;
            yield {
                type: "stage",
                stage: "reviewing",
                message: `Reviewed ${completed} of ${chunks.length} ${chunks.length === 1 ? "file" : "files"}`,
                current: completed,
                total: chunks.length,
            };
        }

        if (outputCeilingHit) {
            yield { type: "warning", message: "Some files were not reviewed: this review reached the output limit set for this site." };
        }

        if (rejected > 0) {
            yield {
                type: "warning",
                message: `${rejected} finding${rejected === 1 ? "" : "s"} did not cite a line from the diff and ${rejected === 1 ? "was" : "were"} left out.`,
            };
        }
        yield { type: "stage", stage: "done", message: `Review complete: ${findingCount} finding${findingCount === 1 ? "" : "s"}` };
        yield { type: "done", usage: { ...usage }, findingCount };
    } catch (error) {
        if (options.signal?.aborted) return;
        if (error instanceof ReviewError) {
            yield { type: "error", code: error.code, message: error.message };
            return;
        }
        yield { type: "error", code: "upstream", message: "Something went wrong while reviewing. Please try again." };
    }
}
