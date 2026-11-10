import type { MouseEvent } from "react";
import { Badge } from "@eylulg/ui/badge";
import { SKIP_REASON_LABEL, basename } from "@/lib/file-filters";
import { fileAnchor } from "@/lib/ordering";
import type { FileSummary, TriagedFinding } from "@/lib/types";

interface FileListProps {
    files: FileSummary[];
    findings: TriagedFinding[];
}

const FILE_LINK_CLASS =
    "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-secondary hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus";

const GROUP_HEADING_CLASS = "px-2 text-xs font-semibold tracking-wide text-tertiary uppercase";

export function FileList({ files, findings }: FileListProps) {
    const counts = new Map<string, number>();
    for (const finding of findings) {
        if (finding.status !== "dismissed") counts.set(finding.file, (counts.get(finding.file) ?? 0) + 1);
    }
    const reviewed = files.filter((file) => file.selected);
    const skipped = files.filter((file) => !file.selected);

    return (
        <nav aria-label="Files in this pull request" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h2 className={GROUP_HEADING_CLASS}>Reviewed files</h2>
                <ul className="flex flex-col">
                    {reviewed.map((file) => {
                        const count = counts.get(file.path) ?? 0;
                        return (
                            <li key={file.path}>
                                <FileLink file={file} count={count} />
                            </li>
                        );
                    })}
                </ul>
            </div>
            {skipped.length > 0 && (
                <div className="flex flex-col gap-1">
                    <h2 className={GROUP_HEADING_CLASS}>Skipped</h2>
                    <ul className="flex flex-col">
                        {skipped.map((file) => (
                            <li key={file.path} title={file.path} className="flex items-center justify-between gap-2 px-2 py-1 text-sm text-tertiary">
                                <span className="min-w-0 truncate">{basename(file.path)}</span>
                                <span className="shrink-0 text-xs">{file.skipReason ? SKIP_REASON_LABEL[file.skipReason] : "Not selected"}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </nav>
    );
}

function FileLink({ file, count }: { file: FileSummary; count: number }) {
    // The default hash jump would leave focus on the body (the target is not focusable), so scroll the group
    // below the sticky bars ourselves and put focus on its heading.
    function handleClick(event: MouseEvent<HTMLAnchorElement>) {
        const group = document.getElementById(fileAnchor(file.path));
        if (!group) return;
        event.preventDefault();
        group.scrollIntoView({ block: "start" });
        document.getElementById(`${fileAnchor(file.path)}-heading`)?.focus({ preventScroll: true });
    }

    return (
        <a
            href={`#${fileAnchor(file.path)}`}
            title={file.path}
            aria-label={`${basename(file.path)} ${count} ${count === 1 ? "finding" : "findings"}, ${file.path}`}
            className={FILE_LINK_CLASS}
            onClick={handleClick}
        >
            <span className="min-w-0 truncate">{basename(file.path)}</span>{" "}
            <Badge size="sm" color={count > 0 ? "brand" : "gray"}>
                {count}
            </Badge>
        </a>
    );
}
