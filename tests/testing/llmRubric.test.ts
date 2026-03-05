import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertions } from '../../src/testing/assertions.js';
import { buildRubricPrompt } from '../../src/testing/judge/templates.js';

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

function mockJudgeResponse(score: number, pass: boolean, reason: string): void {
  createCompletionMock.mockResolvedValue({
    model: 'gpt-4o-mini',
    choices: [
      {
        message: {
          content: JSON.stringify({ score, pass, reason }),
        },
      },
    ],
    usage: { prompt_tokens: 50, completion_tokens: 20 },
  });
}

describe('assertions.llmRubric', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  it('returns JudgeResult with score, pass, and reason', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.85, true, 'Content is professional and mentions refund policy');

    const result = await assertions.llmRubric('Our refund policy allows returns within 30 days.', {
      criteria: 'The response should be professional and mention the refund policy',
    });

    expect(result).toEqual({
      score: 0.85,
      pass: true,
      reason: 'Content is professional and mentions refund policy',
    });
  });

  it('sends content and criteria to the judge', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.9, true, 'Good');

    await assertions.llmRubric('Hello world', {
      criteria: 'Is this a greeting?',
    });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    const messages = callArgs.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain('Hello world');
    expect(messages[0].content).toContain('Is this a greeting?');
  });

  it('includes input in prompt when provided', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.8, true, 'Relevant');

    await assertions.llmRubric('We offer full refunds within 30 days.', {
      criteria: 'Response is relevant to the question',
      input: 'What is your refund policy?',
    });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    const messages = callArgs.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain('What is your refund policy?');
    expect(messages[0].content).toContain('Original Input');
  });

  it('uses default threshold of 0.5', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.4, false, 'Below threshold');

    const result = await assertions.llmRubric('content', {
      criteria: 'criteria',
    });

    expect(result.pass).toBe(false);
    expect(result.score).toBe(0.4);
  });

  it('respects custom threshold in prompt', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.65, false, 'Below custom threshold');

    await assertions.llmRubric('content', {
      criteria: 'criteria',
      threshold: 0.7,
    });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    const messages = callArgs.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain('0.7');
  });

  it('passes judge options through to callJudge', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockJudgeResponse(0.9, true, 'Great');

    await assertions.llmRubric('content', {
      criteria: 'criteria',
      judge: { model: 'gpt-4o' },
    });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.model).toBe('gpt-4o');
  });

  it('passes apiKey override through judge options', async () => {
    mockJudgeResponse(0.7, true, 'OK');

    await assertions.llmRubric('content', {
      criteria: 'criteria',
      judge: { apiKey: 'custom-key' },
    });

    expect(openAIConstructorMock).toHaveBeenCalledWith({ apiKey: 'custom-key' });
  });

  it('propagates provider errors', async () => {
    await expect(assertions.llmRubric('content', { criteria: 'criteria' })).rejects.toThrow(
      'Missing API key',
    );
  });
});

describe('buildRubricPrompt', () => {
  it('includes submission and criteria', () => {
    const prompt = buildRubricPrompt('test content', 'be professional');
    expect(prompt).toContain('test content');
    expect(prompt).toContain('be professional');
    expect(prompt).toContain('Submission');
    expect(prompt).toContain('Evaluation Criteria');
  });

  it('includes input section when input is provided', () => {
    const prompt = buildRubricPrompt('response', 'criteria', 'user question');
    expect(prompt).toContain('user question');
    expect(prompt).toContain('Original Input');
  });

  it('omits input section when input is not provided', () => {
    const prompt = buildRubricPrompt('response', 'criteria');
    expect(prompt).not.toContain('Original Input');
  });

  it('uses default threshold of 0.5 in instructions', () => {
    const prompt = buildRubricPrompt('content', 'criteria');
    expect(prompt).toContain('>= 0.5');
  });

  it('uses custom threshold in instructions', () => {
    const prompt = buildRubricPrompt('content', 'criteria', undefined, 0.8);
    expect(prompt).toContain('>= 0.8');
  });

  it('requests JSON output format', () => {
    const prompt = buildRubricPrompt('content', 'criteria');
    expect(prompt).toContain('"score"');
    expect(prompt).toContain('"pass"');
    expect(prompt).toContain('"reason"');
  });
});
