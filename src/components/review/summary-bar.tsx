import { useEffect, useRef } from "react";
import { Button } from "@eylulg/ui/button";
import { Stat } from "@eylulg/ui/stat";
import { Download, Plus } from "lucide-react";
import { SEVERITY_LABEL } from "@/lib/markdown-export";
import { estimateCostUsd, modelLabel } from "@/lib/models";
import { formatTokens } from "@/lib/ordering";
import { SEVERITIES, type TriagedFinding, type Usage } from "@/lib/types";
import { severityCounts } from "@/store/review-store";

interface SummaryBarProps {
    findings: TriagedFinding[];
    model: string | null;
    usage: Usage;
    demo: boolean;
    onExport: () => void;
    onNewReview: () => void;
}

export function SummaryBar({ findings, model, usage, demo, onExport, onNewReview }: SummaryBarProps) {
    const bar = useRef<HTMLElement>(null);
    const counts = severityCounts(findings);
    const accepted = findings.filter((finding) => finding.status === "accepted").length;
    const dismissed = findings.filter((finding) => finding.status === "dismissed").length;
    const total = usage.inputTokens + usage.outputTokens;
    const cost = model ? estimateCostUsd(model, usage.inputTokens, usage.outputTokens) : 0;

    useEffect(() => {
        const element = bar.current;
        if (!element) return;
        const root = document.documentElement;
        const publish = () => {
            const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
            root.style.setProperty("--summary-top", `${header}px`);
            root.style.setProperty("--summary-bottom", `${header + element.offsetHeight}px`);
        };
        publish();
        const observer = new ResizeObserver(publish);
        observer.observe(element);
        return () => {
            observer.disconnect();
            root.style.removeProperty("--summary-top");
            root.style.removeProperty("--summary-bottom");
        };
    }, []);

    return (
        <section
            ref={bar}
            aria-label="Review summary"
            className="flex flex-col gap-3 border-b border-subtle bg-primary py-3 md:sticky md:top-[var(--summary-top,3.5rem)] md:z-30"
        >
            <ul aria-label="Open findings by severity" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {SEVERITIES.map((severity) => (
                    <li key={severity}>
                        <Stat size="sm" label={SEVERITY_LABEL[severity]} value={counts[severity]} />
                    </li>
                ))}
            </ul>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
                    <Button size="sm" variant="secondary" iconLeading={Plus} onPress={onNewReview}>
                        Start a new review
                    </Button>
                    <Button size="sm" iconLeading={Download} onPress={onExport} isDisabled={findings.length === 0}>
                        Export comments
                    </Button>
                </div>
            </div>
        </section>
    );
}
