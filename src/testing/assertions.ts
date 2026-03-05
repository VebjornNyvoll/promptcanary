import type {
  AnswerRelevanceOptions,
  AssertionResult,
  BleuOptions,
  CustomScorerOptions,
  FaithfulnessOptions,
  FactualityOptions,
  JudgeResult,
  LevenshteinOptions,
  LlmRubricOptions,
  Rouge1Options,
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

/**
 * Computes the Levenshtein (edit) distance between two strings using the
 * Wagner-Fischer algorithm with O(min(m,n)) space.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure b is the shorter string for O(min(m,n)) space
  if (a.length < b.length) {
    [a, b] = [b, a];
  }

  const bLen = b.length;
  const prev = new Array<number>(bLen + 1);

  for (let j = 0; j <= bLen; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    let prevDiag = prev[0];
    prev[0] = i;

    for (let j = 1; j <= bLen; j += 1) {
      const temp = prev[j];
      if (a[i - 1] === b[j - 1]) {
        prev[j] = prevDiag;
      } else {
        prev[j] = 1 + Math.min(prevDiag, prev[j], prev[j - 1]);
      }
      prevDiag = temp;
    }
  }

  return prev[bLen];
}

function levenshtein(
  content: string,
  expected: string,
  options?: LevenshteinOptions,
): AssertionResult {
  const maxLen = Math.max(content.length, expected.length);
  const distance = levenshteinDistance(content, expected);
  const score = maxLen === 0 ? 1.0 : 1 - distance / maxLen;
  const roundedScore = Math.round(score * 1000) / 1000;

  const threshold = options?.threshold;
  const passed = threshold !== undefined ? score >= threshold : true;

  let expected_str: string;
  if (threshold !== undefined) {
    expected_str = `Levenshtein score >= ${String(threshold)}`;
  } else {
    expected_str = 'Levenshtein distance computed';
  }

  return {
    type: 'levenshtein',
    passed,
    expected: expected_str,
    actual: `score: ${String(roundedScore)} (distance: ${String(distance)})`,
    score: roundedScore,
    details: passed
      ? undefined
      : `Levenshtein score ${String(roundedScore)} is below threshold ${String(threshold)}`,
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function rouge1(content: string, reference: string, options?: Rouge1Options): AssertionResult {
  const outputTokens = new Set(tokenize(content));
  const refTokens = tokenize(reference);

  if (refTokens.length === 0) {
    const score = outputTokens.size === 0 ? 1.0 : 0.0;
    const threshold = options?.threshold;
    const passed = threshold !== undefined ? score >= threshold : true;
    return {
      type: 'rouge1',
      passed,
      expected:
        threshold !== undefined
          ? `ROUGE-1 score >= ${String(threshold)}`
          : 'ROUGE-1 score computed',
      actual: `score: ${String(score)}`,
      score,
      details: passed
        ? undefined
        : `ROUGE-1 score ${String(score)} is below threshold ${String(threshold)}`,
    };
  }

  let matches = 0;
  for (const token of refTokens) {
    if (outputTokens.has(token)) {
      matches += 1;
    }
  }

  const score = Math.round((matches / refTokens.length) * 1000) / 1000;
  const threshold = options?.threshold;
  const passed = threshold !== undefined ? score >= threshold : true;

  return {
    type: 'rouge1',
    passed,
    expected:
      threshold !== undefined ? `ROUGE-1 score >= ${String(threshold)}` : 'ROUGE-1 score computed',
    actual: `score: ${String(score)} (${String(matches)}/${String(refTokens.length)} reference tokens matched)`,
    score,
    details: passed
      ? undefined
      : `ROUGE-1 score ${String(score)} is below threshold ${String(threshold)}`,
  };
}

function getNgrams(tokens: string[], n: number): Map<string, number> {
  const ngrams = new Map<string, number>();
  for (let i = 0; i <= tokens.length - n; i += 1) {
    const gram = tokens.slice(i, i + n).join(' ');
    ngrams.set(gram, (ngrams.get(gram) ?? 0) + 1);
  }
  return ngrams;
}

function bleu(content: string, reference: string, options?: BleuOptions): AssertionResult {
  const outputTokens = tokenize(content);
  const refTokens = tokenize(reference);
  const threshold = options?.threshold;

  if (outputTokens.length === 0) {
    const score = refTokens.length === 0 ? 1.0 : 0.0;
    const passed = threshold !== undefined ? score >= threshold : true;
    return {
      type: 'bleu',
      passed,
      expected:
        threshold !== undefined ? `BLEU score >= ${String(threshold)}` : 'BLEU score computed',
      actual: `score: ${String(score)}`,
      score,
      details: passed
        ? undefined
        : `BLEU score ${String(score)} is below threshold ${String(threshold)}`,
    };
  }

  if (refTokens.length === 0) {
    const passed = threshold !== undefined ? false : true;
    return {
      type: 'bleu',
      passed,
      expected:
        threshold !== undefined ? `BLEU score >= ${String(threshold)}` : 'BLEU score computed',
      actual: 'score: 0',
      score: 0,
      details: passed ? undefined : `BLEU score 0 is below threshold ${String(threshold)}`,
    };
  }

  // Compute modified n-gram precision for n=1..4
  let logPrecisionSum = 0;
  let ngramCount = 0;

  for (let n = 1; n <= 4; n += 1) {
    const outGrams = getNgrams(outputTokens, n);
    const refGrams = getNgrams(refTokens, n);

    if (outGrams.size === 0) break;

    let clippedMatches = 0;
    let totalOut = 0;

    for (const [gram, count] of outGrams) {
      const refCount = refGrams.get(gram) ?? 0;
      clippedMatches += Math.min(count, refCount);
      totalOut += count;
    }

    if (totalOut === 0) break;

    const precision = clippedMatches / totalOut;
    if (precision === 0) break;

    logPrecisionSum += Math.log(precision);
    ngramCount += 1;
  }

  if (ngramCount === 0) {
    const passed = threshold !== undefined ? false : true;
    return {
      type: 'bleu',
      passed,
      expected:
        threshold !== undefined ? `BLEU score >= ${String(threshold)}` : 'BLEU score computed',
      actual: 'score: 0',
      score: 0,
      details: passed ? undefined : `BLEU score 0 is below threshold ${String(threshold)}`,
    };
  }

  const brevityPenalty =
    outputTokens.length >= refTokens.length
      ? 1.0
      : Math.exp(1 - refTokens.length / outputTokens.length);

  const rawScore = brevityPenalty * Math.exp(logPrecisionSum / ngramCount);
  const score = Math.round(Math.min(rawScore, 1.0) * 1000) / 1000;
  const passed = threshold !== undefined ? score >= threshold : true;

  return {
    type: 'bleu',
    passed,
    expected:
      threshold !== undefined ? `BLEU score >= ${String(threshold)}` : 'BLEU score computed',
    actual: `score: ${String(score)}`,
    score,
    details: passed
      ? undefined
      : `BLEU score ${String(score)} is below threshold ${String(threshold)}`,
  };
}

async function custom(content: string, options: CustomScorerOptions): Promise<AssertionResult> {
  const scorerResult = await options.scorer(content, options.input);
  const roundedScore = Math.round(scorerResult.score * 1000) / 1000;

  return {
    type: 'custom',
    passed: scorerResult.pass,
    expected: 'custom scorer to pass',
    actual: `score: ${String(roundedScore)} — ${scorerResult.reason}`,
    score: roundedScore,
    details: scorerResult.pass ? undefined : scorerResult.reason,
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
    | 'json_schema'
    | 'levenshtein'
    | 'rouge1'
    | 'bleu';
  value:
    | string
    | number
    | RegExp
    | Record<string, string>
    | string[]
    | { min?: number; max?: number }
    | { expected: string; threshold?: number };
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
      case 'levenshtein': {
        const opts = descriptor.value as { expected: string; threshold?: number };
        results.push(levenshtein(content, opts.expected, { threshold: opts.threshold }));
        break;
      }
      case 'rouge1': {
        const opts = descriptor.value as { expected: string; threshold?: number };
        results.push(rouge1(content, opts.expected, { threshold: opts.threshold }));
        break;
      }
      case 'bleu': {
        const opts = descriptor.value as { expected: string; threshold?: number };
        results.push(bleu(content, opts.expected, { threshold: opts.threshold }));
        break;
      }
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
  levenshtein,
  rouge1,
  bleu,
  custom,
  llmRubric,
  factuality,
  answerRelevance,
  faithfulness,
  toxicity,
  runAll,
} as const;
