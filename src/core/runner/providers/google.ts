import { GoogleGenAI } from '@google/genai';
import type { LLMResponse, ProviderConfig } from '../../../types/index.js';
import { ProviderError, RateLimitError, TimeoutError } from '../../../types/index.js';
import { registerProvider } from './base.js';
import type { LLMProvider } from './base.js';

const MAX_ATTEMPTS = 3;

export class GoogleProvider implements LLMProvider {
  public readonly name = 'google';

  public async execute(prompt: string, config: ProviderConfig): Promise<LLMResponse> {
    const apiKey = process.env[config.api_key_env];
    if (!apiKey) {
      throw new ProviderError(
        `Missing API key in environment variable: ${config.api_key_env}`,
        this.name,
      );
    }

    const timeoutMs = config.timeout_ms;
    const client = new GoogleGenAI({ apiKey });

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        const response = await Promise.race([
          client.models.generateContent({
            model: config.model,
            contents: prompt,
            config: {
              temperature: config.temperature,
              maxOutputTokens: config.max_tokens,
            },
          }),
          new Promise<never>((_, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error('timeout'));
            }, timeoutMs);

            controller.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timeoutId);
                reject(new Error('timeout'));
              },
              { once: true },
            );
          }),
        ]);

        return {
          content: response.text ?? '',
          model: response.modelVersion ?? config.model,
          provider: this.name,
          latency_ms: Date.now() - startedAt,
          token_usage: {
            prompt: response.usageMetadata?.promptTokenCount ?? 0,
            completion: response.usageMetadata?.candidatesTokenCount ?? 0,
          },
          timestamp: new Date(),
        };
      } catch (error: unknown) {
        if (controller.signal.aborted || getErrorMessage(error).toLowerCase().includes('timeout')) {
          throw new TimeoutError(this.name, timeoutMs);
        }

        if (hasStatus(error, 429)) {
          throw new RateLimitError(this.name, extractRetryAfterMs(error));
        }

        if (attempt === MAX_ATTEMPTS) {
          throw new ProviderError(
            `Google request failed after ${String(MAX_ATTEMPTS)} attempts: ${getErrorMessage(error)}`,
            this.name,
            toError(error),
          );
        }

        await delay(2 ** (attempt - 1) * 1000);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new ProviderError('Google request failed', this.name);
  }
}

registerProvider('google', new GoogleProvider());

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

  if ('code' in error && typeof error.code === 'number') {
    return error.code === statusCode;
  }

  return false;
}

function extractRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  if ('headers' in error && error.headers && typeof error.headers === 'object') {
    const headers = error.headers as { get?: (name: string) => string | null } & Record<
      string,
      unknown
    >;
    const retryAfter =
      typeof headers.get === 'function'
        ? (headers.get('retry-after') ?? undefined)
        : headers['retry-after'];

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
