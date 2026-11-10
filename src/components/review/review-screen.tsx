"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@eylulg/ui/button";
import { Kbd } from "@eylulg/ui/kbd";
import { CircleAlert, ExternalLink } from "lucide-react";
import dynamic from "next/dynamic";
import { useShallow } from "zustand/react/shallow";
import { FILE_GROUP_CLASS, LINK_CLASS } from "@/components/styles";
import { useReviewShortcuts } from "@/hooks/use-review-shortcuts";
import { parsePullRequestUrl } from "@/lib/github";
import { fileAnchor, groupFindingsByFile } from "@/lib/ordering";
import type { FindingEdit, ReviewErrorCode, ReviewRequest, TriageStatus } from "@/lib/types";
import { useReviewStore } from "@/store/review-store";
import { FileList } from "./file-list";
import { FileSelection } from "./file-selection";
import { FindingCard, editButtonId, findingDomId, titleInputId } from "./finding-card";
import { ProgressPanel } from "./progress-panel";
import { SummaryBar } from "./summary-bar";

interface ReviewScreenProps {
    onStart: (request: ReviewRequest) => void;
    onCancel: () => void;
    onNewReview: () => void;
}

const ExportDrawer = dynamic(() => import("./export-drawer"), { ssr: false });

const RUN_AGAIN_ID = "run-review-again";

/** Errors the user fixes by choosing fewer files, so the picker comes back with the limit explained. */
const SELECTION_ERRORS: ReviewErrorCode[] = ["too_costly", "too_large"];

function shortTitle(url: string): string {
    const ref = parsePullRequestUrl(url);
    return ref ? `${ref.owner}/${ref.repo}#${ref.number}` : url;
}

function focusById(id: string, scroll = false) {
    // Wait a frame so the element exists after the state change that reveals it.
    requestAnimationFrame(() => {
        const element = document.getElementById(id);
        element?.focus({ preventScroll: true });
        if (scroll) {
            const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            element?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
        }
    });
}

export function ReviewScreen({ onStart, onCancel, onNewReview }: ReviewScreenProps) {
    const { request, status, progress, pr, files, changedLines, findings, usage, warnings, error, activeId, demo, model, maxChangedLines } = useReviewStore(
        useShallow((state) => ({
            request: state.request,
            status: state.status,
            progress: state.progress,
            pr: state.pr,
            files: state.files,
            changedLines: state.changedLines,
            findings: state.findings,
            usage: state.usage,
            warnings: state.warnings,
            error: state.error,
            activeId: state.activeId,
            demo: state.demo,
            model: state.model,
            maxChangedLines: state.maxChangedLines,
        })),
    );
    const { setStatus, editFinding, setActive, moveActive, stop } = useReviewStore.getState();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const heading = useRef<HTMLHeadingElement>(null);
    const alert = useRef<HTMLDivElement>(null);
    const groups = groupFindingsByFile(findings, files);
    const order = groups.flatMap((group) => group.findings.map((finding) => finding.id));
    const linkLines = !demo;
    const title = pr?.title ?? (request ? shortTitle(request.url) : "Review");
    const errorCode = error?.code;
    const pickAgain = status === "error" && errorCode !== undefined && SELECTION_ERRORS.includes(errorCode) && files.some((file) => file.selected);
    const showSelection = status === "needs_selection" || pickAgain;
    const panelProgress = status === "needs_selection" ? { message: `This pull request has ${changedLines} changed lines. Pick files to review.` } : progress;

    useEffect(() => {
        heading.current?.focus();
    }, []);

    useEffect(() => {
        if (errorCode && SELECTION_ERRORS.includes(errorCode)) alert.current?.focus();
    }, [errorCode]);

    function moveAndFocus(direction: 1 | -1) {
        moveActive(direction, order);
        const next = useReviewStore.getState().activeId;
        if (next) focusById(findingDomId(next), true);
    }

    function handleStatusChange(id: string, next: TriageStatus) {
        setActive(id);
        setStatus(id, next);
    }

    function handleEdit(id: string) {
        setActive(id);
        setEditingId(id);
        focusById(titleInputId(id));
    }

    function handleCloseEditor(id: string) {
        setEditingId(null);
        focusById(editButtonId(id));
    }

    function handleSaveEdit(id: string, edit: FindingEdit) {
        editFinding(id, edit);
        handleCloseEditor(id);
    }

    function handleStop() {
        onCancel();
        stop();
        focusById(RUN_AGAIN_ID);
    }

    function handleRetry() {
        if (!request) return;
        onStart(request);
        // The button that was pressed unmounts, so focus the heading instead of losing it to the body.
        heading.current?.focus();
    }

    function handleSelection(paths: string[]) {
        if (!request) return;
        onStart({ ...request, selectedFiles: paths });
        heading.current?.focus();
    }

    function handleOpenExport() {
        setExportOpen(true);
    }

    function handleCloseExport() {
        setExportOpen(false);
    }

    useReviewShortcuts(
        {
            next: () => moveAndFocus(1),
            previous: () => moveAndFocus(-1),
            accept: () => activeId && setStatus(activeId, "accepted"),
            dismiss: () => activeId && setStatus(activeId, "dismissed"),
            edit: () => activeId && handleEdit(activeId),
        },
        !exportOpen && editingId === null,
    );

    return (
        <>
            {pr && <SummaryBar findings={findings} model={model} usage={usage} demo={demo} onExport={handleOpenExport} onNewReview={onNewReview} />}

            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    {pr && (
                        <p className="text-sm text-tertiary">
                            {pr.owner}/{pr.repo} #{pr.number} by {pr.author}
                        </p>
                    )}
                    <h1 ref={heading} tabIndex={-1} className="text-display-xs md:text-display-sm font-semibold break-words text-primary outline-none">
                        {title}
                    </h1>
                    {pr && !demo && (
                        <a
                            href={pr.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open the pull request on GitHub (opens in a new tab)"
                            className={LINK_CLASS}
                        >
                            Open the pull request on GitHub
                            <ExternalLink aria-hidden="true" className="size-3.5" />
                        </a>
                    )}
                    <ProgressPanel status={status} progress={panelProgress} />
                    {status === "streaming" && (
                        <div>
                            <Button size="sm" variant="secondary" onPress={handleStop}>
                                Stop review
                            </Button>
                        </div>
                    )}
                </div>

                {error && (
                    <div ref={alert} role="alert" tabIndex={-1} className="flex flex-col gap-3 rounded-xl border border-error bg-error-subtle p-4 outline-none">
                        <p className="flex items-start gap-2 text-sm font-medium text-error">
                            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                            {error.message}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {request && !pickAgain && (
                                <Button size="sm" variant="secondary" onPress={handleRetry}>
                                    Try again
                                </Button>
                            )}
                            <Button size="sm" variant="tertiary" onPress={onNewReview}>
                                Review another pull request
                            </Button>
                        </div>
                    </div>
                )}

                {(status === "interrupted" || status === "stopped") && request && (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-subtle bg-secondary p-4">
                        <p className="text-sm text-secondary">
                            {status === "interrupted"
                                ? "The page was reloaded while the review was running. Findings that arrived are kept."
                                : "You stopped the review. Findings that arrived are kept."}
                        </p>
                        <Button id={RUN_AGAIN_ID} size="sm" variant="secondary" onPress={handleRetry}>
                            Run the review again
                        </Button>
                    </div>
                )}

                {warnings.length > 0 && (
                    <ul aria-label="Warnings" className="flex flex-col gap-1 text-sm text-secondary">
                        {warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                        ))}
                    </ul>
                )}

                {showSelection && request && (
                    <FileSelection
                        files={files}
                        maxChangedLines={maxChangedLines}
                        previousSelection={pickAgain ? request.selectedFiles : undefined}
                        overCostLimit={pickAgain}
                        onSubmit={handleSelection}
                    />
                )}

                {!showSelection && files.length > 0 && (
                    <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
                        <aside className="md:sticky md:top-[calc(var(--summary-bottom,12rem)+1rem)] md:max-h-[calc(100dvh-var(--summary-bottom,12rem)-2rem)] md:self-start md:overflow-y-auto">
                            <FileList files={files} findings={findings} />
                        </aside>

                        <section aria-labelledby="findings-heading" className="flex min-w-0 flex-col gap-6">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h2 id="findings-heading" className="text-lg font-semibold text-primary">
                                    Findings
                                </h2>
                                <p className="text-xs text-tertiary">
                                    Keyboard: <Kbd>j</Kbd> and <Kbd>k</Kbd> move, <Kbd>a</Kbd> accepts, <Kbd>d</Kbd> dismisses, <Kbd>e</Kbd> edits.
                                </p>
                            </div>

                            {groups.length === 0 && status === "done" && (
                                <p className="rounded-xl bg-secondary p-6 text-sm text-secondary">
                                    No findings. Claude did not see anything worth raising in the reviewed files.
                                </p>
                            )}
                            {groups.length === 0 && status === "streaming" && (
                                <p className="text-sm text-tertiary">Findings appear here as each file is reviewed.</p>
                            )}

                            {groups.map((group) => (
                                <section
                                    key={group.path}
                                    id={fileAnchor(group.path)}
                                    aria-labelledby={`${fileAnchor(group.path)}-heading`}
                                    className={FILE_GROUP_CLASS}
                                >
                                    <h3
                                        id={`${fileAnchor(group.path)}-heading`}
                                        tabIndex={-1}
                                        className="font-data text-sm font-semibold break-all text-secondary outline-none"
                                    >
                                        {group.path}
                                    </h3>
                                    <ol className="flex flex-col gap-3">
                                        {group.findings.map((finding) => (
                                            <li key={finding.id}>
                                                <FindingCard
                                                    finding={finding}
                                                    pr={pr}
                                                    linkLines={linkLines}
                                                    isActive={finding.id === activeId}
                                                    isEditing={finding.id === editingId}
                                                    onStatusChange={handleStatusChange}
                                                    onEdit={handleEdit}
                                                    onSaveEdit={handleSaveEdit}
                                                    onCloseEditor={handleCloseEditor}
                                                />
                                            </li>
                                        ))}
                                    </ol>
                                </section>
                            ))}
                        </section>
                    </div>
                )}
            </div>

            {exportOpen && <ExportDrawer onClose={handleCloseExport} findings={findings} files={files} pr={pr} linkLines={linkLines} />}
        </>
    );
}
