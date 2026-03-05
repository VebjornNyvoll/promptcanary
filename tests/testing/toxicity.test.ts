import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertions } from '../../src/testing/assertions.js';
import { buildToxicityPrompt } from '../../src/testing/judge/templates.js';

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

describe('assertions.toxicity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  it('returns low score and pass for safe content', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.05, true, 'No toxic content detected');

    const result = await assertions.toxicity(
      'Thank you for your question! Here is how to reset your password.',
    );

    expect(result).toEqual({
      score: 0.05,
      pass: true,
      reason: 'No toxic content detected',
    });
  });

  it('returns high score and fail for toxic content', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.9, false, 'Contains hate speech and threatening language');

    const result = await assertions.toxicity('some harmful content here');

    expect(result.score).toBe(0.9);
    expect(result.pass).toBe(false);
  });

  it('uses default threshold of 0.5', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.6, false, 'Moderately toxic');

    const result = await assertions.toxicity('mildly inappropriate content');

    expect(result.pass).toBe(false);
  });

  it('respects custom threshold', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.2, true, 'Mildly inappropriate but below threshold');

    await assertions.toxicity('slightly edgy content', { threshold: 0.3 });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    const messages = callArgs.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain('0.3');
  });

  it('works without options (all defaults)', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.1, true, 'Safe content');

    const result = await assertions.toxicity('Hello, how are you?');

    expect(result.pass).toBe(true);
  });

  it('sends content to the judge', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.0, true, 'Safe');

    await assertions.toxicity('This is my test content');

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    const messages = callArgs.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain('This is my test content');
  });

  it('passes judge options through', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.0, true, 'Safe');

    await assertions.toxicity('content', { judge: { model: 'gpt-4o' } });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.model).toBe('gpt-4o');
  });

  it('propagates provider errors', async () => {
    await expect(assertions.toxicity('content')).rejects.toThrow('Missing API key');
  });
});

describe('buildToxicityPrompt', () => {
  it('includes content to evaluate', () => {
    const prompt = buildToxicityPrompt('test content', 0.5);
    expect(prompt).toContain('test content');
  });

  it('lists toxicity categories', () => {
    const prompt = buildToxicityPrompt('test', 0.5);
    expect(prompt).toContain('Hate speech');
    expect(prompt).toContain('Profanity');
    expect(prompt).toContain('Threats');
  });

  it('uses inverted pass logic (lower = better)', () => {
    const prompt = buildToxicityPrompt('test', 0.3);
    expect(prompt).toContain('<= 0.3');
  });

  it('includes toxicity scale', () => {
    const prompt = buildToxicityPrompt('test', 0.5);
    expect(prompt).toContain('0.0 = Completely appropriate');
    expect(prompt).toContain('1.0 = Severely toxic');
  });
});
