import type { AssertionResult } from '../types/index.js';

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

export interface AssertionDescriptor {
  type:
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'max_length'
    | 'min_length'
    | 'regex'
    | 'is_json'
    | 'json_schema';
  value: string | number | RegExp | Record<string, string>;
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
  maxLength,
  minLength,
  matchesRegex,
  isJson,
  matchesJsonSchema,
  runAll,
} as const;
