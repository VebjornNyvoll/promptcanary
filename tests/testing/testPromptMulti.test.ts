import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testPromptMulti } from '../../src/testing/testPrompt.js';

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

describe('testPromptMulti', () => {
  const baseOptions = {
    provider: 'openai' as const,
    model: 'gpt-4o-mini',
    messages: [{ role: 'user' as const, content: 'test prompt' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  it('runs prompt N times and returns all responses', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('response 1'))
      .mockResolvedValueOnce(mockResponse('response 2'))
      .mockResolvedValueOnce(mockResponse('response 3'));

    const result = await testPromptMulti({ ...baseOptions, runs: 3 });

    expect(createCompletionMock).toHaveBeenCalledTimes(3);
    expect(result.responses).toHaveLength(3);
    expect(result.totalRuns).toBe(3);
  });

  it('passes when no assertions provided (all runs pass by default)', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('a'))
      .mockResolvedValueOnce(mockResponse('b'));

    const result = await testPromptMulti({ ...baseOptions, runs: 2 });

    expect(result.passed).toBe(true);
    expect(result.passRate).toBe(1.0);
    expect(result.passedRuns).toBe(2);
  });

  it('evaluates assertions on each run and computes pass rate', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('I offer a refund within 30 days'))
      .mockResolvedValueOnce(mockResponse('No refund policy available'))
      .mockResolvedValueOnce(mockResponse('Our refund policy covers 30 days'))
      .mockResolvedValueOnce(mockResponse('Contact support for details'))
      .mockResolvedValueOnce(mockResponse('Refund available within 30 days'));

    const result = await testPromptMulti(
      { ...baseOptions, runs: 5 },
      [{ type: 'contains', value: 'refund' }],
      0.6,
    );

    expect(result.totalRuns).toBe(5);
    expect(result.passedRuns).toBe(4);
    expect(result.passRate).toBe(0.8);
    expect(result.passed).toBe(true);
  });

  it('fails when pass rate is below threshold', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('hello'))
      .mockResolvedValueOnce(mockResponse('world'))
      .mockResolvedValueOnce(mockResponse('hello refund'));

    const result = await testPromptMulti(
      { ...baseOptions, runs: 3 },
      [{ type: 'contains', value: 'refund' }],
      0.8,
    );

    expect(result.passedRuns).toBe(1);
    expect(result.passRate).toBeCloseTo(0.333, 2);
    expect(result.passed).toBe(false);
  });

  it('defaults to 100% pass rate when passRate not specified', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('refund ok'))
      .mockResolvedValueOnce(mockResponse('no match'));

    const result = await testPromptMulti({ ...baseOptions, runs: 2 }, [
      { type: 'contains', value: 'refund' },
    ]);

    expect(result.passed).toBe(false);
    expect(result.passRate).toBe(0.5);
  });

  it('includes individual assertion results per run', async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockResponse('refund within 30 days'))
      .mockResolvedValueOnce(mockResponse('no info'));

    const result = await testPromptMulti(
      { ...baseOptions, runs: 2 },
      [
        { type: 'contains', value: 'refund' },
        { type: 'contains', value: '30 days' },
      ],
      0.5,
    );

    expect(result.assertionResults).toHaveLength(2);
    expect(result.assertionResults[0].passed).toBe(true);
    expect(result.assertionResults[0].results).toHaveLength(2);
    expect(result.assertionResults[1].passed).toBe(false);
  });

  it('throws when runs is less than 1', async () => {
    await expect(testPromptMulti({ ...baseOptions, runs: 0 })).rejects.toThrow(
      'runs must be at least 1',
    );
  });

  it('works with a single run', async () => {
    createCompletionMock.mockResolvedValueOnce(mockResponse('single response'));

    const result = await testPromptMulti({ ...baseOptions, runs: 1 }, [
      { type: 'contains', value: 'single' },
    ]);

    expect(result.passed).toBe(true);
    expect(result.totalRuns).toBe(1);
    expect(result.passRate).toBe(1.0);
  });

  it('runs all prompts concurrently', async () => {
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

    await testPromptMulti({ ...baseOptions, runs: 3 });

    expect(maxConcurrent).toBeGreaterThan(1);
  });
});
