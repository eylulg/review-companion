import { z } from "zod";
import { DEFAULT_MAX_CHANGED_LINES } from "./chunking";
import { DEFAULT_MODEL, MODEL_OPTIONS } from "./models";

const positiveInt = (fallback: number) => z.coerce.number().int().positive().catch(fallback);
const optionalString = z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined);

const envSchema = z.object({
    ANTHROPIC_API_KEY: optionalString,
    GITHUB_TOKEN: optionalString,
    REVIEW_MODEL: z.enum(MODEL_OPTIONS.map((option) => option.id)).catch(DEFAULT_MODEL),
    REVIEW_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).catch("high"),
    MAX_CHANGED_LINES: positiveInt(DEFAULT_MAX_CHANGED_LINES),
    MAX_INPUT_TOKENS: positiveInt(120_000),
    MAX_OUTPUT_TOKENS: positiveInt(40_000),
    RATE_LIMIT_REVIEWS: positiveInt(5),
    RATE_LIMIT_WINDOW_SECONDS: positiveInt(600),
});

/** Server-side configuration, validated from the environment on every request so tests can change it. */
export function serverConfig() {
    const env = envSchema.parse(process.env);
    return {
        apiKey: env.ANTHROPIC_API_KEY,
        githubToken: env.GITHUB_TOKEN,
        defaultModel: env.REVIEW_MODEL,
        effort: env.REVIEW_EFFORT,
        maxChangedLines: env.MAX_CHANGED_LINES,
        maxInputTokens: env.MAX_INPUT_TOKENS,
        maxOutputTokens: env.MAX_OUTPUT_TOKENS,
        rateLimitPerWindow: env.RATE_LIMIT_REVIEWS,
        rateLimitWindowMs: env.RATE_LIMIT_WINDOW_SECONDS * 1000,
    };
}
