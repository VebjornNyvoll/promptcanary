import type {
  AnswerRelevanceOptions,
  AssertionResult,
  FaithfulnessOptions,
  FactualityOptions,
  JudgeResult,
  LlmRubricOptions,
  ToxicityOptions,
} from '../types/index.js';
import { callJudge } from './judge/index.js';
import {
  buildAnswerRelevancePrompt,
  buildFactualityPrompt,
  buildFaithfulnessPrompt,
  buildRubricPrompt,
  buildToxicityPrompt,
} from './judge/templates.js';

function contains(content: string, substring: string): AssertionResult {
  const passed = content.toLowerCase().includes(substring.toLowerCase());
  return {
    type: 'contains',
    passed,
    expected: `contains "${substring}"`,
    actual: passed ? 'found' : 'not found',
    details: passed ? undefined : `Content does not contain "${substring}"`,
  };
}

function notContains(content: string, substring: string): AssertionResult {
  const found = content.toLowerCase().includes(substring.toLowerCase());
  return {
    type: 'not_contains',
    passed: !found,
    expected: `does not contain "${substring}"`,
    actual: found ? 'found' : 'not found',
    details: found ? `Content contains forbidden substring "${substring}"` : undefined,
  };
}

function maxLength(content: string, max: number): AssertionResult {
  const passed = content.length <= max;
  return {
    type: 'max_length',
    passed,
    expected: `<= ${String(max)} characters`,
    actual: `${String(content.length)} characters`,
    details: passed
      ? undefined
      : `Content exceeds max length by ${String(content.length - max)} characters`,
  };
}

function minLength(content: string, min: number): AssertionResult {
  const passed = content.length >= min;
  return {
    type: 'min_length',
    passed,
    expected: `>= ${String(min)} characters`,
    actual: `${String(content.length)} characters`,
    details: passed ? undefined : `Content is ${String(min - content.length)} characters too short`,
  };
}

function matchesRegex(content: string, pattern: RegExp | string): AssertionResult {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  const passed = regex.test(content);
  return {
    type: 'regex',
    passed,
    expected: `matches ${String(regex)}`,
    actual: passed ? 'matched' : 'no match',
    details: passed ? undefined : `Content does not match pattern ${String(regex)}`,
  };
}

function startsWith(content: string, prefix: string): AssertionResult {
  const passed = content.toLowerCase().startsWith(prefix.toLowerCase());
  return {
    type: 'starts_with',
    passed,
    expected: `starts with "${prefix}"`,
    actual: passed ? 'matched' : 'no match',
    details: passed ? undefined : `Content does not start with "${prefix}"`,
  };
}

function endsWith(content: string, suffix: string): AssertionResult {
  const passed = content.toLowerCase().endsWith(suffix.toLowerCase());
  return {
    type: 'ends_with',
    passed,
    expected: `ends with "${suffix}"`,
    actual: passed ? 'matched' : 'no match',
    details: passed ? undefined : `Content does not end with "${suffix}"`,
  };
}

function containsAll(content: string, substrings: string[]): AssertionResult {
  const lowerContent = content.toLowerCase();
  const missing: string[] = [];

  for (const substring of substrings) {
    if (!lowerContent.includes(substring.toLowerCase())) {
      missing.push(substring);
    }
  }

  const passed = missing.length === 0;
  return {
    type: 'contains_all',
    passed,
    expected: `contains all of: ${substrings.map((s) => `"${s}"`).join(', ')}`,
    actual: passed ? 'all found' : `missing: ${missing.map((s) => `"${s}"`).join(', ')}`,
    details: passed ? undefined : `Missing substrings: ${missing.map((s) => `"${s}"`).join(', ')}`,
  };
}

function containsAny(content: string, substrings: string[]): AssertionResult {
  const lowerContent = content.toLowerCase();
  let matched: string | undefined;

  for (const substring of substrings) {
    if (lowerContent.includes(substring.toLowerCase())) {
      matched = substring;
      break;
    }
  }

  const passed = matched !== undefined;
  const matchedStr = matched ?? '';
  return {
    type: 'contains_any',
    passed,
    expected: `contains at least one of: ${substrings.map((s) => `"${s}"`).join(', ')}`,
    actual: passed ? `found "${matchedStr}"` : 'none found',
    details: passed
      ? undefined
      : `None of the substrings found: ${substrings.map((s) => `"${s}"`).join(', ')}`,
  };
}

function caseSensitiveContains(content: string, substring: string): AssertionResult {
  const passed = content.includes(substring);
  return {
    type: 'case_sensitive_contains',
    passed,
    expected: `contains "${substring}" (case-sensitive)`,
    actual: passed ? 'found' : 'not found',
    details: passed ? undefined : `Content does not contain "${substring}" (case-sensitive)`,
  };
}

function wordCount(content: string, options: { min?: number; max?: number }): AssertionResult {
  const words = content
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const count = words.length;
  const { min, max } = options;

  let passed = true;
  if (min !== undefined && count < min) {
    passed = false;
  }
  if (max !== undefined && count > max) {
    passed = false;
  }

  let expected = '';
  if (min !== undefined && max !== undefined) {
    expected = `${String(min)}-${String(max)} words`;
  } else if (min !== undefined) {
    expected = `>= ${String(min)} words`;
  } else if (max !== undefined) {
    expected = `<= ${String(max)} words`;
  } else {
    expected = 'any word count';
  }

  return {
    type: 'word_count',
    passed,
    expected,
    actual: `${String(count)} words`,
    details: passed ? undefined : `Expected ${expected}, got ${String(count)} words`,
  };
}

function isJson(content: string): AssertionResult {
  let passed = false;
  try {
    JSON.parse(content);
    passed = true;
  } catch {
    // empty
  }
  return {
    type: 'is_json',
    passed,
    expected: 'valid JSON',
    actual: passed ? 'valid JSON' : 'invalid JSON',
    details: passed ? undefined : 'Content is not valid JSON',
  };
}

/**
 * Validates content against a shallow JSON schema where each key maps to
 * an expected `typeof` value (e.g. `{ name: "string", age: "number" }`).
 */
function matchesJsonSchema(content: string, schema: Record<string, string>): AssertionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      type: 'json_schema',
      passed: false,
      expected: 'valid JSON matching schema',
      actual: 'invalid JSON',
      details: 'Content is not valid JSON',
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      type: 'json_schema',
      passed: false,
      expected: 'JSON object matching schema',
      actual: Array.isArray(parsed) ? 'array' : typeof parsed,
      details: 'Content is not a JSON object',
    };
  }

  const obj = parsed as Record<string, unknown>;
  const errors: string[] = [];

  for (const [key, expectedType] of Object.entries(schema)) {
    if (!(key in obj)) {
      errors.push(`missing key "${key}"`);
    } else if (typeof obj[key] !== expectedType) {
      errors.push(`key "${key}" expected ${expectedType}, got ${typeof obj[key]}`);
    }
  }

  const passed = errors.length === 0;
  return {
    type: 'json_schema',
    passed,
    expected: 'matches JSON schema',
    actual: passed ? 'matches' : errors.join('; '),
    details: passed ? undefined : errors.join('; '),
  };
}

function latency(latencyMs: number, options: { max: number }): AssertionResult {
  const passed = latencyMs <= options.max;
  return {
    type: 'latency',
    passed,
    expected: `<= ${String(options.max)}ms`,
    actual: `${String(latencyMs)}ms`,
    details: passed
      ? undefined
      : `Response took ${String(latencyMs)}ms, exceeding ${String(options.max)}ms limit`,
  };
}

function tokenCount(
  tokenUsage: { prompt: number; completion: number },
  options: { max?: number; maxPrompt?: number; maxCompletion?: number },
): AssertionResult {
  const exceeded: string[] = [];

  if (options.max !== undefined) {
    const total = tokenUsage.prompt + tokenUsage.completion;
    if (total > options.max) {
      exceeded.push(`total tokens (${String(total)}) exceeds max ${String(options.max)}`);
    }
  }

  if (options.maxPrompt !== undefined) {
    if (tokenUsage.prompt > options.maxPrompt) {
      exceeded.push(
        `prompt tokens (${String(tokenUsage.prompt)}) exceeds max ${String(options.maxPrompt)}`,
      );
    }
  }

  if (options.maxCompletion !== undefined) {
    if (tokenUsage.completion > options.maxCompletion) {
      exceeded.push(
        `completion tokens (${String(tokenUsage.completion)}) exceeds max ${String(options.maxCompletion)}`,
      );
    }
  }

  const passed = exceeded.length === 0;

  let expected = '';
  const limits: string[] = [];
  if (options.max !== undefined) {
    limits.push(`total <= ${String(options.max)}`);
  }
  if (options.maxPrompt !== undefined) {
    limits.push(`prompt <= ${String(options.maxPrompt)}`);
  }
  if (options.maxCompletion !== undefined) {
    limits.push(`completion <= ${String(options.maxCompletion)}`);
  }
  expected = limits.join(', ');

  const actual = `prompt: ${String(tokenUsage.prompt)}, completion: ${String(tokenUsage.completion)}`;

  return {
    type: 'token_count',
    passed,
    expected,
    actual,
    details: passed ? undefined : exceeded.join('; '),
  };
}

async function llmRubric(content: string, options: LlmRubricOptions): Promise<JudgeResult> {
  const threshold = options.threshold ?? 0.5;
  const prompt = buildRubricPrompt(content, options.criteria, options.input, threshold);
  return callJudge({ prompt, ...options.judge });
}

async function factuality(content: string, options: FactualityOptions): Promise<JudgeResult> {
  const prompt = buildFactualityPrompt(content, options.input, options.expected);
  return callJudge({ prompt, ...options.judge });
}

async function answerRelevance(
  content: string,
  options: AnswerRelevanceOptions,
): Promise<JudgeResult> {
  const threshold = options.threshold ?? 0.5;
  const prompt = buildAnswerRelevancePrompt(content, options.input, threshold);
  return callJudge({ prompt, ...options.judge });
}

async function faithfulness(content: string, options: FaithfulnessOptions): Promise<JudgeResult> {
  const threshold = options.threshold ?? 0.5;
  const prompt = buildFaithfulnessPrompt(content, options.context, threshold);
  return callJudge({ prompt, ...options.judge });
}

async function toxicity(content: string, options?: ToxicityOptions): Promise<JudgeResult> {
  const threshold = options?.threshold ?? 0.5;
  const prompt = buildToxicityPrompt(content, threshold);
  return callJudge({ prompt, ...options?.judge });
}

export interface AssertionDescriptor {
  type:
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'contains_all'
    | 'contains_any'
    | 'case_sensitive_contains'
    | 'word_count'
    | 'max_length'
    | 'min_length'
    | 'regex'
    | 'is_json'
    | 'json_schema';
  value:
    | string
    | number
    | RegExp
    | Record<string, string>
    | string[]
    | { min?: number; max?: number };
}

export interface RunAllResult {
  passed: boolean;
  results: AssertionResult[];
}

function runAll(content: string, descriptors: AssertionDescriptor[]): RunAllResult {
  const results: AssertionResult[] = [];

  for (const descriptor of descriptors) {
    switch (descriptor.type) {
      case 'contains':
        results.push(contains(content, descriptor.value as string));
        break;
      case 'not_contains':
        results.push(notContains(content, descriptor.value as string));
        break;
      case 'starts_with':
        results.push(startsWith(content, descriptor.value as string));
        break;
      case 'ends_with':
        results.push(endsWith(content, descriptor.value as string));
        break;
      case 'contains_all':
        results.push(containsAll(content, descriptor.value as string[]));
        break;
      case 'contains_any':
        results.push(containsAny(content, descriptor.value as string[]));
        break;
      case 'case_sensitive_contains':
        results.push(caseSensitiveContains(content, descriptor.value as string));
        break;
      case 'word_count':
        results.push(wordCount(content, descriptor.value as { min?: number; max?: number }));
        break;
      case 'max_length':
        results.push(maxLength(content, Number(descriptor.value)));
        break;
      case 'min_length':
        results.push(minLength(content, Number(descriptor.value)));
        break;
      case 'regex':
        results.push(matchesRegex(content, descriptor.value as RegExp | string));
        break;
      case 'is_json':
        results.push(isJson(content));
        break;
      case 'json_schema':
        results.push(matchesJsonSchema(content, descriptor.value as Record<string, string>));
        break;
    }
  }

  return {
    passed: results.every((r) => r.passed),
    results,
  };
}

export const assertions = {
  contains,
  notContains,
  startsWith,
  endsWith,
  containsAll,
  containsAny,
  caseSensitiveContains,
  wordCount,
  maxLength,
  minLength,
  matchesRegex,
  isJson,
  matchesJsonSchema,
  latency,
  tokenCount,
  llmRubric,
  factuality,
  answerRelevance,
  faithfulness,
  toxicity,
  runAll,
} as const;
