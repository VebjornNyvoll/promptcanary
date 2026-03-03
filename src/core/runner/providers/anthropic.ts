import Anthropic from '@anthropic-ai/sdk';
import type { LLMResponse, ProviderConfig } from '../../../types/index.js';
import { ProviderError, RateLimitError, TimeoutError } from '../../../types/index.js';
import { registerProvider } from './base.js';
import type { LLMProvider } from './base.js';

const DEFAULT_MAX_TOKENS = 1024;
const MAX_ATTEMPTS = 3;

export class AnthropicProvider implements LLMProvider {
  public readonly name = 'anthropic';

  public async execute(prompt: string, config: ProviderConfig): Promise<LLMResponse> {
    const apiKey = process.env[config.api_key_env];
    if (!apiKey) {
      throw new ProviderError(
        `Missing API key in environment variable: ${config.api_key_env}`,
        this.name,
      );
    }

    const timeoutMs = config.timeout_ms;
    const client = new Anthropic({ apiKey });

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        const message = await client.messages.create(
          {
            model: config.model,
            max_tokens: config.max_tokens ?? DEFAULT_MAX_TOKENS,
            temperature: config.temperature,
            messages: [{ role: 'user', content: prompt }],
          },
          {
            signal: controller.signal,
          },
        );

        let content = '';
        for (const entry of message.content) {
          if (entry.type === 'text') {
            content = entry.text;
            break;
          }
        }

        return {
          content,
          model: message.model,
          provider: this.name,
          latency_ms: Date.now() - startedAt,
          token_usage: {
            prompt: message.usage.input_tokens,
            completion: message.usage.output_tokens,
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
            `Anthropic request failed after ${String(MAX_ATTEMPTS)} attempts: ${getErrorMessage(error)}`,
            this.name,
            toError(error),
          );
        }

        await delay(2 ** (attempt - 1) * 1000);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new ProviderError('Anthropic request failed', this.name);
  }
}

registerProvider('anthropic', new AnthropicProvider());

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
