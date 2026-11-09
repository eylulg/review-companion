interface ModelOption {
    id: string;
    label: string;
    description: string;
}

export const DEFAULT_MODEL = "claude-opus-5-5";
const CHEAPER_MODEL = "claude-sonnet-5-5";

export const MODEL_OPTIONS: ModelOption[] = [
    { id: DEFAULT_MODEL, label: "Claude Opus 5.5", description: "Most thorough review" },
    { id: CHEAPER_MODEL, label: "Claude Sonnet 5.5", description: "Faster and about half the cost" },
];

/** Price per million tokens in US dollars, used for the cost estimate shown in the UI. */
const DEFAULT_PRICE = { input: 4, output: 20 };
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    [DEFAULT_MODEL]: DEFAULT_PRICE,
    [CHEAPER_MODEL]: { input: 2, output: 10 },
};

export function isKnownModel(id: string): boolean {
    return MODEL_OPTIONS.some((option) => option.id === id);
}

export function modelLabel(id: string): string {
    return MODEL_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
    const price = MODEL_PRICING[model] ?? DEFAULT_PRICE;
    return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
