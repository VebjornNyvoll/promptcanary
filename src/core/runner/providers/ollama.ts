import OpenAI from 'openai';
import type { LLMResponse, ProviderConfig } from '../../../types/index.js';
import { ProviderError, TimeoutError } from '../../../types/index.js';
import { registerProvider } from './base.js';
import type { LLMProvider } from './base.js';

const MAX_ATTEMPTS = 3;
const DEFAULT_BASE_URL = 'http://localhost:11434/v1';

export class OllamaProvider implements LLMProvider {
  public readonly name = 'ollama';

  public async execute(prompt: string, config: ProviderConfig): Promise<LLMResponse> {
    const baseUrl = config.base_url ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL;
    const apiUrl = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;

    const timeoutMs = config.timeout_ms;
    const client = new OpenAI({
      apiKey: 'ollama',
      baseURL: apiUrl,
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

        if (attempt === MAX_ATTEMPTS) {
          throw new ProviderError(
            `Ollama request failed after ${String(MAX_ATTEMPTS)} attempts: ${getErrorMessage(error)}`,
            this.name,
            toError(error),
          );
        }

        await delay(2 ** (attempt - 1) * 1000);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new ProviderError('Ollama request failed', this.name);
  }
}

registerProvider('ollama', new OllamaProvider());

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
