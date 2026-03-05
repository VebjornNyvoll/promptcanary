import OpenAI from 'openai';
import type { LLMResponse, ProviderConfig } from '../../../types/index.js';
import { ProviderError, RateLimitError, TimeoutError } from '../../../types/index.js';
import { registerProvider } from './base.js';
import type { LLMProvider } from './base.js';

const MAX_ATTEMPTS = 3;

export class OpenAICompatibleProvider implements LLMProvider {
  public readonly name = 'openai-compatible';

  public async execute(prompt: string, config: ProviderConfig): Promise<LLMResponse> {
    if (!config.base_url) {
      throw new ProviderError('baseUrl is required for the openai-compatible provider', this.name);
    }

    const apiKey = process.env[config.api_key_env];
    if (!apiKey) {
      throw new ProviderError(
        `Missing API key in environment variable: ${config.api_key_env}`,
        this.name,
      );
    }

    const timeoutMs = config.timeout_ms;
    const client = new OpenAI({
      apiKey,
      baseURL: config.base_url,
    });

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        const completion = await client.chat.completions.create(
          {
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: config.temperature,
            max_tokens: config.max_tokens,
          },
          {
            signal: controller.signal,
          },
        );

        const content = completion.choices[0]?.message?.content ?? '';
        const usage = completion.usage;

        return {
          content,
          model: completion.model,
          provider: this.name,
          latency_ms: Date.now() - startedAt,
          token_usage: {
            prompt: usage?.prompt_tokens ?? 0,
            completion: usage?.completion_tokens ?? 0,
          },
          timestamp: new Date(),
        };
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          throw new TimeoutError(this.name, timeoutMs);
        }

        if (hasStatus(error, 429)) {
          throw new RateLimitError(this.name, extractRetryAfterMs(error));
        }

        if (attempt === MAX_ATTEMPTS) {
          throw new ProviderError(
            `OpenAI-compatible request failed after ${String(MAX_ATTEMPTS)} attempts: ${getErrorMessage(error)}`,
            this.name,
            toError(error),
          );
        }

        await delay(2 ** (attempt - 1) * 1000);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new ProviderError('OpenAI-compatible request failed', this.name);
  }
}

registerProvider('openai-compatible', new OpenAICompatibleProvider());

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hasStatus(error: unknown, statusCode: number): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status === statusCode;
  }

  return false;
}

function extractRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  if ('headers' in error && error.headers && typeof error.headers === 'object') {
    const headers = error.headers as Record<string, unknown>;
    const retryAfter = headers['retry-after'];
    if (typeof retryAfter === 'string') {
      const seconds = Number.parseInt(retryAfter, 10);
      if (!Number.isNaN(seconds)) {
        return seconds * 1000;
      }
    }
  }

  return undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function toError(error: unknown): Error | undefined {
  return error instanceof Error ? error : undefined;
}
