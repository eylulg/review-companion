"use client";

import { useEffect } from "react";
import { DemoBanner } from "@/components/demo-banner";
import { Landing, URL_INPUT_ID } from "@/components/landing/landing";
import { ReviewScreen } from "@/components/review/review-screen";
import { ThemeToggle } from "@/components/theme-toggle";
import { useHydrated } from "@/hooks/use-hydrated";
import { useReviewRunner } from "@/hooks/use-review-runner";
import { useReviewStore } from "@/store/review-store";

interface AppShellProps {
    demo: boolean;
    defaultModel: string;
}

export function AppShell({ demo, defaultModel }: AppShellProps) {
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
        <div className="flex min-h-dvh flex-col">
            <a
                href="#main"
                className="sr-only rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:outline-2 focus:outline-brand"
            >
                Skip to content
            </a>
            <header className="border-b border-secondary bg-primary">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
                    <p className="flex items-center gap-2 text-md font-semibold text-primary">
                        <svg aria-hidden="true" viewBox="0 0 32 32" className="size-7">
                            <rect width="32" height="32" rx="8" className="fill-bg-brand-solid" />
                            <path d="M9 11h14M9 16h9M9 21h6" className="stroke-fg-white" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx="22" cy="21" r="3" fill="none" className="stroke-fg-white" strokeWidth="2.5" />
                        </svg>
                        Review Companion
                    </p>
                    <ThemeToggle />
                </div>
                {demo && <DemoBanner />}
            </header>
            <main id="main" tabIndex={-1} className="flex-1 outline-hidden">
                {showReview ? (
                    <ReviewScreen onStart={start} onCancel={cancel} onNewReview={handleNewReview} />
                ) : (
                    <Landing demo={demo} defaultModel={defaultModel} onStart={start} />
                )}
            </main>
            <footer className="border-t border-secondary">
                <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-tertiary md:px-6">
                    Built by Eylül Güneş. Findings come from a language model: read them as suggestions from a colleague, not as verdicts.
                </p>
            </footer>
        </div>
    );
}
