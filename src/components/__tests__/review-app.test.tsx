import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { demoFixture } from "@/lib/demo";
import type { ReviewEvent } from "@/lib/types";
import { useReviewStore } from "@/store/review-store";
import { SAMPLE_PR_URL, sampleEvents, sseResponse } from "@/test-utils/review-stream";
import { ReviewApp } from "../review-app";

function stubServer(...responses: Response[]) {
    const fetchMock = vi.fn<typeof fetch>();
    for (const response of responses) fetchMock.mockResolvedValueOnce(response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

function requestBody(fetchMock: ReturnType<typeof stubServer>, call = 0): unknown {
    const body = fetchMock.mock.calls[call]?.[1]?.body;
    return typeof body === "string" ? JSON.parse(body) : null;
}

async function startReview() {
    const user = userEvent.setup();
    const view = render(<ReviewApp demo={false} defaultModel="claude-opus-5-5" />);
    await user.type(screen.getByRole("textbox", { name: "Pull request URL" }), SAMPLE_PR_URL);
    await user.click(screen.getByRole("button", { name: "Start review" }));
    return { user, ...view };
}

async function renderFinishedReview() {
    const fetchMock = stubServer(sseResponse(await sampleEvents()));
    const result = await startReview();
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(9));
    return { ...result, fetchMock };
}

function article(index: number): HTMLElement {
    const element = screen.getAllByRole("article")[index];
    if (!element) throw new Error(`No finding at ${index}`);
    return element;
}

const metaEvent: ReviewEvent = {
    type: "meta",
    pr: demoFixture.pr,
    files: [{ path: "a.ts", additions: 1, deletions: 0, selected: true }],
    changedLines: 1,
    maxChangedLines: 1500,
    demo: false,
    model: "claude-opus-5-5",
};

describe("ReviewApp", () => {
    beforeEach(() => {
        useReviewStore.getState().reset();
    });

    it("has no axe violations on the landing page", async () => {
        const { container } = render(<ReviewApp demo defaultModel="claude-opus-5-5" />);

        expect((await axe(container)).violations).toEqual([]);
    });

    it("refuses to start a review for a URL that is not a pull request", async () => {
        const fetchMock = stubServer();
        const user = userEvent.setup();
        render(<ReviewApp demo={false} defaultModel="claude-opus-5-5" />);

        await user.type(screen.getByRole("textbox", { name: "Pull request URL" }), "not a url");
        await user.click(screen.getByRole("button", { name: "Start review" }));

        expect(screen.getByRole("textbox", { name: "Pull request URL" })).toHaveAccessibleDescription(/enter a pull request url such as/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends the URL and the chosen model, then moves focus to the review heading", async () => {
        const fetchMock = stubServer(sseResponse(await sampleEvents()));
        const user = userEvent.setup();
        render(<ReviewApp demo={false} defaultModel="claude-opus-5-5" />);

        await user.click(screen.getByRole("button", { name: /model/i }));
        await user.click(await screen.findByRole("option", { name: /claude sonnet 5\.5/i }));
        await user.type(screen.getByRole("textbox", { name: "Pull request URL" }), SAMPLE_PR_URL);
        await user.click(screen.getByRole("button", { name: "Start review" }));

        expect(await screen.findByRole("heading", { level: 1, name: demoFixture.pr.title })).toHaveFocus();
        expect(requestBody(fetchMock)).toEqual({ url: SAMPLE_PR_URL, model: "claude-sonnet-5-5", includeSkipped: false });
    });

    it("shows streamed findings grouped by file with line links, file counts and the final progress", async () => {
        await renderFinishedReview();

        const files = screen.getByRole("navigation", { name: "Files in this pull request" });

        expect(screen.getByText("Review complete: 9 findings")).toBeInTheDocument();
        expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
            "src/api/users.ts",
            "src/components/user-table.tsx",
            "src/utils/paginate.ts",
        ]);
        expect(screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent)).toEqual([
            "Search query is not URL encoded",
            "Out of order responses can overwrite newer results",
            "Typing in the search box never refetches",
            "Search input has no accessible name",
            "Clickable div cannot be reached with the keyboard",
            'Empty results read "Page 1 of 0"',
            "Next stays enabled on the last page",
            "No tests for the new pagination helpers",
            "pageCount drops the last partial page",
        ]);
        expect(within(article(0)).getByRole("link", { name: /line 14 of src\/api\/users\.ts/i })).toHaveAttribute(
            "href",
            `https://github.com/sample/team-directory/blob/${demoFixture.pr.headSha}/src/api/users.ts#L14`,
        );
        expect(within(files).getByRole("link", { name: "user-table.tsx 6 findings, src/components/user-table.tsx" })).toBeInTheDocument();
        expect(within(files).getByText("Lockfile")).toBeInTheDocument();
    });

    it("has no axe violations on the review screen", async () => {
        const { container } = await renderFinishedReview();

        expect((await axe(container)).violations).toEqual([]);
    });

    it("moves between findings with j and k and triages the focused one with a and d", async () => {
        const { user } = await renderFinishedReview();

        await user.keyboard("jj");
        await waitFor(() => expect(article(2)).toHaveFocus());
        await user.keyboard("a");
        await user.keyboard("kk");
        await waitFor(() => expect(article(0)).toHaveFocus());
        await user.keyboard("d");

        expect(within(article(2)).getByRole("button", { name: /^accept finding/i })).toHaveAttribute("aria-pressed", "true");
        expect(within(article(0)).getByRole("button", { name: /^dismiss finding/i })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText("1 accepted, 1 dismissed")).toBeInTheDocument();
    });

    it("ignores shortcuts while typing in the editor and returns focus to Edit after saving", async () => {
        const { user } = await renderFinishedReview();

        await user.keyboard("e");
        const title = await screen.findByRole("textbox", { name: "Title" });
        await waitFor(() => expect(title).toHaveFocus());
        await user.clear(title);
        await user.type(title, "Encode the search query, add a test");
        await user.click(screen.getByRole("button", { name: "Save changes" }));

        await waitFor(() => expect(within(article(0)).getByRole("button", { name: /^edit finding/i })).toHaveFocus());
        expect(within(article(0)).getByRole("heading", { level: 4 })).toHaveTextContent("Encode the search query, add a test");
        expect(within(article(0)).getByRole("button", { name: /^accept finding/i })).toHaveAttribute("aria-pressed", "false");
        expect(within(article(0)).getByRole("button", { name: /^dismiss finding/i })).toHaveAttribute("aria-pressed", "false");
    });

    it("blocks saving an edit with an empty title", async () => {
        const { user } = await renderFinishedReview();

        await user.keyboard("e");
        await user.clear(await screen.findByRole("textbox", { name: "Title" }));

        expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    });

    it("exports only accepted findings as Markdown with suggestion blocks and copies it", async () => {
        const { user } = await renderFinishedReview();
        const writeText = vi.fn(async () => {});
        // user-event installs its own clipboard in setup(), so this replacement has to come after it.
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

        await user.click(within(article(2)).getByRole("button", { name: /^accept finding/i }));
        await user.click(screen.getByRole("button", { name: "Export comments" }));
        const dialog = await screen.findByRole("dialog", { name: "Export review comments" });
        const field = within(dialog).getByRole("textbox", { name: "Markdown for 1 comment" });
        const markdown = field instanceof HTMLTextAreaElement ? field.value : "";
        await user.click(within(dialog).getByRole("button", { name: "Copy Markdown" }));

        expect(markdown).toContain("**Bug (correctness): Typing in the search box never refetches**\n\nThe effect reads");
        expect(markdown).toContain("```suggestion\n  }, [query, page]);\n```");
        expect(markdown).not.toContain("Search query is not URL encoded");
        expect(writeText).toHaveBeenCalledWith(markdown);
        expect(await within(dialog).findByText("Copied to clipboard.")).toBeInTheDocument();
    });

    it("has no axe violations in the export drawer and returns focus to Export when it closes", async () => {
        const { user } = await renderFinishedReview();

        await user.click(screen.getByRole("button", { name: "Export comments" }));
        const dialog = await screen.findByRole("dialog", { name: "Export review comments" });
        const violations = (await axe(dialog)).violations;
        await user.keyboard("{Escape}");

        expect(violations).toEqual([]);
        await waitFor(() => expect(screen.getByRole("button", { name: "Export comments" })).toHaveFocus());
    });

    it("asks for a file selection when the diff is over the cap and resubmits with the chosen files", async () => {
        const fetchMock = stubServer(sseResponse(await sampleEvents(70)), sseResponse(await sampleEvents(70, ["src/api/users.ts", "src/utils/paginate.ts"])));
        const { user } = await startReview();
        const region = await screen.findByRole("region", { name: "Pick the files to review" });

        await user.click(within(region).getByRole("button", { name: "Review 2 files" }));

        await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(3));
        expect(requestBody(fetchMock, 1)).toMatchObject({ selectedFiles: ["src/api/users.ts", "src/utils/paginate.ts"] });
    });

    it("brings the file picker back, with the alert focused, when the cost limit refuses the chosen files", async () => {
        const files = [
            { path: "a.ts", additions: 1, deletions: 0, selected: true },
            { path: "b.ts", additions: 1, deletions: 0, selected: true },
        ];
        stubServer(
            sseResponse([
                { ...metaEvent, files },
                { type: "error", code: "too_costly", message: "This review would send too much. Pick fewer files." },
            ]),
        );

        await startReview();

        const alert = await screen.findByRole("alert");
        const region = screen.getByRole("region", { name: "Pick the files to review" });
        expect(alert).toHaveFocus();
        expect(within(alert).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
        expect(within(region).getByRole("checkbox", { name: /a\.ts/ })).toBeChecked();
        expect(within(region).getByRole("button", { name: "Review 2 files" })).toBeEnabled();
    });

    it("moves focus to the file heading when a file in the list is chosen", async () => {
        const { user } = await renderFinishedReview();
        const files = screen.getByRole("navigation", { name: "Files in this pull request" });

        await user.click(within(files).getByRole("link", { name: /paginate\.ts/ }));

        expect(screen.getByRole("heading", { level: 3, name: "src/utils/paginate.ts" })).toHaveFocus();
    });

    it("blocks a file selection that goes over the cap", async () => {
        stubServer(sseResponse(await sampleEvents(70)));
        const { user } = await startReview();
        const region = await screen.findByRole("region", { name: "Pick the files to review" });

        await user.click(within(region).getByRole("checkbox", { name: /user-table\.tsx/ }));

        expect(within(region).getByRole("status")).toHaveTextContent("82 of 70 lines selected. Remove some files to continue.");
        expect(within(region).getByRole("button", { name: "Review 3 files" })).toBeDisabled();
    });

    it.each([
        { name: "a request error", events: [{ type: "error", code: "too_many_requests", message: "Slow down please." }], message: "Slow down please." },
        {
            name: "a stream that ends early",
            events: [{ type: "stage", stage: "fetching", message: "Fetching" }],
            message: "The connection closed before the review finished.",
        },
    ] satisfies { name: string; events: ReviewEvent[]; message: string }[])("alerts on $name and offers a retry", async ({ events, message }) => {
        stubServer(sseResponse(events));

        await startReview();

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent(message);
        expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    });

    it("says so when a review finishes without findings", async () => {
        stubServer(sseResponse([metaEvent, { type: "done", usage: { inputTokens: 1, outputTokens: 1 }, findingCount: 0 }]));

        await startReview();

        expect(await screen.findByText("No findings. Claude did not see anything worth raising in the reviewed files.")).toBeInTheDocument();
    });

    it("keeps the findings so far when the review is stopped and moves focus to the rerun button", async () => {
        const events = await sampleEvents();
        const firstFinding = events.findIndex((event) => event.type === "finding");
        const encoder = new TextEncoder();
        // A stream that sends one finding and then stays open until the request is aborted.
        vi.stubGlobal(
            "fetch",
            vi.fn(async (_url: string, init?: RequestInit) => {
                const body = new ReadableStream<Uint8Array>({
                    start(controller) {
                        for (const event of events.slice(0, firstFinding + 1)) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                        init?.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));
                    },
                });
                return new Response(body);
            }),
        );
        const { user } = await startReview();
        await screen.findByRole("article");

        await user.click(screen.getByRole("button", { name: "Stop review" }));

        await waitFor(() => expect(screen.getByRole("button", { name: "Run the review again" })).toHaveFocus());
        expect(screen.getAllByRole("article")).toHaveLength(1);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("returns to the landing page with focus in the URL field after starting a new review", async () => {
        const { user } = await renderFinishedReview();

        await user.click(screen.getByRole("button", { name: "Start a new review" }));

        await waitFor(() => expect(screen.getByRole("textbox", { name: "Pull request URL" })).toHaveFocus());
    });
});
