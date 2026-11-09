import { beforeEach, describe, expect, it } from "vitest";
import { sampleEvents } from "@/test-utils/review-stream";
import { useReviewStore } from "../review-store";

const STORAGE_KEY = "review-companion-session";

describe("useReviewStore session persistence", () => {
    beforeEach(() => {
        useReviewStore.getState().reset();
    });

    it("restores a saved session and marks a review that was still streaming as interrupted", async () => {
        const store = useReviewStore.getState();
        store.begin({ url: "o/r#1", model: "claude-opus-5-5", includeSkipped: false });
        for (const event of (await sampleEvents()).slice(0, 8)) store.applyEvent(event);
        const saved = window.sessionStorage.getItem(STORAGE_KEY);
        store.reset();
        window.sessionStorage.setItem(STORAGE_KEY, saved ?? "");

        await useReviewStore.persist.rehydrate();

        expect(useReviewStore.getState().status).toBe("interrupted");
        expect(useReviewStore.getState().findings.length).toBeGreaterThan(0);
    });

    it("ignores a saved session that does not match the expected shape", async () => {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { status: "done", findings: [{ id: 1 }] }, version: 1 }));

        await useReviewStore.persist.rehydrate();

        expect(useReviewStore.getState().status).toBe("idle");
    });
});
