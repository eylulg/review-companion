import type { Progress, ReviewStatus } from "@/lib/types";

interface ProgressPanelProps {
    status: ReviewStatus;
    progress: Progress | null;
}

/** The live region screen readers use to follow the stream. Always mounted so announcements are not lost. */
export function ProgressPanel({ status, progress }: ProgressPanelProps) {
    const streaming = status === "streaming";
    const percent = progress?.current && progress.total ? Math.round(((progress.current - 1) / progress.total) * 100) : null;

    return (
        <div className="flex flex-col gap-2">
            <div role="status" aria-live="polite" aria-atomic="true" className="flex min-h-6 items-center gap-2 text-sm text-secondary">
                {streaming && (
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4 shrink-0 text-fg-brand-primary">
                        <circle className="stroke-current opacity-30" cx="10" cy="10" r="8" strokeWidth="2" />
                        <circle
                            className="origin-center stroke-current motion-safe:animate-spin"
                            cx="10"
                            cy="10"
                            r="8"
                            strokeWidth="2"
                            strokeDasharray="12.5 50"
                            strokeLinecap="round"
                        />
                    </svg>
                )}
                <span>{progress?.message ?? ""}</span>
            </div>
            {streaming && percent !== null && (
                <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                        className="h-full rounded-full bg-brand-solid motion-safe:transition-[width] motion-safe:duration-500"
                        style={{ width: `${Math.max(5, percent)}%` }}
                    />
                </div>
            )}
        </div>
    );
}
