import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseJudgeResponse, judge, callJudge } from '../../src/testing/judge/index.js';
import { buildCriteriaPrompt } from '../../src/testing/judge/templates.js';
import { ProviderError } from '../../src/types/index.js';

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

describe('parseJudgeResponse', () => {
  it('parses valid JSON with score, pass, and reason', () => {
    const result = parseJudgeResponse(
      '{"score": 0.85, "pass": true, "reason": "Content meets criteria"}',
    );
    expect(result).toEqual({
      score: 0.85,
      pass: true,
      reason: 'Content meets criteria',
    });
  });

  it('parses JSON embedded in markdown code blocks', () => {
    const raw = '```json\n{"score": 0.7, "pass": true, "reason": "Mostly good"}\n```';
    const result = parseJudgeResponse(raw);
    expect(result).toEqual({
      score: 0.7,
      pass: true,
      reason: 'Mostly good',
    });
  });

  it('parses JSON embedded in surrounding text', () => {
    const raw =
      'Here is my evaluation:\n{"score": 0.3, "pass": false, "reason": "Does not meet criteria"}\nThank you.';
    const result = parseJudgeResponse(raw);
    expect(result).toEqual({
      score: 0.3,
      pass: false,
      reason: 'Does not meet criteria',
    });
  });

  it('handles score=0 edge case', () => {
    const result = parseJudgeResponse('{"score": 0, "pass": false, "reason": "Completely fails"}');
    expect(result.score).toBe(0);
    expect(result.pass).toBe(false);
  });

  it('handles score=1 edge case', () => {
    const result = parseJudgeResponse('{"score": 1, "pass": true, "reason": "Perfect match"}');
    expect(result.score).toBe(1);
    expect(result.pass).toBe(true);
  });

  it('throws on completely invalid input', () => {
    expect(() => parseJudgeResponse('this is not json at all')).toThrow('no valid JSON found');
  });

  it('throws when score is out of 0-1 range (too high)', () => {
    expect(() => parseJudgeResponse('{"score": 1.5, "pass": true, "reason": "over"}')).toThrow(
      'must be between 0 and 1',
    );
  });

  it('throws when score is out of 0-1 range (negative)', () => {
    expect(() => parseJudgeResponse('{"score": -0.1, "pass": false, "reason": "neg"}')).toThrow(
      'must be between 0 and 1',
    );
  });

  it('throws when score is missing', () => {
    expect(() => parseJudgeResponse('{"pass": true, "reason": "no score"}')).toThrow(
      'missing or invalid "score"',
    );
  });

  it('throws when pass is missing', () => {
    expect(() => parseJudgeResponse('{"score": 0.5, "reason": "no pass"}')).toThrow(
      'missing or invalid "pass"',
    );
  });

  it('throws when reason is missing', () => {
    expect(() => parseJudgeResponse('{"score": 0.5, "pass": true}')).toThrow(
      'missing or invalid "reason"',
    );
  });

  it('throws when score is a string instead of number', () => {
    expect(() =>
      parseJudgeResponse('{"score": "0.5", "pass": true, "reason": "string score"}'),
    ).toThrow('missing or invalid "score"');
  });

  it('throws when pass is a string instead of boolean', () => {
    expect(() =>
      parseJudgeResponse('{"score": 0.5, "pass": "true", "reason": "string pass"}'),
    ).toThrow('missing or invalid "pass"');
  });
});

describe('buildCriteriaPrompt', () => {
  it('includes content and criteria in the prompt', () => {
    const prompt = buildCriteriaPrompt('Hello world', 'Is this a greeting?');
    expect(prompt).toContain('Hello world');
    expect(prompt).toContain('Is this a greeting?');
  });

  it('requests JSON output format', () => {
    const prompt = buildCriteriaPrompt('test', 'test criteria');
    expect(prompt).toContain('"score"');
    expect(prompt).toContain('"pass"');
    expect(prompt).toContain('"reason"');
  });
});

describe('judge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
    Reflect.deleteProperty(process.env, 'ANTHROPIC_API_KEY');
    Reflect.deleteProperty(process.env, 'GOOGLE_API_KEY');
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
    Reflect.deleteProperty(process.env, 'ANTHROPIC_API_KEY');
    Reflect.deleteProperty(process.env, 'GOOGLE_API_KEY');
  });

  it('calls provider with prompt containing content and criteria', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    createCompletionMock.mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [
        {
          message: {
            content: '{"score": 0.85, "pass": true, "reason": "Content meets criteria"}',
          },
        },
      ],
      usage: { prompt_tokens: 50, completion_tokens: 20 },
    });

    const result = await judge('The sky is blue', 'Is this factually accurate?');

    expect(createCompletionMock).toHaveBeenCalledTimes(1);
    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    const messages = callArgs.messages as Array<{ content: string }>;
    expect(messages[0].content).toContain('The sky is blue');
    expect(messages[0].content).toContain('Is this factually accurate?');
    expect(result).toEqual({
      score: 0.85,
      pass: true,
      reason: 'Content meets criteria',
    });
  });

  it('uses default provider (openai) and model (gpt-4o-mini)', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    createCompletionMock.mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [
        {
          message: {
            content: '{"score": 0.5, "pass": true, "reason": "ok"}',
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    });

    await judge('content', 'criteria');

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.model).toBe('gpt-4o-mini');
    expect(openAIConstructorMock).toHaveBeenCalledWith({ apiKey: 'test-key' });
  });

  it('uses temperature=0 by default for deterministic judging', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    createCompletionMock.mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [
        {
          message: {
            content: '{"score": 0.5, "pass": true, "reason": "ok"}',
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    });

    await judge('content', 'criteria');

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.temperature).toBe(0);
  });

  it('respects custom model option', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    createCompletionMock.mockResolvedValue({
      model: 'gpt-4o',
      choices: [
        {
          message: {
            content: '{"score": 0.9, "pass": true, "reason": "great"}',
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    });

    await judge('content', 'criteria', { model: 'gpt-4o' });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.model).toBe('gpt-4o');
  });

  it('respects custom temperature option', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    createCompletionMock.mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [
        {
          message: {
            content: '{"score": 0.5, "pass": true, "reason": "ok"}',
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    });

    await judge('content', 'criteria', { temperature: 0.7 });

    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.temperature).toBe(0.7);
  });

  it('respects custom apiKey option and restores original env value', async () => {
    process.env.OPENAI_API_KEY = 'original-key';
    createCompletionMock.mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [
        {
          message: {
            content: '{"score": 0.5, "pass": true, "reason": "ok"}',
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    });

    await judge('content', 'criteria', { apiKey: 'override-key' });

    expect(openAIConstructorMock).toHaveBeenCalledWith({ apiKey: 'override-key' });
    expect(process.env.OPENAI_API_KEY).toBe('original-key');
  });

  it('cleans up apiKey from env when no original key existed', async () => {
    createCompletionMock.mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [
        {
          message: {
            content: '{"score": 0.5, "pass": true, "reason": "ok"}',
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    });

    await judge('content', 'criteria', { apiKey: 'temp-key' });

    expect(process.env.OPENAI_API_KEY).toBeUndefined();
  });

  it('propagates provider errors when API key is missing', async () => {
    await expect(judge('content', 'criteria')).rejects.toBeInstanceOf(ProviderError);
  });

  it('throws when provider returns unparseable response', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    createCompletionMock.mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [{ message: { content: 'I cannot evaluate this' } }],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    });

    await expect(judge('content', 'criteria')).rejects.toThrow('no valid JSON found');
  });
});

describe('callJudge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'OPENAI_API_KEY');
  });

  it('accepts a raw prompt and returns JudgeResult', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    createCompletionMock.mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [
        {
          message: {
            content: '{"score": 0.6, "pass": true, "reason": "Reasonable"}',
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    });

    const result = await callJudge({ prompt: 'Evaluate this content' });

    expect(result).toEqual({
      score: 0.6,
      pass: true,
      reason: 'Reasonable',
    });
    const callArgs = createCompletionMock.mock.calls[0][0] as Record<string, unknown>;
    const messages = callArgs.messages as Array<{ content: string }>;
    expect(messages[0].content).toBe('Evaluate this content');
  });
});
