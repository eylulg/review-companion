import { z } from "zod";
import { type Finding, SEVERITIES } from "./types";

/** Shape the model must return, validated after every response. */
const modelFindingSchema = z.object({
    file: z.string().min(1),
    line: z.number().int().positive(),
    endLine: z.number().int().positive().nullable().optional(),
    severity: z.enum(SEVERITIES),
    category: z.string().min(1).max(40),
    title: z.string().min(1).max(160),
    explanation: z.string().min(1),
    suggestion: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1),
});

const modelResponseSchema = z.object({
    findings: z.array(z.unknown()),
});

/**
 * JSON schema sent as `output_config.format` so the model returns exactly this shape.
 * Structured outputs need every property listed in `required` and `additionalProperties: false`,
 * so optional values are expressed as nullable.
 */
export const findingsJsonSchema = {
    type: "object",
    additionalProperties: false,
    required: ["findings"],
    properties: {
        findings: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["file", "line", "endLine", "severity", "category", "title", "explanation", "suggestion", "confidence"],
                properties: {
                    file: { type: "string", description: "Path of the file exactly as given in the diff." },
                    line: { type: "integer", description: "New-side line number from the diff gutter." },
                    endLine: {
                        anyOf: [{ type: "integer" }, { type: "null" }],
                        description: "Last new-side line when the finding spans several lines, otherwise null.",
                    },
                    severity: { type: "string", enum: [...SEVERITIES] },
                    category: {
                        type: "string",
                        description: "One or two words, for example correctness, tests, accessibility, security, performance, duplication, naming.",
                    },
                    title: { type: "string", description: "One short sentence." },
                    explanation: { type: "string", description: "Why it matters and what to do, in GitHub Markdown." },
                    suggestion: {
                        anyOf: [{ type: "string" }, { type: "null" }],
                        description: "Exact replacement code for lines line..endLine, or null when no certain replacement exists.",
                    },
                    confidence: { type: "number", description: "0 to 1." },
                },
            },
        },
    },
} as const;

interface ValidationContext {
    path: string;
    /** New-side line number to content for the lines visible in the chunk. */
    lines: Map<number, string>;
    makeId: () => string;
}

interface ValidationResult {
    findings: Finding[];
    rejected: number;
}

/**
 * Validates raw model output against the schema and the diff: every finding must cite the chunk's
 * file and a line that exists on the new side of the diff. Anything else is dropped and counted.
 */
export function validateFindings(raw: unknown, context: ValidationContext): ValidationResult {
    const envelope = modelResponseSchema.safeParse(raw);
    if (!envelope.success) return { findings: [], rejected: 0 };

    const findings: Finding[] = [];
    let rejected = 0;

    for (const item of envelope.data.findings) {
        const parsed = modelFindingSchema.safeParse(item);
        if (!parsed.success) {
            rejected += 1;
            continue;
        }
        const value = parsed.data;
        if (value.file !== context.path || !context.lines.has(value.line)) {
            rejected += 1;
            continue;
        }

        let endLine: number | undefined;
        if (value.endLine != null && value.endLine > value.line) {
            // Only keep a range when every line of it is visible in the diff.
            let complete = true;
            for (let line = value.line; line <= value.endLine; line += 1) {
                if (!context.lines.has(line)) complete = false;
            }
            if (complete) endLine = value.endLine;
        }

        const last = endLine ?? value.line;
        const originalCode: string[] = [];
        for (let line = value.line; line <= last; line += 1) originalCode.push(context.lines.get(line) ?? "");

        const suggestion = value.suggestion?.replace(/\n+$/, "");
        findings.push({
            id: context.makeId(),
            file: value.file,
            line: value.line,
            endLine,
            severity: value.severity,
            category: value.category.trim().toLowerCase(),
            title: value.title.trim(),
            explanation: value.explanation.trim(),
            suggestion: suggestion && suggestion !== originalCode.join("\n") ? suggestion : undefined,
            confidence: Math.round(value.confidence * 100) / 100,
            originalCode: originalCode.join("\n"),
        });
    }

    return { findings, rejected };
}
