"use client";

import { useCallback, useEffect, useRef } from "react";
import { streamReview } from "@/lib/review-client";
import type { ReviewRequest } from "@/lib/types";
import { useReviewStore } from "@/store/review-store";

async function run(request: ReviewRequest, signal: AbortSignal): Promise<void> {
    const { applyEvent, fail } = useReviewStore.getState();
    // Reloading or leaving the page cuts the stream with an AbortError or a "network error" TypeError, depending on
    // where the read was. Either way our controller did not abort, so the page itself says when it is going away.
    let leaving = false;
    const markLeaving = () => {
        leaving = true;
    };
    window.addEventListener("beforeunload", markLeaving);
    window.addEventListener("pagehide", markLeaving);
    try {
        const finished = await streamReview(
            request,
            (event) => {
                if (!signal.aborted) applyEvent(event);
            },
            signal,
        );
        if (!finished && !signal.aborted && !leaving) fail("upstream", "The connection closed before the review finished. Findings so far are kept.");
    } catch (error) {
        if (signal.aborted) return;
        // The persisted status is still "streaming", so the store restores it as "interrupted" on the next load.
        if (leaving || (error instanceof DOMException && error.name === "AbortError")) return;
        fail("upstream", "Could not reach the server. Check your connection and try again.");
    } finally {
        window.removeEventListener("beforeunload", markLeaving);
        window.removeEventListener("pagehide", markLeaving);
    }
}

/** Starts and cancels review streams. Every store write is skipped once its request was aborted. */
export function useReviewRunner() {
    const controller = useRef<AbortController | null>(null);

    const cancel = useCallback(() => {
        controller.current?.abort();
        controller.current = null;
    }, []);

    const start = useCallback(
        (request: ReviewRequest) => {
            cancel();
            const abort = new AbortController();
            controller.current = abort;
            useReviewStore.getState().begin(request);
            run(request, abort.signal).finally(() => {
                if (controller.current === abort) controller.current = null;
            });
        },
        [cancel],
    );

    useEffect(() => cancel, [cancel]);

    return { start, cancel };
}
