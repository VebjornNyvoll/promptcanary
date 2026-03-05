import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConfig } from '../../../../src/types/index.js';
import { ProviderError, RateLimitError, TimeoutError } from '../../../../src/types/index.js';
import { OpenAICompatibleProvider } from '../../../../src/core/runner/providers/openai-compatible.js';

const { createCompletionMock, openAIConstructorMock } = vi.hoisted(() => {
  const createCompletionMock = vi.fn();
  const openAIConstructorMock = vi.fn(function OpenAIMock() {
    return {
      chat: {
        completions: {
          create: createCompletionMock,
        },
      },
    };
  });

  return { createCompletionMock, openAIConstructorMock };
});

vi.mock('openai', () => ({
  default: openAIConstructorMock,
}));

const config: ProviderConfig = {
  name: 'openai-compatible',
  model: 'llama-3.1-70b-versatile',
  api_key_env: 'TEST_COMPATIBLE_KEY',
  timeout_ms: 30000,
  base_url: 'https://api.groq.com/openai/v1',
};

describe('OpenAICompatibleProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TEST_COMPATIBLE_KEY = 'test-groq-key';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'TEST_COMPATIBLE_KEY');
    vi.useRealTimers();
  });

  it('executes prompt with custom baseURL and apiKey', async () => {
    createCompletionMock.mockResolvedValue({
      model: 'llama-3.1-70b-versatile',
      choices: [{ message: { content: 'groq response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });

    const provider = new OpenAICompatibleProvider();
    const result = await provider.execute('Hello', config);

    expect(openAIConstructorMock).toHaveBeenCalledWith({
      apiKey: 'test-groq-key',
      baseURL: 'https://api.groq.com/openai/v1',
    });
    expect(result.content).toBe('groq response');
    expect(result.model).toBe('llama-3.1-70b-versatile');
    expect(result.provider).toBe('openai-compatible');
    expect(result.token_usage).toEqual({ prompt: 10, completion: 20 });
  });

  it('throws ProviderError when baseUrl is missing', async () => {
    const noBaseUrlConfig: ProviderConfig = {
      name: 'openai-compatible',
      model: 'some-model',
      api_key_env: 'TEST_COMPATIBLE_KEY',
      timeout_ms: 30000,
    };

    const provider = new OpenAICompatibleProvider();

    await expect(provider.execute('Hello', noBaseUrlConfig)).rejects.toThrow(
      'baseUrl is required for the openai-compatible provider',
    );
    await expect(provider.execute('Hello', noBaseUrlConfig)).rejects.toBeInstanceOf(ProviderError);
  });

  it('throws ProviderError when API key is missing', async () => {
    Reflect.deleteProperty(process.env, 'TEST_COMPATIBLE_KEY');
    const provider = new OpenAICompatibleProvider();

    await expect(provider.execute('Hello', config)).rejects.toThrow(
      'Missing API key in environment variable: TEST_COMPATIBLE_KEY',
    );
    await expect(provider.execute('Hello', config)).rejects.toBeInstanceOf(ProviderError);
  });

  it('throws RateLimitError on 429 responses', async () => {
    createCompletionMock.mockRejectedValue({ status: 429 });
    const provider = new OpenAICompatibleProvider();

    await expect(provider.execute('Hello', config)).rejects.toBeInstanceOf(RateLimitError);
  });

  it('retries transient failures with exponential backoff', async () => {
    vi.useFakeTimers();
    createCompletionMock
      .mockRejectedValueOnce(new Error('temporary-1'))
      .mockRejectedValueOnce(new Error('temporary-2'))
      .mockResolvedValueOnce({
        model: 'llama-3.1-70b-versatile',
        choices: [{ message: { content: 'recovered' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2 },
      });

    const provider = new OpenAICompatibleProvider();
    const pending = provider.execute('Hello', config);

    await vi.runAllTimersAsync();
    const result = await pending;

    expect(createCompletionMock).toHaveBeenCalledTimes(3);
    expect(result.content).toBe('recovered');
  });

  it('throws ProviderError after max retries exhausted', async () => {
    vi.useFakeTimers();
    createCompletionMock
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockRejectedValueOnce(new Error('fail-3'));

    const provider = new OpenAICompatibleProvider();
    const pending = provider.execute('Hello', config);
    const assertion = expect(pending).rejects.toBeInstanceOf(ProviderError);

    await vi.runAllTimersAsync();
    await assertion;
  });

  it('throws TimeoutError when request aborts on timeout', async () => {
    vi.useFakeTimers();
    createCompletionMock.mockImplementation(
      (_payload: unknown, options?: { signal?: AbortSignal }) =>
        new Promise((_, reject: (reason?: unknown) => void) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
    );

    const provider = new OpenAICompatibleProvider();
    const pending = provider.execute('Hello', { ...config, timeout_ms: 10 });
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });

  it('handles empty completion content gracefully', async () => {
    createCompletionMock.mockResolvedValue({
      model: 'llama-3.1-70b-versatile',
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 1, completion_tokens: 0 },
    });

    const provider = new OpenAICompatibleProvider();
    const result = await provider.execute('Hello', config);

    expect(result.content).toBe('');
  });

  it('handles missing usage data gracefully', async () => {
    createCompletionMock.mockResolvedValue({
      model: 'llama-3.1-70b-versatile',
      choices: [{ message: { content: 'ok' } }],
      usage: null,
    });

    const provider = new OpenAICompatibleProvider();
    const result = await provider.execute('Hello', config);

    expect(result.token_usage).toEqual({ prompt: 0, completion: 0 });
  });

  it('works with different OpenAI-compatible services', async () => {
    createCompletionMock.mockResolvedValue({
      model: 'deepseek-chat',
      choices: [{ message: { content: 'deepseek response' } }],
      usage: { prompt_tokens: 5, completion_tokens: 10 },
    });

    const deepseekConfig: ProviderConfig = {
      ...config,
      model: 'deepseek-chat',
      base_url: 'https://api.deepseek.com/v1',
    };

    const provider = new OpenAICompatibleProvider();
    const result = await provider.execute('Hello', deepseekConfig);

    expect(openAIConstructorMock).toHaveBeenCalledWith({
      apiKey: 'test-groq-key',
      baseURL: 'https://api.deepseek.com/v1',
    });
    expect(result.model).toBe('deepseek-chat');
    expect(result.content).toBe('deepseek response');
  });

  it('extracts retry-after header from rate limit errors', async () => {
    createCompletionMock.mockRejectedValue({
      status: 429,
      headers: { 'retry-after': '30' },
    });

    const provider = new OpenAICompatibleProvider();

    try {
      await provider.execute('Hello', config);
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).retry_after_ms).toBe(30000);
    }
  });
});
