/**
 * Records a real review into src/fixtures/demo-review.json so demo mode replays it.
 * This calls GitHub and the Anthropic API and spends tokens.
 *
 *   ANTHROPIC_API_KEY=... REVIEW_MODEL=claude-opus-5-5 npm run record-fixture -- https://github.com/owner/repo/pull/123
 *
 * REVIEW_MODEL picks the model that is recorded (the app default is Sonnet 5.5). The README explains what to
 * update by hand afterwards.
 */
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "node:fs";
import { buildChunks, selectReviewSet } from "../src/lib/chunking";
import { createClaudeReviewer } from "../src/lib/claude-reviewer";
import { serverConfig } from "../src/lib/config";
import { parseUnifiedDiff } from "../src/lib/diff-parser";
import { fetchPullRequest, parsePullRequestUrl } from "../src/lib/github";
import type { DemoFixture } from "../src/lib/types";

async function main() {
    const url = process.argv[2];
    const ref = url ? parsePullRequestUrl(url) : null;
    if (!ref) throw new Error("Usage: npm run record-fixture -- <pull request URL>");
    const config = serverConfig();
    if (!config.apiKey) throw new Error("Set ANTHROPIC_API_KEY to record a fixture.");

    const model = config.defaultModel;
    const { pr, diff } = await fetchPullRequest(ref, { token: config.githubToken });
    const set = selectReviewSet(parseUnifiedDiff(diff), { includeSkipped: false, maxChangedLines: 1500 });
    if (set.overCap) throw new Error(`Pick a smaller pull request: ${set.changedLines} changed lines.`);

    const reviewer = createClaudeReviewer(new Anthropic({ apiKey: config.apiKey }), config.effort);
    const chunks: DemoFixture["chunks"] = {};
    for (const chunk of buildChunks(set.files)) {
        console.log(`Reviewing ${chunk.id}`);
        const output = await reviewer({ pr, chunk, model });
        if (output.warning) console.warn(output.warning);
        chunks[chunk.id] = { usage: output.usage, response: output.raw };
    }

    const fixture: DemoFixture = { source: `Recorded from ${pr.url} with ${model} on ${new Date().toISOString().slice(0, 10)}.`, model, pr, diff, chunks };
    writeFileSync(new URL("../src/fixtures/demo-review.json", import.meta.url), `${JSON.stringify(fixture, null, 2)}\n`);
    console.log("Wrote src/fixtures/demo-review.json");
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
