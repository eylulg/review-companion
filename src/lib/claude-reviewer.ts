import Anthropic from '@anthropic-ai/sdk';
import { ReviewError } from './errors';
import { findingsJsonSchema } from './finding-schema';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt';
import type { ChunkReviewer, Effort, Usage } from './types';

const MAX_OUTPUT_TOKENS_PER_CHUNK = 32_000;

function usageOf(message: Anthropic.Beta.BetaMessage): Usage {
  const usage = message.usage;
  return {
    inputTokens:
      usage.input_tokens +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
  };
}

/**
 * Reviews one chunk with Claude using structured outputs, so the response is JSON matching
 * `findingsJsonSchema`. Server-side fallback is on: if the model declines for policy reasons the
 * API retries on the recommended fallback model instead of returning a refusal.
 */
export function createClaudeReviewer(
  client: Anthropic,
  effort: Effort,
  maxOutputTokens = MAX_OUTPUT_TOKENS_PER_CHUNK,
): ChunkReviewer {
  return async ({ pr, chunk, model, signal }) => {
    let message: Anthropic.Beta.BetaMessage;
    try {
      const stream = client.beta.messages.stream(
        {
          model,
          max_tokens: Math.min(MAX_OUTPUT_TOKENS_PER_CHUNK, maxOutputTokens),
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          output_config: { effort, format: { type: 'json_schema', schema: findingsJsonSchema } },
          messages: [{ role: 'user', content: buildUserPrompt(pr, chunk) }],
        },
        { signal },
      );
      message = await stream.finalMessage();
    } catch (error) {
      if (error instanceof Anthropic.APIUserAbortError) throw error;
      if (
        error instanceof Anthropic.AuthenticationError ||
        error instanceof Anthropic.PermissionDeniedError
      ) {
        throw new ReviewError(
          'model_error',
          "The server's model API key was rejected. Check the key in the server settings.",
        );
      }
      if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.NotFoundError) {
        throw new ReviewError('model_error', `The model request was rejected: ${error.message}`);
      }
      if (error instanceof Anthropic.RateLimitError) {
        return {
          raw: { findings: [] },
          usage: { inputTokens: 0, outputTokens: 0 },
          warning: `Skipped ${chunk.path}: the model is rate limited right now.`,
        };
      }
      if (error instanceof Anthropic.APIError) {
        return {
          raw: { findings: [] },
          usage: { inputTokens: 0, outputTokens: 0 },
          warning: `Skipped ${chunk.path}: the model returned an error.`,
        };
      }
      throw error;
    }

    const usage = usageOf(message);
    if (message.stop_reason === 'refusal') {
      return {
        raw: { findings: [] },
        usage,
        warning: `The model declined to review ${chunk.path}.`,
      };
    }

    const text = message.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    try {
      return { raw: JSON.parse(text) as unknown, usage };
    } catch {
      const reason =
        message.stop_reason === 'max_tokens'
          ? 'the response was cut off'
          : 'the response was not valid JSON';
      return {
        raw: { findings: [] },
        usage,
        warning: `Could not read findings for ${chunk.path}: ${reason}.`,
      };
    }
  };
}
