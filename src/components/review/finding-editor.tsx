"use client";

import { type FormEvent, type KeyboardEvent, useState } from "react";
import { Button } from "@eylulg/ui/button";
import { Input } from "@eylulg/ui/input";
import { Select, SelectItem } from "@eylulg/ui/select";
import { Textarea } from "@eylulg/ui/textarea";
import type { Key } from "react-aria-components";
import { SEVERITY_LABEL } from "@/lib/markdown-export";
import { type FindingEdit, SEVERITIES, type Severity, type TriagedFinding } from "@/lib/types";

interface FindingEditorProps {
    finding: TriagedFinding;
    titleId: string;
    onSave: (edit: FindingEdit) => void;
    onCancel: () => void;
}

const SEVERITY_ITEMS = SEVERITIES.map((value) => ({ id: value, label: SEVERITY_LABEL[value] }));

export function FindingEditor({ finding, titleId, onSave, onCancel }: FindingEditorProps) {
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

    function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onCancel();
    }

    function handleSeverityChange(key: Key | null) {
        const next = SEVERITIES.find((value) => value === key);
        if (next) setSeverity(next);
    }

    return (
        // Escape in any field cancels the edit, so the listener sits on the form that wraps them.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} aria-label={`Edit finding: ${finding.title}`} className="flex flex-col gap-4">
            <Input id={titleId} label="Title" value={title} onChange={setTitle} isRequired isInvalid={title.trim() === ""} />
            <Select label="Severity" className="sm:w-48" selectedKey={severity} onSelectionChange={handleSeverityChange} items={SEVERITY_ITEMS}>
                {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
            </Select>
            <Textarea label="Explanation" value={explanation} onChange={setExplanation} rows={5} isRequired isInvalid={explanation.trim() === ""} />
            <Textarea
                label="Suggested replacement"
                hint="Replaces the cited lines. Leave empty for no suggestion block."
                value={suggestion}
                onChange={setSuggestion}
                rows={4}
            />
            <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" isDisabled={!canSave}>
                    Save changes
                </Button>
                <Button variant="secondary" size="sm" onPress={onCancel}>
                    Cancel editing
                </Button>
            </div>
        </form>
    );
}
