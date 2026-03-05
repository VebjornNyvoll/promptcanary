import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertions } from '../../src/testing/assertions.js';
import { buildFaithfulnessPrompt } from '../../src/testing/judge/templates.js';

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

describe('assertions.faithfulness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  it('returns high score when output is faithful to context', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(1.0, true, 'All claims are supported by the context');

    const result = await assertions.faithfulness(
      'Returns are accepted within 30 days. Items must be unused.',
      {
        context: 'Our return policy allows returns within 30 days. Items must be unused.',
      },
    );

    expect(result).toEqual({
      score: 1.0,
      pass: true,
      reason: 'All claims are supported by the context',
    });
  });

  it('returns low score when output hallucinates', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.5, false, 'The response claims a 60-day window, but context says 30 days');

    const result = await assertions.faithfulness(
      'Returns are accepted within 60 days with no questions asked.',
      {
        context: 'Our return policy allows returns within 30 days. Items must be unused.',
        threshold: 0.7,
      },
    );

    expect(result.score).toBe(0.5);
    expect(result.pass).toBe(false);
  });

  it('sends context and content to the judge', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.8, true, 'Mostly faithful');

    await assertions.faithfulness('The sky is blue', {
      context: 'The sky appears blue due to Rayleigh scattering.',
    });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    const messages = callArgs.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain('The sky is blue');
    expect(messages[0].content).toContain('Rayleigh scattering');
  });

  it('uses default threshold of 0.5', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.4, false, 'Below default threshold');

    const result = await assertions.faithfulness('content', {
      context: 'some context',
    });

    expect(result.pass).toBe(false);
  });

  it('respects custom threshold in prompt', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.75, true, 'Above custom threshold');

    await assertions.faithfulness('content', {
      context: 'some context',
      threshold: 0.7,
    });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    const messages = callArgs.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain('0.7');
  });

  it('passes judge options through', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.9, true, 'Great');

    await assertions.faithfulness('content', {
      context: 'context',
      judge: { model: 'gpt-4o' },
    });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.model).toBe('gpt-4o');
  });

  it('propagates provider errors', async () => {
    await expect(assertions.faithfulness('content', { context: 'ctx' })).rejects.toThrow(
      'Missing API key',
    );
  });
});

describe('buildFaithfulnessPrompt', () => {
  it('includes context and submission', () => {
    const prompt = buildFaithfulnessPrompt('the output', 'the context', 0.5);
    expect(prompt).toContain('the output');
    expect(prompt).toContain('the context');
  });

  it('describes claim extraction and verification process', () => {
    const prompt = buildFaithfulnessPrompt('a', 'b', 0.5);
    expect(prompt).toContain('claims');
    expect(prompt).toContain('supported');
  });

  it('uses specified threshold', () => {
    const prompt = buildFaithfulnessPrompt('a', 'b', 0.8);
    expect(prompt).toContain('0.8');
  });
});
