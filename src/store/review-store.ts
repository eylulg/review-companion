"use client";

import { z } from "zod";
import { create } from "zustand";
import { type StateStorage, createJSONStorage, persist } from "zustand/middleware";
import { errorCodeSchema, fileSummarySchema, pullRequestMetaSchema, triagedFindingSchema, usageSchema } from "@/lib/schemas";
import type {
    FileSummary,
    FindingEdit,
    Progress,
    PullRequestMeta,
    ReviewErrorCode,
    ReviewEvent,
    ReviewRequest,
    ReviewStatus,
    Severity,
    TriageStatus,
    TriagedFinding,
    Usage,
} from "@/lib/types";

interface ReviewData {
    request: ReviewRequest | null;
    status: ReviewStatus;
    progress: Progress | null;
    pr: PullRequestMeta | null;
    files: FileSummary[];
    changedLines: number;
    maxChangedLines: number;
    demo: boolean;
    model: string | null;
    findings: TriagedFinding[];
    usage: Usage;
    warnings: string[];
    error: { code: ReviewErrorCode; message: string } | null;
    activeId: string | null;
}

interface ReviewActions {
    begin: (request: ReviewRequest) => void;
    applyEvent: (event: ReviewEvent) => void;
    fail: (code: ReviewErrorCode, message: string) => void;
    stop: () => void;
    setStatus: (id: string, status: TriageStatus) => void;
    editFinding: (id: string, edit: FindingEdit) => void;
    setActive: (id: string | null) => void;
    moveActive: (direction: 1 | -1, order: string[]) => void;
    reset: () => void;
}

const initialState: ReviewData = {
    request: null,
    status: "idle",
    progress: null,
    pr: null,
    files: [],
    changedLines: 0,
    maxChangedLines: 0,
    demo: false,
    model: null,
    findings: [],
    usage: { inputTokens: 0, outputTokens: 0 },
    warnings: [],
    error: null,
    activeId: null,
};

const persistedSchema = z.object({
    request: z.object({ url: z.string(), model: z.string(), includeSkipped: z.boolean(), selectedFiles: z.array(z.string()).optional() }).nullable(),
    status: z.enum(["idle", "streaming", "needs_selection", "done", "error", "interrupted", "stopped"]),
    pr: pullRequestMetaSchema.nullable(),
    files: z.array(fileSummarySchema),
    changedLines: z.number(),
    maxChangedLines: z.number(),
    demo: z.boolean(),
    model: z.string().nullable(),
    findings: z.array(triagedFindingSchema),
    usage: usageSchema,
    warnings: z.array(z.string()),
    error: z.object({ code: errorCodeSchema, message: z.string() }).nullable(),
    activeId: z.string().nullable(),
});

/** sessionStorage can throw (private mode, disabled storage, quota); the app must keep working without it. */
const safeSessionStorage: StateStorage = {
    getItem: (name) => {
        try {
            return window.sessionStorage.getItem(name);
        } catch {
            return null;
        }
    },
    setItem: (name, value) => {
        try {
            window.sessionStorage.setItem(name, value);
        } catch {
            // Full or unavailable storage only means the session is not kept across reloads.
        }
    },
    removeItem: (name) => {
        try {
            window.sessionStorage.removeItem(name);
        } catch {
            // Same as above.
        }
    },
};

function applyEventTo(state: ReviewData, event: ReviewEvent): Partial<ReviewData> {
    switch (event.type) {
        case "stage":
            return { progress: { message: event.message, current: event.current, total: event.total } };
        case "meta":
            return {
                pr: event.pr,
                files: event.files,
                changedLines: event.changedLines,
                maxChangedLines: event.maxChangedLines,
                demo: event.demo,
                model: event.model,
            };
        case "needs_selection":
            return {
                status: "needs_selection",
                changedLines: event.changedLines,
                maxChangedLines: event.maxChangedLines,
                progress: { message: `This pull request has ${event.changedLines} changed lines. Pick files to review.` },
            };
        case "finding":
            return {
                findings: [...state.findings, { ...event.finding, status: "pending", edited: false }],
                activeId: state.activeId ?? event.finding.id,
            };
        case "usage":
            return { usage: event.usage };
        case "warning":
            return { warnings: [...state.warnings, event.message] };
        case "error":
            return { status: "error", error: { code: event.code, message: event.message }, progress: null };
        case "done":
            return { status: "done", usage: event.usage };
    }
}

export const useReviewStore = create<ReviewData & ReviewActions>()(
    persist(
        (set, get) => ({
            ...initialState,

            begin: (request) => set({ ...initialState, request, status: "streaming", progress: { message: "Starting review" } }),

            applyEvent: (event) => set((state) => applyEventTo(state, event)),

            fail: (code, message) => set({ status: "error", error: { code, message }, progress: null }),

            stop: () => set({ status: "stopped", progress: { message: "Review stopped. Findings so far are kept." } }),

            setStatus: (id, status) =>
                set((state) => ({
                    findings: state.findings.map((finding) =>
                        finding.id === id ? { ...finding, status: finding.status === status ? "pending" : status } : finding,
                    ),
                })),

            editFinding: (id, edit) =>
                set((state) => ({
                    findings: state.findings.map((finding) => {
                        if (finding.id !== id) return finding;
                        const suggestion = edit.suggestion === undefined ? finding.suggestion : edit.suggestion.trim() === "" ? undefined : edit.suggestion;
                        return { ...finding, ...edit, suggestion, edited: true, status: finding.status === "dismissed" ? "pending" : finding.status };
                    }),
                })),

            setActive: (id) => set({ activeId: id }),

            moveActive: (direction, order) => {
                if (order.length === 0) return;
                const index = order.indexOf(get().activeId ?? "");
                const next = index === -1 ? (direction === 1 ? 0 : order.length - 1) : Math.min(order.length - 1, Math.max(0, index + direction));
                set({ activeId: order[next] ?? null });
            },

            reset: () => set({ ...initialState }),
        }),
        {
            name: "review-companion-session",
            version: 1,
            // Hydrated from the app shell after mount, so the server render and first client render match.
            skipHydration: true,
            storage: createJSONStorage(() => safeSessionStorage),
            partialize: ({ request, status, pr, files, changedLines, maxChangedLines, demo, model, findings, usage, warnings, error, activeId }) => ({
                request,
                status,
                pr,
                files,
                changedLines,
                maxChangedLines,
                demo,
                model,
                findings,
                usage,
                warnings,
                error,
                activeId,
            }),
            merge: (persisted, current) => {
                const parsed = persistedSchema.safeParse(persisted);
                if (!parsed.success) return current;
                // A stream cannot survive a reload: keep what arrived and say so.
                const status = parsed.data.status === "streaming" ? "interrupted" : parsed.data.status;
                return { ...current, ...parsed.data, status };
            },
        },
    ),
);

export function severityCounts(findings: TriagedFinding[]): Record<Severity, number> {
    const counts: Record<Severity, number> = { blocker: 0, bug: 0, risk: 0, nit: 0 };
    for (const finding of findings) if (finding.status !== "dismissed") counts[finding.severity] += 1;
    return counts;
}
