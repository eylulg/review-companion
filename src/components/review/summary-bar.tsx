import { Download01, Plus } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { SEVERITY_LABEL } from "@/lib/markdown-export";
import { estimateCostUsd, modelLabel } from "@/lib/models";
import { formatTokens } from "@/lib/ordering";
import { SEVERITIES, type TriagedFinding, type Usage } from "@/lib/types";
import { severityCounts } from "@/store/review-store";
import { SEVERITY_COLOR } from "./severity";

interface SummaryBarProps {
    findings: TriagedFinding[];
    model: string | null;
    usage: Usage;
    demo: boolean;
    onExport: () => void;
    onNewReview: () => void;
}

export function SummaryBar({ findings, model, usage, demo, onExport, onNewReview }: SummaryBarProps) {
    const counts = severityCounts(findings);
    const accepted = findings.filter((finding) => finding.status === "accepted").length;
    const dismissed = findings.filter((finding) => finding.status === "dismissed").length;
    const total = usage.inputTokens + usage.outputTokens;
    const cost = model ? estimateCostUsd(model, usage.inputTokens, usage.outputTokens) : 0;

    return (
        <section aria-label="Review summary" className="sticky top-0 z-10 border-b border-secondary bg-primary">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-6">
                <ul aria-label="Open findings by severity" className="flex flex-wrap items-center gap-1.5">
                    {SEVERITIES.map((severity) => (
                        <li key={severity}>
                            <Badge type="pill-color" size="sm" color={SEVERITY_COLOR[severity]}>
                                {counts[severity]} {SEVERITY_LABEL[severity].toLowerCase()}
                                {counts[severity] === 1 ? "" : "s"}
                            </Badge>
                        </li>
                    ))}
                </ul>
                <p className="text-sm text-tertiary">
                    {accepted} accepted, {dismissed} dismissed
                </p>
                <p className="text-sm text-tertiary">
                    {model ? modelLabel(model) : "Model pending"}
                    {" · "}
                    <span title={`${usage.inputTokens.toLocaleString("en-US")} input, ${usage.outputTokens.toLocaleString("en-US")} output`}>
                        {formatTokens(total)} tokens
                    </span>
                    {total > 0 && !demo ? ` · about $${cost.toFixed(cost < 0.1 ? 3 : 2)}` : ""}
                    {demo ? " (sample)" : ""}
                </p>
                <div className="ml-auto flex gap-2">
                    <Button size="sm" color="secondary" iconLeading={Plus} onPress={onNewReview}>
                        Start a new review
                    </Button>
                    <Button size="sm" iconLeading={Download01} onPress={onExport} isDisabled={findings.length === 0}>
                        Export comments
                    </Button>
                </div>
            </div>
        </section>
    );
}
