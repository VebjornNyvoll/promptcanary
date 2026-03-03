import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConfig } from '../../../../src/types/index.js';
import { ProviderError, RateLimitError, TimeoutError } from '../../../../src/types/index.js';
import { OpenAIProvider } from '../../../../src/core/runner/providers/openai.js';

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
  name: 'openai',
  model: 'gpt-4o-mini',
  api_key_env: 'OPENAI_TEST_KEY',
  timeout_ms: 30000,
};

describe('OpenAIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_TEST_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_TEST_KEY;
    vi.useRealTimers();
  });

  it('executes prompt and returns normalized response', async () => {
    createCompletionMock.mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [{ message: { content: 'mocked answer' } }],
      usage: { prompt_tokens: 12, completion_tokens: 34 },
    });

    const provider = new OpenAIProvider();
    const result = await provider.execute('Hello', config);

    expect(openAIConstructorMock).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(result.content).toBe('mocked answer');
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.provider).toBe('openai');
    expect(result.token_usage).toEqual({ prompt: 12, completion: 34 });
  });

  it('throws ProviderError when API key is missing', async () => {
    delete process.env.OPENAI_TEST_KEY;
    const provider = new OpenAIProvider();

    await expect(provider.execute('Hello', config)).rejects.toBeInstanceOf(ProviderError);
  });

  it('throws RateLimitError on 429 responses', async () => {
    createCompletionMock.mockRejectedValue({ status: 429 });
    const provider = new OpenAIProvider();

    await expect(provider.execute('Hello', config)).rejects.toBeInstanceOf(RateLimitError);
  });

  it('retries transient failures with exponential backoff', async () => {
    vi.useFakeTimers();
    createCompletionMock
      .mockRejectedValueOnce(new Error('temporary-1'))
      .mockRejectedValueOnce(new Error('temporary-2'))
      .mockResolvedValueOnce({
        model: 'gpt-4o-mini',
        choices: [{ message: { content: 'recovered' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2 },
      });

    const provider = new OpenAIProvider();
    const pending = provider.execute('Hello', config);

    await vi.runAllTimersAsync();
    const result = await pending;

    expect(createCompletionMock).toHaveBeenCalledTimes(3);
    expect(result.content).toBe('recovered');
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

    const provider = new OpenAIProvider();
    const pending = provider.execute('Hello', { ...config, timeout_ms: 10 });
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });
});
