// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoFixture } from "@/lib/demo";
import { readSseEvents } from "@/lib/sse";
import { collect } from "@/test-utils/review-stream";

// The real SDK class is swapped for one whose stream method is a stub, so no test can reach the API.
const stream = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
    class FakeAnthropic extends actual.default {
        constructor(options: ConstructorParameters<typeof actual.default>[0]) {
            super(options);
            Object.defineProperty(this, "beta", { value: { messages: { stream } } });
        }
    }
    return { ...actual, default: FakeAnthropic };
});

async function post(body: unknown, headers: Record<string, string> = {}) {
    const { POST } = await import("../route");
    return POST(
        new Request("http://localhost/api/review", {
            method: "POST",
            headers: { "Content-Type": "application/json", host: "localhost", "x-forwarded-for": "203.0.113.1", ...headers },
            body: typeof body === "string" ? body : JSON.stringify(body),
        }),
    );
}

async function eventsOf(response: Response) {
    if (!response.body) throw new Error("expected a stream");
    return collect(readSseEvents(response.body));
}

function stubReviewWithKey() {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const pull = {
        title: demoFixture.pr.title,
        body: "",
        html_url: demoFixture.pr.url,
        user: { login: "a" },
        head: { sha: "s", ref: "h" },
        base: { ref: "main" },
    };
    vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init?: RequestInit) =>
            new Headers(init?.headers).get("accept") === "application/vnd.github.diff" ? new Response(demoFixture.diff) : Response.json(pull),
        ),
    );
    stream.mockImplementation((params: { messages: { content: string }[] }) => ({
        finalMessage: async () => {
            const path = /<diff file="([^"]+)"/.exec(params.messages[0]?.content ?? "")?.[1];
            const saved = demoFixture.chunks[`${path}#1`];
            return {
                content: [{ type: "text", text: JSON.stringify(saved?.response ?? { findings: [] }) }],
                stop_reason: "end_turn",
                usage: { input_tokens: 1000, output_tokens: 100 },
            };
        },
    }));
}

describe("POST /api/review", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 200 });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        stream.mockReset();
    });

    it.each<{ name: string; body: unknown; headers: Record<string, string>; status: number; code: string }>([
        { name: "a URL that is not a pull request", body: { url: "https://example.com" }, headers: {}, status: 400, code: "invalid_url" },
        { name: "a body without a URL", body: {}, headers: {}, status: 400, code: "bad_request" },
        { name: "an oversized body", body: JSON.stringify({ url: "o/r#1", pad: "x".repeat(70_000) }), headers: {}, status: 400, code: "bad_request" },
        { name: "a request from another site", body: { url: "o/r#1" }, headers: { origin: "https://evil.example" }, status: 403, code: "bad_request" },
    ])("rejects $name", async ({ body, headers, status, code }) => {
        const response = await post(body, headers);

        expect(response.status).toBe(status);
        expect(await response.json()).toMatchObject({ code });
    });

    it("replays the saved review in demo mode without calling GitHub or the model", async () => {
        vi.stubEnv("ANTHROPIC_API_KEY", "");
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);

        const events = await eventsOf(await post({ url: "https://github.com/vitejs/vite/pull/24041" }));

        expect(events.find((event) => event.type === "meta")).toMatchObject({ demo: true, model: demoFixture.model });
        expect(events.at(-1)).toMatchObject({ type: "done", findingCount: 9 });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(stream).not.toHaveBeenCalled();
    });

    it("fetches the pull request from GitHub and reviews each file with the chosen model when a key is set", async () => {
        stubReviewWithKey();

        const events = await eventsOf(await post({ url: "https://github.com/sample/team-directory/pull/42", model: "claude-sonnet-5-5" }));

        expect(stream).toHaveBeenCalledTimes(3);
        expect(events.find((event) => event.type === "meta")).toMatchObject({ demo: false, model: "claude-sonnet-5-5" });
        expect(events.at(-1)).toEqual({ type: "done", findingCount: 9, usage: { inputTokens: 3000, outputTokens: 300 } });
    });

    it("counts a review against the rate limit only once the model has answered", async () => {
        vi.stubEnv("RATE_LIMIT_REVIEWS", "1");
        stubReviewWithKey();
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("", { status: 404 })),
        );
        const failed = await eventsOf(await post({ url: "o/r#1" }));
        stubReviewWithKey();

        const answered = await post({ url: "https://github.com/sample/team-directory/pull/42" });
        await eventsOf(answered);
        const limited = await post({ url: "o/r#1" });

        expect(failed.at(-1)).toMatchObject({ type: "error" });
        expect(answered.status).toBe(200);
        expect(limited.status).toBe(429);
        expect(limited.headers.get("retry-after")).toBe("600");
    });
});
