"use client";

import { Check, Edit05, LinkExternal01, XClose } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { LINK_CLASS, SURFACE_CLASS } from "@/components/styles";
import { lineUrl } from "@/lib/github";
import { SEVERITY_LABEL } from "@/lib/markdown-export";
import type { FindingEdit, PullRequestMeta, TriageStatus, TriagedFinding } from "@/lib/types";
import { cx } from "@/utils/cx";
import { FindingEditor } from "./finding-editor";
import { InlineText } from "./inline-text";
import { SEVERITY_COLOR } from "./severity";
import { SuggestionDiff } from "./suggestion-diff";

interface FindingCardProps {
    finding: TriagedFinding;
    pr: PullRequestMeta | null;
    linkLines: boolean;
    isActive: boolean;
    isEditing: boolean;
    onStatusChange: (id: string, status: TriageStatus) => void;
    onEdit: (id: string) => void;
    onSaveEdit: (id: string, edit: FindingEdit) => void;
    onCloseEditor: (id: string) => void;
}

export function findingDomId(id: string): string {
    return `finding-${id}`;
}

export function editButtonId(id: string): string {
    return `${findingDomId(id)}-edit`;
}

export function titleInputId(id: string): string {
    return `${findingDomId(id)}-title-input`;
}

export function FindingCard({ finding, pr, linkLines, isActive, isEditing, onStatusChange, onEdit, onSaveEdit, onCloseEditor }: FindingCardProps) {
    const titleId = `${findingDomId(finding.id)}-title`;
    const lines = finding.endLine ? `Lines ${finding.line} to ${finding.endLine}` : `Line ${finding.line}`;

    function handleAccept() {
        onStatusChange(finding.id, "accepted");
    }

    function handleDismiss() {
        onStatusChange(finding.id, "dismissed");
    }

    function handleEdit() {
        onEdit(finding.id);
    }

    function handleSave(edit: FindingEdit) {
        onSaveEdit(finding.id, edit);
    }

    function handleCancel() {
        onCloseEditor(finding.id);
    }

    return (
        <article
            id={findingDomId(finding.id)}
            tabIndex={-1}
            aria-labelledby={titleId}
            className={cx(
                SURFACE_CLASS,
                "flex scroll-mt-40 flex-col gap-3 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:p-5",
                isActive && "ring-2 ring-brand",
                finding.status === "dismissed" && "opacity-70",
            )}
        >
            <div className="flex flex-wrap items-center gap-2">
                <Badge type="pill-color" size="sm" color={SEVERITY_COLOR[finding.severity]}>
                    {SEVERITY_LABEL[finding.severity]}
                </Badge>
                <Badge type="pill-color" size="sm" color="gray">
                    {finding.category}
                </Badge>
                {finding.status !== "pending" && (
                    <Badge type="pill-color" size="sm" color={finding.status === "accepted" ? "success" : "gray"}>
                        {finding.status === "accepted" ? "Accepted" : "Dismissed"}
                    </Badge>
                )}
                {finding.edited && (
                    <Badge type="pill-color" size="sm" color="purple">
                        Edited
                    </Badge>
                )}
                <span className="ml-auto text-xs text-tertiary">{Math.round(finding.confidence * 100)}% confident</span>
            </div>

            <div className="flex flex-col gap-1">
                <h3 id={titleId} className="text-md font-semibold text-primary">
                    {finding.title}
                </h3>
                {linkLines && pr ? (
                    <a
                        href={lineUrl(pr, finding.file, finding.line, finding.endLine)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${lines} of ${finding.file} on GitHub (opens in a new tab)`}
                        className={LINK_CLASS}
                    >
                        {lines}
                        <LinkExternal01 aria-hidden="true" className="size-3.5" />
                    </a>
                ) : (
                    <span className="text-sm font-medium text-tertiary">{lines}</span>
                )}
            </div>

            {isEditing ? (
                <FindingEditor finding={finding} titleId={titleInputId(finding.id)} onSave={handleSave} onCancel={handleCancel} />
            ) : (
                <>
                    <div className="flex flex-col gap-2">
                        <InlineText text={finding.explanation} />
                    </div>
                    {finding.suggestion !== undefined && <SuggestionDiff original={finding.originalCode} suggestion={finding.suggestion} />}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            color={finding.status === "accepted" ? "primary" : "secondary"}
                            iconLeading={Check}
                            aria-label={`Accept finding: ${finding.title}`}
                            aria-pressed={finding.status === "accepted"}
                            aria-keyshortcuts="a"
                            onPress={handleAccept}
                        >
                            Accept
                        </Button>
                        <Button
                            size="sm"
                            color="secondary"
                            iconLeading={XClose}
                            aria-label={`Dismiss finding: ${finding.title}`}
                            aria-pressed={finding.status === "dismissed"}
                            aria-keyshortcuts="d"
                            onPress={handleDismiss}
                        >
                            Dismiss
                        </Button>
                        <Button
                            id={editButtonId(finding.id)}
                            size="sm"
                            color="tertiary"
                            iconLeading={Edit05}
                            aria-label={`Edit finding: ${finding.title}`}
                            aria-keyshortcuts="e"
                            onPress={handleEdit}
                        >
                            Edit
                        </Button>
                    </div>
                </>
            )}
        </article>
    );
}
