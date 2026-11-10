"use client";

import { useEffect } from "react";
import { DemoBanner } from "@/components/demo-banner";
import { Landing, URL_INPUT_ID } from "@/components/landing/landing";
import { ReviewScreen } from "@/components/review/review-screen";
import { useHydrated } from "@/hooks/use-hydrated";
import { useReviewRunner } from "@/hooks/use-review-runner";
import { useReviewStore } from "@/store/review-store";

interface ReviewAppProps {
    demo: boolean;
    defaultModel: string;
}

export function ReviewApp({ demo, defaultModel }: ReviewAppProps) {
    const hydrated = useHydrated();
    const status = useReviewStore((state) => state.status);
    const { start, cancel } = useReviewRunner();
    const showReview = hydrated && status !== "idle";

    useEffect(() => {
        Promise.resolve(useReviewStore.persist.rehydrate()).catch(() => useReviewStore.getState().reset());
    }, []);

    function handleNewReview() {
        cancel();
        useReviewStore.getState().reset();
        // The button that triggered this unmounts with the review screen, so focus the URL field instead.
        requestAnimationFrame(() => document.getElementById(URL_INPUT_ID)?.focus());
    }

    return (
        <>
            {demo && <DemoBanner />}
            {showReview ? (
                <ReviewScreen onStart={start} onCancel={cancel} onNewReview={handleNewReview} />
            ) : (
                <Landing demo={demo} defaultModel={defaultModel} onStart={start} />
            )}
        </>
    );
}
