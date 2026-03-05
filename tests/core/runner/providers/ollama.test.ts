import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConfig } from '../../../../src/types/index.js';
import { ProviderError, TimeoutError } from '../../../../src/types/index.js';
import { OllamaProvider } from '../../../../src/core/runner/providers/ollama.js';

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
  name: 'ollama',
  model: 'llama3.2',
  api_key_env: 'OLLAMA_BASE_URL',
  timeout_ms: 30000,
};

describe('OllamaProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'OLLAMA_BASE_URL');
    vi.useRealTimers();
  });

  it('executes prompt and returns normalized response', async () => {
    createCompletionMock.mockResolvedValue({
      model: 'llama3.2',
      choices: [{ message: { content: 'local model answer' } }],
      usage: { prompt_tokens: 8, completion_tokens: 16 },
    });

    const provider = new OllamaProvider();
    const result = await provider.execute('Hello', config);

    expect(openAIConstructorMock).toHaveBeenCalledWith({
      apiKey: 'ollama',
      baseURL: 'http://localhost:11434/v1',
    });
    expect(result.content).toBe('local model answer');
    expect(result.model).toBe('llama3.2');
    expect(result.provider).toBe('ollama');
    expect(result.token_usage).toEqual({ prompt: 8, completion: 16 });
  });

  it('uses default base URL when none is provided', async () => {
    createCompletionMock.mockResolvedValue({
      model: 'llama3.2',
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    });

    const provider = new OllamaProvider();
    await provider.execute('Hello', config);

    expect(openAIConstructorMock).toHaveBeenCalledWith({
      apiKey: 'ollama',
      baseURL: 'http://localhost:11434/v1',
    });
  });

  it('uses OLLAMA_BASE_URL environment variable when set', async () => {
    process.env.OLLAMA_BASE_URL = 'http://remote-host:11434';
    createCompletionMock.mockResolvedValue({
      model: 'llama3.2',
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    });

    const provider = new OllamaProvider();
    await provider.execute('Hello', config);

    expect(openAIConstructorMock).toHaveBeenCalledWith({
      apiKey: 'ollama',
      baseURL: 'http://remote-host:11434/v1',
    });
  });

  it('uses base_url from config when provided', async () => {
    createCompletionMock.mockResolvedValue({
      model: 'llama3.2',
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    });

    const provider = new OllamaProvider();
    await provider.execute('Hello', {
      ...config,
      base_url: 'http://custom-host:11434',
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith({
      apiKey: 'ollama',
      baseURL: 'http://custom-host:11434/v1',
    });
  });

  it('does not append /v1 when base_url already ends with /v1', async () => {
    createCompletionMock.mockResolvedValue({
      model: 'llama3.2',
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    });

    const provider = new OllamaProvider();
    await provider.execute('Hello', {
      ...config,
      base_url: 'http://custom-host:11434/v1',
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith({
      apiKey: 'ollama',
      baseURL: 'http://custom-host:11434/v1',
    });
  });

  it('does not require an API key', async () => {
    createCompletionMock.mockResolvedValue({
      model: 'llama3.2',
      choices: [{ message: { content: 'no key needed' } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    });

    const provider = new OllamaProvider();
    const result = await provider.execute('Hello', config);

    expect(result.content).toBe('no key needed');
    expect(openAIConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'ollama' }),
    );
  });

  it('retries transient failures with exponential backoff', async () => {
    vi.useFakeTimers();
    createCompletionMock
      .mockRejectedValueOnce(new Error('temporary-1'))
      .mockRejectedValueOnce(new Error('temporary-2'))
      .mockResolvedValueOnce({
        model: 'llama3.2',
        choices: [{ message: { content: 'recovered' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2 },
      });

    const provider = new OllamaProvider();
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

    const provider = new OllamaProvider();
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

    const provider = new OllamaProvider();
    const pending = provider.execute('Hello', { ...config, timeout_ms: 10 });
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });

  it('handles empty completion content gracefully', async () => {
    createCompletionMock.mockResolvedValue({
      model: 'llama3.2',
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 1, completion_tokens: 0 },
    });

    const provider = new OllamaProvider();
    const result = await provider.execute('Hello', config);

    expect(result.content).toBe('');
  });

  it('handles missing usage data gracefully', async () => {
    createCompletionMock.mockResolvedValue({
      model: 'llama3.2',
      choices: [{ message: { content: 'ok' } }],
      usage: null,
    });

    const provider = new OllamaProvider();
    const result = await provider.execute('Hello', config);

    expect(result.token_usage).toEqual({ prompt: 0, completion: 0 });
  });

  it('config base_url takes precedence over env var', async () => {
    process.env.OLLAMA_BASE_URL = 'http://env-host:11434';
    createCompletionMock.mockResolvedValue({
      model: 'llama3.2',
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    });

    const provider = new OllamaProvider();
    await provider.execute('Hello', {
      ...config,
      base_url: 'http://config-host:11434/v1',
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith({
      apiKey: 'ollama',
      baseURL: 'http://config-host:11434/v1',
    });
  });
});
