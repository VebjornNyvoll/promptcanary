import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConfig } from '../../../../src/types/index.js';
import { ProviderError, RateLimitError } from '../../../../src/types/index.js';
import { AnthropicProvider } from '../../../../src/core/runner/providers/anthropic.js';

const { createMessageMock, anthropicConstructorMock } = vi.hoisted(() => {
  const createMessageMock = vi.fn();
  const anthropicConstructorMock = vi.fn(function AnthropicMock() {
    return {
      messages: {
        create: createMessageMock,
      },
    };
  });

  return { createMessageMock, anthropicConstructorMock };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: anthropicConstructorMock,
}));

const config: ProviderConfig = {
  name: 'anthropic',
  model: 'claude-sonnet-4',
  api_key_env: 'ANTHROPIC_TEST_KEY',
  timeout_ms: 30000,
};

describe('AnthropicProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_TEST_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_TEST_KEY;
  });

  it('executes prompt and returns normalized response', async () => {
    createMessageMock.mockResolvedValue({
      model: 'claude-sonnet-4',
      content: [{ type: 'text', text: 'anthropic answer' }],
      usage: { input_tokens: 7, output_tokens: 11 },
    });

    const provider = new AnthropicProvider();
    const result = await provider.execute('Hello', config);

    expect(anthropicConstructorMock).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(result.content).toBe('anthropic answer');
    expect(result.model).toBe('claude-sonnet-4');
    expect(result.provider).toBe('anthropic');
    expect(result.token_usage).toEqual({ prompt: 7, completion: 11 });
  });

  it('throws ProviderError when API key is missing', async () => {
    delete process.env.ANTHROPIC_TEST_KEY;
    const provider = new AnthropicProvider();

    await expect(provider.execute('Hello', config)).rejects.toBeInstanceOf(ProviderError);
  });

  it('throws RateLimitError on 429 responses', async () => {
    createMessageMock.mockRejectedValue({ status: 429 });
    const provider = new AnthropicProvider();

    await expect(provider.execute('Hello', config)).rejects.toBeInstanceOf(RateLimitError);
  });
});
