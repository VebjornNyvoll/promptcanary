import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testPrompt } from '../../src/testing/testPrompt.js';
import { ProviderError, TimeoutError } from '../../src/types/index.js';

const {
  createCompletionMock,
  openAIConstructorMock,
  createMessageMock,
  anthropicConstructorMock,
  generateContentMock,
  googleConstructorMock,
} = vi.hoisted(() => {
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

  const createMessageMock = vi.fn();
  const anthropicConstructorMock = vi.fn(function AnthropicMock() {
    return {
      messages: {
        create: createMessageMock,
      },
    };
  });

  const generateContentMock = vi.fn();
  const googleConstructorMock = vi.fn(function GoogleGenAIMock() {
    return {
      models: {
        generateContent: generateContentMock,
      },
    };
  });

  return {
    createCompletionMock,
    openAIConstructorMock,
    createMessageMock,
    anthropicConstructorMock,
    generateContentMock,
    googleConstructorMock,
  };
});

vi.mock('openai', () => ({
  default: openAIConstructorMock,
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: anthropicConstructorMock,
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: googleConstructorMock,
}));

describe('testPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    vi.useRealTimers();
  });

  it('executes OpenAI prompt and returns typed camelCase result', async () => {
    process.env.OPENAI_API_KEY = 'openai-env-key';
    createCompletionMock.mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [{ message: { content: 'openai answer' } }],
      usage: { prompt_tokens: 5, completion_tokens: 9 },
    });

    const result = await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are concise' },
        { role: 'user', content: 'first user' },
        { role: 'assistant', content: 'assistant message' },
        { role: 'user', content: 'last user prompt' },
      ],
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith({ apiKey: 'openai-env-key' });
    expect(createCompletionMock).toHaveBeenCalledTimes(1);
    expect(createCompletionMock.mock.calls[0][0]).toMatchObject({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'last user prompt' }],
      temperature: undefined,
      max_tokens: undefined,
    });
    expect(result).toMatchObject({
      content: 'openai answer',
      model: 'gpt-4o-mini',
      provider: 'openai',
      tokenUsage: {
        prompt: 5,
        completion: 9,
      },
    });
    expect(result.latencyMs).toBeTypeOf('number');
    expect('latency_ms' in result).toBe(false);
    expect('token_usage' in result).toBe(false);
  });

  it('executes Anthropic prompt and returns typed result', async () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-env-key';
    createMessageMock.mockResolvedValue({
      model: 'claude-sonnet-4',
      content: [{ type: 'text', text: 'anthropic answer' }],
      usage: { input_tokens: 7, output_tokens: 11 },
    });

    const result = await testPrompt({
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      messages: [{ role: 'user', content: 'hello anthropic' }],
    });

    expect(anthropicConstructorMock).toHaveBeenCalledWith({ apiKey: 'anthropic-env-key' });
    expect(result.content).toBe('anthropic answer');
    expect(result.tokenUsage).toEqual({ prompt: 7, completion: 11 });
  });

  it('executes Google prompt and returns typed result', async () => {
    process.env.GOOGLE_API_KEY = 'google-env-key';
    generateContentMock.mockResolvedValue({
      text: 'google answer',
      modelVersion: 'gemini-2.0-flash',
      usageMetadata: {
        promptTokenCount: 9,
        candidatesTokenCount: 14,
      },
    });

    const result = await testPrompt({
      provider: 'google',
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'hello google' }],
    });

    expect(googleConstructorMock).toHaveBeenCalledWith({ apiKey: 'google-env-key' });
    expect(generateContentMock).toHaveBeenCalledWith({
      model: 'gemini-2.0-flash',
      contents: 'hello google',
      config: {
        temperature: undefined,
        maxOutputTokens: undefined,
      },
    });
    expect(result.content).toBe('google answer');
    expect(result.tokenUsage).toEqual({ prompt: 9, completion: 14 });
  });

  it('uses API key from default environment variable mapping', async () => {
    process.env.OPENAI_API_KEY = 'mapped-key';
    createCompletionMock.mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith({ apiKey: 'mapped-key' });
  });

  it('uses explicit apiKey override and restores original env value', async () => {
    process.env.OPENAI_API_KEY = 'original-env-key';
    createCompletionMock.mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    });

    await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hello' }],
      apiKey: 'override-key',
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith({ apiKey: 'override-key' });
    expect(process.env.OPENAI_API_KEY).toBe('original-env-key');
  });

  it('throws ProviderError when API key is missing', async () => {
    await expect(
      testPrompt({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it('uses default timeout of 30000ms', async () => {
    process.env.OPENAI_API_KEY = 'openai-env-key';
    vi.useFakeTimers();
    createCompletionMock.mockImplementation(
      (_payload: unknown, options?: { signal?: AbortSignal }) =>
        new Promise((_, reject: (reason?: unknown) => void) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
    );

    const pending = testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hello' }],
    });
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
  });

  it('passes custom temperature and maxTokens, and honors timeoutMs', async () => {
    process.env.OPENAI_API_KEY = 'openai-env-key';
    vi.useFakeTimers();
    createCompletionMock.mockImplementation(
      (_payload: unknown, options?: { signal?: AbortSignal }) =>
        new Promise((_, reject: (reason?: unknown) => void) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
    );

    const pending = testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.25,
      maxTokens: 77,
      timeoutMs: 10,
    });
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);

    expect(createCompletionMock.mock.calls[0][0]).toMatchObject({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.25,
      max_tokens: 77,
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });
});
