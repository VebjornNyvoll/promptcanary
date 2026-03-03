import type { AssertionResult, Expectation } from '../../types/index.js';

/**
 * Run all structural assertions against a response string.
 */
export function runStructuralAssertions(
  response: string,
  expectations: Expectation,
): AssertionResult[] {
  const results: AssertionResult[] = [];

  if (expectations.max_length !== undefined) {
    results.push(checkMaxLength(response, expectations.max_length));
  }

  if (expectations.min_length !== undefined) {
    results.push(checkMinLength(response, expectations.min_length));
  }

  if (expectations.must_contain !== undefined) {
    for (const term of expectations.must_contain) {
      results.push(checkMustContain(response, term));
    }
  }

  if (expectations.must_not_contain !== undefined) {
    for (const term of expectations.must_not_contain) {
      results.push(checkMustNotContain(response, term));
    }
  }

  if (expectations.format !== undefined) {
    results.push(checkFormat(response, expectations.format));
  }

  return results;
}

function checkMaxLength(response: string, maxLength: number): AssertionResult {
  const passed = response.length <= maxLength;
  return {
    type: 'max_length',
    passed,
    expected: `<= ${String(maxLength)} characters`,
    actual: `${String(response.length)} characters`,
    details: passed ? undefined : `Response exceeds max length by ${String(response.length - maxLength)} characters`,
  };
}

function checkMinLength(response: string, minLength: number): AssertionResult {
  const passed = response.length >= minLength;
  return {
    type: 'min_length',
    passed,
    expected: `>= ${String(minLength)} characters`,
    actual: `${String(response.length)} characters`,
    details: passed ? undefined : `Response is ${String(minLength - response.length)} characters too short`,
  };
}

function checkMustContain(response: string, term: string): AssertionResult {
  const passed = response.toLowerCase().includes(term.toLowerCase());
  return {
    type: 'must_contain',
    passed,
    expected: `contains "${term}"`,
    actual: passed ? 'found' : 'not found',
    details: passed ? undefined : `Response does not contain "${term}"`,
  };
}

function checkMustNotContain(response: string, term: string): AssertionResult {
  const found = response.toLowerCase().includes(term.toLowerCase());
  return {
    type: 'must_not_contain',
    passed: !found,
    expected: `does not contain "${term}"`,
    actual: found ? 'found' : 'not found',
    details: found ? `Response contains forbidden term "${term}"` : undefined,
  };
}

function checkFormat(response: string, format: string): AssertionResult {
  let passed = false;
  let details: string | undefined;

  switch (format) {
    case 'bullet_points':
      passed = detectBulletPoints(response);
      details = passed ? undefined : 'Response does not appear to be in bullet point format';
      break;
    case 'numbered_list':
      passed = detectNumberedList(response);
      details = passed ? undefined : 'Response does not appear to be a numbered list';
      break;
    case 'json':
      passed = detectJson(response);
      details = passed ? undefined : 'Response does not appear to be valid JSON';
      break;
    case 'markdown':
      passed = detectMarkdown(response);
      details = passed ? undefined : 'Response does not appear to contain markdown formatting';
      break;
    case 'plain_text':
      // Plain text always passes — it's the absence of special formatting
      passed = true;
      break;
    default:
      details = `Unknown format: ${format}`;
  }

  return {
    type: 'format',
    passed,
    expected: format,
    actual: passed ? format : 'different format',
    details,
  };
}

function detectBulletPoints(text: string): boolean {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const bulletLines = lines.filter((l) => /^\s*[-•*]\s+/.test(l));
  // At least 2 bullet lines and they make up at least 40% of content
  return bulletLines.length >= 2 && bulletLines.length / lines.length >= 0.4;
}

function detectNumberedList(text: string): boolean {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const numberedLines = lines.filter((l) => /^\s*\d+[.)]\s+/.test(l));
  return numberedLines.length >= 2 && numberedLines.length / lines.length >= 0.4;
}

function detectJson(text: string): boolean {
  const trimmed = text.trim();
  // Try to extract JSON from markdown code blocks
  const jsonMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : trimmed;

  try {
    JSON.parse(jsonStr);
    return true;
  } catch {
    return false;
  }
}

function detectMarkdown(text: string): boolean {
  // Check for common markdown indicators
  return /^#{1,6}\s/m.test(text) || /\*\*.*\*\*/.test(text) || /```/.test(text) || /\[.*\]\(.*\)/.test(text);
}
