import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertions } from '../../src/testing/assertions.js';
import { buildAnswerRelevancePrompt } from '../../src/testing/judge/templates.js';

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

describe('assertions.answerRelevance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  it('returns high score for relevant answer', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.95, true, 'The response directly addresses the password reset question');

    const result = await assertions.answerRelevance(
      'To reset your password, go to Settings > Security > Reset Password.',
      { input: 'How do I reset my password?' },
    );

    expect(result).toEqual({
      score: 0.95,
      pass: true,
      reason: 'The response directly addresses the password reset question',
    });
  });

  it('returns low score for irrelevant answer', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.1, false, 'The response discusses pricing instead of password reset');

    const result = await assertions.answerRelevance('Our pricing starts at $9.99/month.', {
      input: 'How do I reset my password?',
    });

    expect(result.score).toBe(0.1);
    expect(result.pass).toBe(false);
  });

  it('sends input and content to the judge', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.8, true, 'Relevant');

    await assertions.answerRelevance('Here is the answer', {
      input: 'What is the question?',
    });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    const messages = callArgs.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain('What is the question?');
    expect(messages[0].content).toContain('Here is the answer');
  });

  it('uses default threshold of 0.5', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.4, false, 'Partially relevant');

    const result = await assertions.answerRelevance('content', {
      input: 'question',
    });

    expect(result.pass).toBe(false);
  });

  it('respects custom threshold', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.65, false, 'Below custom threshold');

    await assertions.answerRelevance('content', {
      input: 'question',
      threshold: 0.7,
    });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    const messages = callArgs.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain('0.7');
  });

  it('passes judge options through', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.9, true, 'Great');

    await assertions.answerRelevance('content', {
      input: 'question',
      judge: { model: 'gpt-4o' },
    });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.model).toBe('gpt-4o');
  });

  it('propagates provider errors', async () => {
    await expect(assertions.answerRelevance('content', { input: 'question' })).rejects.toThrow(
      'Missing API key',
    );
  });
});

describe('buildAnswerRelevancePrompt', () => {
  it('includes question and submission', () => {
    const prompt = buildAnswerRelevancePrompt('the answer', 'the question', 0.5);
    expect(prompt).toContain('the answer');
    expect(prompt).toContain('the question');
  });

  it('includes evaluation criteria dimensions', () => {
    const prompt = buildAnswerRelevancePrompt('a', 'q', 0.5);
    expect(prompt).toContain('Directness');
    expect(prompt).toContain('Completeness');
    expect(prompt).toContain('Focus');
  });

  it('uses specified threshold', () => {
    const prompt = buildAnswerRelevancePrompt('a', 'q', 0.8);
    expect(prompt).toContain('0.8');
  });
});
