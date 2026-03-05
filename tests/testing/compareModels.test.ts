import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compareModels } from '../../src/testing/compareModels.js';

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

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function AnthropicMock() {
    return { messages: { create: vi.fn() } };
  }),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function GoogleGenAIMock() {
    return { models: { generateContent: vi.fn() } };
  }),
}));

function mockResponse(content: string) {
  return {
    model: 'gpt-4o-mini',
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 5, completion_tokens: 10 },
  };
}

describe('compareModels', () => {
  const baseOptions = {
    models: [
      { provider: 'openai' as const, model: 'gpt-4o-mini' },
      { provider: 'openai' as const, model: 'gpt-4o' },
    ],
    messages: [{ role: 'user' as const, content: 'What is the refund policy?' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  it('throws when fewer than 2 models are provided', async () => {
    await expect(
      compareModels({
        models: [{ provider: 'openai', model: 'gpt-4o-mini' }],
        messages: baseOptions.messages,
      }),
    ).rejects.toThrow('compareModels requires at least 2 models');
  });

  it('returns results for each model without assertions', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('baseline response'))
      .mockResolvedValueOnce(mockResponse('candidate response'));

    const result = await compareModels(baseOptions);

    expect(result.results).toHaveLength(2);
    expect(result.baselineModel).toBe('gpt-4o-mini');
    expect(result.regressions).toHaveLength(0);
    expect(result.results[0].response.content).toBe('baseline response');
    expect(result.results[1].response.content).toBe('candidate response');
  });

  it('marks all models as passed when no assertions provided', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('a'))
      .mockResolvedValueOnce(mockResponse('b'));

    const result = await compareModels(baseOptions);

    expect(result.results[0].passed).toBe(true);
    expect(result.results[1].passed).toBe(true);
    expect(result.results[0].results).toHaveLength(0);
    expect(result.results[1].results).toHaveLength(0);
  });

  it('runs assertions on each model response', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('Refund within 30 days'))
      .mockResolvedValueOnce(mockResponse('Refund within 30 days'));

    const result = await compareModels(baseOptions, [
      { type: 'contains', value: 'refund' },
      { type: 'contains', value: '30 days' },
    ]);

    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].results).toHaveLength(2);
    expect(result.results[1].passed).toBe(true);
    expect(result.results[1].results).toHaveLength(2);
    expect(result.regressions).toHaveLength(0);
  });

  it('detects regressions when candidate fails assertions that baseline passed', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('Refund within 30 days'))
      .mockResolvedValueOnce(mockResponse('No information available'));

    const result = await compareModels(baseOptions, [
      { type: 'contains', value: 'refund' },
      { type: 'contains', value: '30 days' },
    ]);

    expect(result.results[0].passed).toBe(true);
    expect(result.results[1].passed).toBe(false);
    expect(result.regressions).toHaveLength(2);
    expect(result.results[1].regressions).toHaveLength(2);
    expect(result.regressions[0]).toContain('gpt-4o');
    expect(result.regressions[0]).toContain('gpt-4o-mini');
  });

  it('does not flag regression when both baseline and candidate fail', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('no match'))
      .mockResolvedValueOnce(mockResponse('also no match'));

    const result = await compareModels(baseOptions, [{ type: 'contains', value: 'refund' }]);

    expect(result.results[0].passed).toBe(false);
    expect(result.results[1].passed).toBe(false);
    expect(result.regressions).toHaveLength(0);
  });

  it('does not flag regression when candidate passes but baseline fails', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('no match'))
      .mockResolvedValueOnce(mockResponse('refund available'));

    const result = await compareModels(baseOptions, [{ type: 'contains', value: 'refund' }]);

    expect(result.results[0].passed).toBe(false);
    expect(result.results[1].passed).toBe(true);
    expect(result.regressions).toHaveLength(0);
  });

  it('supports more than 2 models', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('Refund in 30 days'))
      .mockResolvedValueOnce(mockResponse('No info'))
      .mockResolvedValueOnce(mockResponse('Refund policy applies'));

    const result = await compareModels(
      {
        ...baseOptions,
        models: [
          { provider: 'openai', model: 'gpt-4o-mini' },
          { provider: 'openai', model: 'gpt-4o' },
          { provider: 'openai', model: 'gpt-3.5-turbo' },
        ],
      },
      [{ type: 'contains', value: 'refund' }],
    );

    expect(result.results).toHaveLength(3);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[1].passed).toBe(false);
    expect(result.results[1].regressions).toHaveLength(1);
    expect(result.results[2].passed).toBe(true);
    expect(result.results[2].regressions).toHaveLength(0);
    expect(result.regressions).toHaveLength(1);
  });

  it('runs all model requests concurrently', async () => {
    let concurrentCalls = 0;
    let maxConcurrent = 0;

    createCompletionMock.mockImplementation(() => {
      concurrentCalls += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
      return new Promise((resolve) => {
        setTimeout(() => {
          concurrentCalls -= 1;
          resolve(mockResponse('ok'));
        }, 10);
      });
    });

    await compareModels(baseOptions);

    expect(maxConcurrent).toBeGreaterThan(1);
  });

  it('preserves model and provider info in results', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('a'))
      .mockResolvedValueOnce(mockResponse('b'));

    const result = await compareModels(baseOptions);

    expect(result.results[0].model).toBe('gpt-4o-mini');
    expect(result.results[0].provider).toBe('openai');
    expect(result.results[1].model).toBe('gpt-4o');
    expect(result.results[1].provider).toBe('openai');
  });

  it('passes through temperature and maxTokens options', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('a'))
      .mockResolvedValueOnce(mockResponse('b'));

    await compareModels({
      ...baseOptions,
      temperature: 0.5,
      maxTokens: 100,
    });

    expect(createCompletionMock).toHaveBeenCalledTimes(2);
    for (const call of createCompletionMock.mock.calls) {
      expect(call[0]).toMatchObject({
        temperature: 0.5,
        max_tokens: 100,
      });
    }
  });
});
