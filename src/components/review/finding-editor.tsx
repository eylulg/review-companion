"use client";

import { type ChangeEvent, type FormEvent, useId, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { SEVERITY_LABEL } from "@/lib/markdown-export";
import { type FindingEdit, SEVERITIES, type Severity, type TriagedFinding } from "@/lib/types";

interface FindingEditorProps {
    finding: TriagedFinding;
    titleId: string;
    onSave: (edit: FindingEdit) => void;
    onCancel: () => void;
}

export function FindingEditor({ finding, titleId, onSave, onCancel }: FindingEditorProps) {
    const severityId = useId();
    const [title, setTitle] = useState(finding.title);
    const [severity, setSeverity] = useState<Severity>(finding.severity);
    const [explanation, setExplanation] = useState(finding.explanation);
    const [suggestion, setSuggestion] = useState(finding.suggestion ?? "");
    const canSave = title.trim() !== "" && explanation.trim() !== "";

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canSave) return;
        onSave({ title: title.trim(), severity, explanation: explanation.trim(), suggestion });
    }

    function handleKeyDown(event: { key: string; preventDefault: () => void }) {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onCancel();
    }

    function handleSeverityChange(event: ChangeEvent<HTMLSelectElement>) {
        const next = SEVERITIES.find((value) => value === event.target.value);
        if (next) setSeverity(next);
    }

    return (
        <form onSubmit={handleSubmit} aria-label={`Edit finding: ${finding.title}`} className="flex flex-col gap-4">
            <Input id={titleId} label="Title" value={title} onChange={setTitle} onKeyDown={handleKeyDown} isRequired isInvalid={title.trim() === ""} />
            <div className="flex flex-col gap-1.5">
                <label htmlFor={severityId} className="text-sm font-medium text-secondary">
                    Severity
                </label>
                <select
                    id={severityId}
                    value={severity}
                    onChange={handleSeverityChange}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-lg bg-primary px-3 py-2 text-md text-primary shadow-xs ring-1 ring-primary ring-inset focus:ring-2 focus:ring-brand focus:outline-hidden sm:w-48"
                >
                    {SEVERITIES.map((value) => (
                        <option key={value} value={value}>
                            {SEVERITY_LABEL[value]}
                        </option>
                    ))}
                </select>
            </div>
            <TextArea
                label="Explanation"
                value={explanation}
                onChange={setExplanation}
                onKeyDown={handleKeyDown}
                rows={5}
                isRequired
                isInvalid={explanation.trim() === ""}
            />
            <TextArea
                label="Suggested replacement"
                hint="Replaces the cited lines. Leave empty for no suggestion block."
                value={suggestion}
                onChange={setSuggestion}
                onKeyDown={handleKeyDown}
                rows={4}
            />
            <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" isDisabled={!canSave}>
                    Save changes
                </Button>
                <Button color="secondary" size="sm" onPress={onCancel}>
                    Cancel editing
                </Button>
            </div>
        </form>
    );
}
