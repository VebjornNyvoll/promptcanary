import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertions } from '../../src/testing/assertions.js';
import { buildFactualityPrompt } from '../../src/testing/judge/templates.js';

const { createCompletionMock } = vi.hoisted(() => {
  const createCompletionMock = vi.fn();
  return { createCompletionMock };
});

vi.mock('openai', () => ({
  default: vi.fn(function OpenAIMock() {
    return {
      chat: { completions: { create: createCompletionMock } },
    };
  }),
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

function mockJudgeResponse(score: number, pass: boolean, reason: string): void {
  createCompletionMock.mockResolvedValue({
    model: 'gpt-4o-mini',
    choices: [{ message: { content: JSON.stringify({ score, pass, reason }) } }],
    usage: { prompt_tokens: 50, completion_tokens: 20 },
  });
}

describe('assertions.factuality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  it('returns JudgeResult for factually consistent submission (category C)', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(1.0, true, '(C) The submission contains all the same details');

    const result = await assertions.factuality('The company was founded in 2019 by Jane Smith.', {
      input: 'When was the company founded?',
      expected: 'The company was founded in 2019 by Jane Smith.',
    });

    expect(result).toEqual({
      score: 1.0,
      pass: true,
      reason: '(C) The submission contains all the same details',
    });
  });

  it('returns low score for factual disagreement (category D)', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.0, false, '(D) Disagreement: submission says 2020, expert says 2019');

    const result = await assertions.factuality('The company was founded in 2020.', {
      input: 'When was the company founded?',
      expected: 'The company was founded in 2019 by Jane Smith.',
    });

    expect(result.score).toBe(0.0);
    expect(result.pass).toBe(false);
  });

  it('sends input, expected, and content to the judge', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.6, true, '(B) Superset');

    await assertions.factuality('Founded in 2019 by Jane Smith, based in NYC.', {
      input: 'When was the company founded?',
      expected: 'Founded in 2019 by Jane Smith.',
    });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    const messages = callArgs.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain('When was the company founded?');
    expect(messages[0].content).toContain('Founded in 2019 by Jane Smith.');
    expect(messages[0].content).toContain('Founded in 2019 by Jane Smith, based in NYC.');
  });

  it('passes judge options through', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(1.0, true, 'Same');

    await assertions.factuality('content', {
      input: 'question',
      expected: 'answer',
      judge: { model: 'gpt-4o' },
    });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.model).toBe('gpt-4o');
  });

  it('propagates provider errors', async () => {
    await expect(assertions.factuality('content', { input: 'q', expected: 'a' })).rejects.toThrow(
      'Missing API key',
    );
  });
});

describe('buildFactualityPrompt', () => {
  it('includes question, expert answer, and submission', () => {
    const prompt = buildFactualityPrompt('submission text', 'the question', 'expert answer');
    expect(prompt).toContain('submission text');
    expect(prompt).toContain('the question');
    expect(prompt).toContain('expert answer');
  });

  it('includes the 5-way classification categories', () => {
    const prompt = buildFactualityPrompt('s', 'q', 'e');
    expect(prompt).toContain('(A)');
    expect(prompt).toContain('(B)');
    expect(prompt).toContain('(C)');
    expect(prompt).toContain('(D)');
    expect(prompt).toContain('(E)');
  });

  it('includes scoring rules for each category', () => {
    const prompt = buildFactualityPrompt('s', 'q', 'e');
    expect(prompt).toContain('score 0.4');
    expect(prompt).toContain('score 0.6');
    expect(prompt).toContain('score 1.0');
    expect(prompt).toContain('score 0.0');
  });
});
