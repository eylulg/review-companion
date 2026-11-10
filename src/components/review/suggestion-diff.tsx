import { cx } from "@eylulg/ui/cx";

interface SuggestionDiffProps {
    original?: string;
    suggestion: string;
}

/** Shows the cited lines and the suggested replacement as a small removed and added diff. */
export function SuggestionDiff({ original, suggestion }: SuggestionDiffProps) {
    return (
        <figure className="overflow-hidden rounded-lg border border-subtle">
            <figcaption className="border-b border-subtle bg-secondary px-3 py-1.5 text-xs font-medium text-secondary">Suggested change</figcaption>
            <div className="font-data text-xs leading-5 text-primary">
                {original !== undefined && <DiffLines label="Current code" marker="-" text={original} className="bg-error-subtle" />}
                <DiffLines label="Suggested code" marker="+" text={suggestion} className="bg-success-subtle" />
            </div>
        </figure>
    );
}

function DiffLines({ label, marker, text, className }: { label: string; marker: string; text: string; className: string }) {
    return (
        <pre className={cx(className, "px-3 py-1.5 break-all whitespace-pre-wrap")}>
            <span className="sr-only">{label}: </span>
            {text.split("\n").map((line, index) => (
                <span key={index} className="block">
                    <span aria-hidden="true" className="mr-2 select-none">
                        {marker}
                    </span>
                    {line || " "}
                </span>
            ))}
        </pre>
    );
}
