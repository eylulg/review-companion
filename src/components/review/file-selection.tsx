"use client";

import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { SURFACE_CLASS } from "@/components/styles";
import { SKIP_REASON_LABEL } from "@/lib/file-filters";
import type { FileSummary } from "@/lib/types";
import { cx } from "@/utils/cx";

interface FileSelectionProps {
    files: FileSummary[];
    maxChangedLines: number;
    onSubmit: (paths: string[]) => void;
}

/** Picks files in diff order while they fit under the cap. */
function initialSelection(files: FileSummary[], maxChangedLines: number): Set<string> {
    const picked = new Set<string>();
    let total = 0;
    for (const file of files) {
        const lines = file.additions + file.deletions;
        if (!file.selected || total + lines > maxChangedLines) continue;
        picked.add(file.path);
        total += lines;
    }
    return picked;
}

export function FileSelection({ files, maxChangedLines, onSubmit }: FileSelectionProps) {
    const [picked, setPicked] = useState(() => initialSelection(files, maxChangedLines));
    const eligible = files.filter((file) => file.selected);
    const total = eligible.filter((file) => picked.has(file.path)).reduce((sum, file) => sum + file.additions + file.deletions, 0);
    const over = total > maxChangedLines;

    function handleToggle(path: string, value: boolean) {
        setPicked((current) => {
            const next = new Set(current);
            if (value) next.add(path);
            else next.delete(path);
            return next;
        });
    }

    function handleSubmit() {
        onSubmit(eligible.filter((file) => picked.has(file.path)).map((file) => file.path));
    }

    return (
        <section aria-labelledby="selection-heading" className={cx(SURFACE_CLASS, "flex flex-col gap-4 p-4 md:p-6")}>
            <div className="flex flex-col gap-1">
                <h2 id="selection-heading" className="text-lg font-semibold text-primary">
                    Pick the files to review
                </h2>
                <p className="text-sm text-tertiary">
                    This pull request changes more than {maxChangedLines.toLocaleString("en-US")} lines, the most one review covers. Choose the files that
                    matter most.
                </p>
            </div>
            <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
                {eligible.map((file) => (
                    <li key={file.path}>
                        <FileCheckbox file={file} isSelected={picked.has(file.path)} onToggle={handleToggle} />
                    </li>
                ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
                <p role="status" className={cx("text-sm font-medium", over ? "text-error-primary" : "text-secondary")}>
                    {total.toLocaleString("en-US")} of {maxChangedLines.toLocaleString("en-US")} lines selected
                    {over ? ". Remove some files to continue." : ""}
                </p>
                <Button className="ml-auto" isDisabled={over || picked.size === 0} onPress={handleSubmit}>
                    Review {picked.size} {picked.size === 1 ? "file" : "files"}
                </Button>
            </div>
        </section>
    );
}

function FileCheckbox({ file, isSelected, onToggle }: { file: FileSummary; isSelected: boolean; onToggle: (path: string, value: boolean) => void }) {
    const reason = file.skipReason ? `, ${SKIP_REASON_LABEL[file.skipReason].toLowerCase()}` : "";

    function handleChange(value: boolean) {
        onToggle(file.path, value);
    }

    return (
        <Checkbox
            isSelected={isSelected}
            onChange={handleChange}
            label={<span className="font-mono break-all">{file.path}</span>}
            hint={`${file.additions + file.deletions} changed lines${reason}`}
        />
    );
}
