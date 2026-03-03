import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConfig } from '../../../../src/types/index.js';
import { ProviderError, RateLimitError, TimeoutError } from '../../../../src/types/index.js';
import { GoogleProvider } from '../../../../src/core/runner/providers/google.js';

const { generateContentMock, googleConstructorMock } = vi.hoisted(() => {
  const generateContentMock = vi.fn();
  const googleConstructorMock = vi.fn(function GoogleGenAIMock() {
    return { models: { generateContent: generateContentMock } };
  });

  return { generateContentMock, googleConstructorMock };
});

vi.mock('@google/genai', () => ({ GoogleGenAI: googleConstructorMock }));

const config: ProviderConfig = {
  name: 'google',
  model: 'gemini-2.0-flash',
  api_key_env: 'GOOGLE_TEST_KEY',
  timeout_ms: 30000,
};

describe('GoogleProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_TEST_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.GOOGLE_TEST_KEY;
    vi.useRealTimers();
  });

  it('executes prompt and returns normalized response', async () => {
    generateContentMock.mockResolvedValue({
      text: 'google answer',
      modelVersion: 'gemini-2.0-flash',
      usageMetadata: {
        promptTokenCount: 9,
        candidatesTokenCount: 14,
      },
    });

    const provider = new GoogleProvider();
    const result = await provider.execute('Hello', config);

    expect(googleConstructorMock).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(generateContentMock).toHaveBeenCalledWith({
      model: 'gemini-2.0-flash',
      contents: 'Hello',
      config: {
        temperature: undefined,
        maxOutputTokens: undefined,
      },
    });
    expect(result.content).toBe('google answer');
    expect(result.model).toBe('gemini-2.0-flash');
    expect(result.provider).toBe('google');
    expect(result.token_usage).toEqual({ prompt: 9, completion: 14 });
  });

  it('throws ProviderError when API key is missing', async () => {
    delete process.env.GOOGLE_TEST_KEY;
    const provider = new GoogleProvider();

    await expect(provider.execute('Hello', config)).rejects.toBeInstanceOf(ProviderError);
  });

  it('throws RateLimitError on 429 responses', async () => {
    generateContentMock.mockRejectedValue({ status: 429 });
    const provider = new GoogleProvider();

    await expect(provider.execute('Hello', config)).rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws TimeoutError when request exceeds timeout', async () => {
    vi.useFakeTimers();
    generateContentMock.mockImplementation(() => new Promise(() => undefined));

    const provider = new GoogleProvider();
    const pending = provider.execute('Hello', { ...config, timeout_ms: 10 });
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });
});
