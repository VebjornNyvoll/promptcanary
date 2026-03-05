import { assertions } from '../testing/assertions.js';

interface MatcherResult {
  pass: boolean;
  message: () => string;
}

interface Expect {
  extend: (matchers: Record<string, (...args: unknown[]) => MatcherResult>) => void;
}

function toContainPrompt(received: string, substring: string): MatcherResult {
  const result = assertions.contains(received, substring);
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected content not to contain "${substring}"`
        : `Expected content to contain "${substring}", but it was not found`,
  };
}

function toNotContainPrompt(received: string, substring: string): MatcherResult {
  const result = assertions.notContains(received, substring);
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected content to contain "${substring}"`
        : `Expected content not to contain "${substring}", but it was found`,
  };
}

function toStartWithPrompt(received: string, prefix: string): MatcherResult {
  const result = assertions.startsWith(received, prefix);
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected content not to start with "${prefix}"`
        : `Expected content to start with "${prefix}"`,
  };
}

function toEndWithPrompt(received: string, suffix: string): MatcherResult {
  const result = assertions.endsWith(received, suffix);
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected content not to end with "${suffix}"`
        : `Expected content to end with "${suffix}"`,
  };
}

function toContainAllPrompt(received: string, substrings: string[]): MatcherResult {
  const result = assertions.containsAll(received, substrings);
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected content not to contain all substrings`
        : (result.details ?? 'Missing substrings'),
  };
}

function toContainAnyPrompt(received: string, substrings: string[]): MatcherResult {
  const result = assertions.containsAny(received, substrings);
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected content not to contain any of the substrings`
        : (result.details ?? 'None of the substrings found'),
  };
}

function toMatchMaxLength(received: string, max: number): MatcherResult {
  const result = assertions.maxLength(received, max);
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected content to exceed ${String(max)} characters`
        : (result.details ?? `Content exceeds max length of ${String(max)}`),
  };
}

function toMatchMinLength(received: string, min: number): MatcherResult {
  const result = assertions.minLength(received, min);
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected content to be shorter than ${String(min)} characters`
        : (result.details ?? `Content is shorter than ${String(min)}`),
  };
}

function toMatchWordCount(
  received: string,
  options: { min?: number; max?: number },
): MatcherResult {
  const result = assertions.wordCount(received, options);
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected word count to be outside range`
        : (result.details ?? 'Word count out of range'),
  };
}

function toMatchPromptRegex(received: string, pattern: RegExp | string): MatcherResult {
  const result = assertions.matchesRegex(received, pattern);
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected content not to match pattern ${String(pattern)}`
        : `Expected content to match pattern ${String(pattern)}`,
  };
}

function toBeValidJson(received: string): MatcherResult {
  const result = assertions.isJson(received);
  return {
    pass: result.passed,
    message: () =>
      result.passed ? `Expected content not to be valid JSON` : `Expected content to be valid JSON`,
  };
}

function toMatchJsonSchema(received: string, schema: Record<string, string>): MatcherResult {
  const result = assertions.matchesJsonSchema(received, schema);
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected content not to match JSON schema`
        : (result.details ?? 'Content does not match JSON schema'),
  };
}

function toMatchLevenshtein(received: string, expected: string, threshold?: number): MatcherResult {
  const result = assertions.levenshtein(received, expected, { threshold });
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected Levenshtein score to be below ${String(threshold)}`
        : (result.details ?? 'Levenshtein score below threshold'),
  };
}

function toMatchRouge1(received: string, reference: string, threshold?: number): MatcherResult {
  const result = assertions.rouge1(received, reference, { threshold });
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected ROUGE-1 score to be below ${String(threshold)}`
        : (result.details ?? 'ROUGE-1 score below threshold'),
  };
}

function toMatchBleu(received: string, reference: string, threshold?: number): MatcherResult {
  const result = assertions.bleu(received, reference, { threshold });
  return {
    pass: result.passed,
    message: () =>
      result.passed
        ? `Expected BLEU score to be below ${String(threshold)}`
        : (result.details ?? 'BLEU score below threshold'),
  };
}

const promptCanaryMatchers = {
  toContainPrompt,
  toNotContainPrompt,
  toStartWithPrompt,
  toEndWithPrompt,
  toContainAllPrompt,
  toContainAnyPrompt,
  toMatchMaxLength,
  toMatchMinLength,
  toMatchWordCount,
  toMatchPromptRegex,
  toBeValidJson,
  toMatchJsonSchema,
  toMatchLevenshtein,
  toMatchRouge1,
  toMatchBleu,
};

export function extendExpect(expectFn: Expect): void {
  expectFn.extend(
    promptCanaryMatchers as unknown as Record<string, (...args: unknown[]) => MatcherResult>,
  );
}

export { promptCanaryMatchers };

export interface PromptCanaryMatchers<R = unknown> {
  toContainPrompt(substring: string): R;
  toNotContainPrompt(substring: string): R;
  toStartWithPrompt(prefix: string): R;
  toEndWithPrompt(suffix: string): R;
  toContainAllPrompt(substrings: string[]): R;
  toContainAnyPrompt(substrings: string[]): R;
  toMatchMaxLength(max: number): R;
  toMatchMinLength(min: number): R;
  toMatchWordCount(options: { min?: number; max?: number }): R;
  toMatchPromptRegex(pattern: RegExp | string): R;
  toBeValidJson(): R;
  toMatchJsonSchema(schema: Record<string, string>): R;
  toMatchLevenshtein(expected: string, threshold?: number): R;
  toMatchRouge1(reference: string, threshold?: number): R;
  toMatchBleu(reference: string, threshold?: number): R;
}
