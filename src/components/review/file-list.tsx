import { SKIP_REASON_LABEL, basename } from "@/lib/file-filters";
import { fileAnchor } from "@/lib/ordering";
import type { FileSummary, TriagedFinding } from "@/lib/types";
import { cx } from "@/utils/cx";

interface FileListProps {
    files: FileSummary[];
    findings: TriagedFinding[];
}

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
                <h2 className="px-2 text-xs font-semibold tracking-wide text-tertiary uppercase">Reviewed files</h2>
                <ul className="flex flex-col">
                    {reviewed.map((file) => {
                        const count = counts.get(file.path) ?? 0;
                        return (
                            <li key={file.path}>
                                <a
                                    href={`#${fileAnchor(file.path)}`}
                                    title={file.path}
                                    aria-label={`${basename(file.path)} ${count} ${count === 1 ? "finding" : "findings"}, ${file.path}`}
                                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-secondary hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-brand"
                                >
                                    <span className="min-w-0 truncate">{basename(file.path)}</span>{" "}
                                    <span
                                        className={cx(
                                            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                                            count > 0 ? "bg-brand-primary text-brand-secondary" : "bg-secondary text-tertiary",
                                        )}
                                    >
                                        {count}
                                    </span>
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </div>
            {skipped.length > 0 && (
                <div className="flex flex-col gap-1">
                    <h2 className="px-2 text-xs font-semibold tracking-wide text-tertiary uppercase">Skipped</h2>
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
