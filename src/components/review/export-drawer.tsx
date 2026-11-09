"use client";

import { useEffect, useRef, useState } from "react";
import { Copy01 } from "@untitledui/icons";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Button } from "@/components/base/buttons/button";
import { TextArea } from "@/components/base/textarea/textarea";
import { Toggle } from "@/components/base/toggle/toggle";
import { buildReviewMarkdown, exportableFindings } from "@/lib/markdown-export";
import type { FileSummary, PullRequestMeta, TriagedFinding } from "@/lib/types";

interface ExportDrawerProps {
    onClose: () => void;
    findings: TriagedFinding[];
    files: FileSummary[];
    pr: PullRequestMeta | null;
    linkLines: boolean;
}

/** Mounted only while open (and loaded lazily), so its state starts fresh every time. */
export default function ExportDrawer({ onClose, findings, files, pr, linkLines }: ExportDrawerProps) {
    const [includePending, setIncludePending] = useState(false);
    const [copyStatus, setCopyStatus] = useState("");
    const unmounted = useRef<AbortController | null>(null);
    const acceptedCount = findings.filter((finding) => finding.status === "accepted").length;
    // With nothing accepted yet, export everything not dismissed so the drawer is never empty by surprise.
    const effectiveIncludePending = includePending || acceptedCount === 0;
    const fileOrder = files.map((file) => file.path);
    const markdown = buildReviewMarkdown(findings, pr, { includePending: effectiveIncludePending, linkLines, fileOrder });
    const count = exportableFindings(findings, { includePending: effectiveIncludePending, fileOrder }).length;

    useEffect(() => {
        const controller = new AbortController();
        unmounted.current = controller;
        return () => controller.abort();
    }, []);

    function handleOpenChange(open: boolean) {
        if (!open) onClose();
    }

    async function copy(signal: AbortSignal | undefined) {
        try {
            await navigator.clipboard.writeText(markdown);
            if (!signal?.aborted) setCopyStatus("Copied to clipboard.");
        } catch {
            if (!signal?.aborted) setCopyStatus("Copy failed. Select the text and copy it manually.");
        }
    }

    function handleCopy() {
        copy(unmounted.current?.signal).catch(() => setCopyStatus("Copy failed. Select the text and copy it manually."));
    }

    return (
        <SlideoutMenu isOpen onOpenChange={handleOpenChange} isDismissable dialogLabelledBy="export-heading" className="max-w-full md:max-w-2xl">
            <SlideoutMenu.Header onClose={onClose}>
                <h2 id="export-heading" className="text-lg font-semibold text-primary">
                    Export review comments
                </h2>
                <p className="mt-1 pr-8 text-sm text-tertiary">
                    GitHub Markdown grouped by file. Paste each block as a comment on the cited line, or paste everything as the review summary.
                </p>
            </SlideoutMenu.Header>
            <div className="flex min-h-0 w-full flex-1 flex-col gap-4 px-4 md:px-6">
                <Toggle
                    label="Include findings you have not triaged"
                    hint={acceptedCount === 0 ? "Nothing is accepted yet, so every finding that is not dismissed is included." : `${acceptedCount} accepted.`}
                    isSelected={effectiveIncludePending}
                    isDisabled={acceptedCount === 0}
                    onChange={setIncludePending}
                />
                <TextArea label={`Markdown for ${count} ${count === 1 ? "comment" : "comments"}`} value={markdown} isReadOnly rows={18} />
            </div>
            <SlideoutMenu.Footer className="flex flex-wrap items-center gap-3">
                <p role="status" className="text-sm text-secondary">
                    {copyStatus}
                </p>
                <Button className="ml-auto" iconLeading={Copy01} onPress={handleCopy} isDisabled={count === 0}>
                    Copy Markdown
                </Button>
            </SlideoutMenu.Footer>
        </SlideoutMenu>
    );
}
