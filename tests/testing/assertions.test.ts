import { describe, it, expect } from 'vitest';
import { assertions } from '../../src/testing/assertions.js';
import type { AssertionDescriptor } from '../../src/testing/assertions.js';

describe('assertions', () => {
  describe('contains', () => {
    it('passes when content contains substring', () => {
      const result = assertions.contains('Your refund will arrive in 30 days', 'refund');
      expect(result.passed).toBe(true);
      expect(result.type).toBe('contains');
    });

    it('is case-insensitive', () => {
      const result = assertions.contains('REFUND processed', 'refund');
      expect(result.passed).toBe(true);
    });

    it('fails when content does not contain substring', () => {
      const result = assertions.contains('Your order is confirmed', 'refund');
      expect(result.passed).toBe(false);
      expect(result.details).toContain('refund');
    });

    it('handles empty content', () => {
      const result = assertions.contains('', 'anything');
      expect(result.passed).toBe(false);
    });
  });

  describe('notContains', () => {
    it('passes when content does not contain substring', () => {
      const result = assertions.notContains('Everything is fine', 'error');
      expect(result.passed).toBe(true);
      expect(result.type).toBe('not_contains');
    });

    it('fails when content contains forbidden substring', () => {
      const result = assertions.notContains('An error occurred', 'error');
      expect(result.passed).toBe(false);
      expect(result.details).toContain('forbidden');
    });

    it('is case-insensitive', () => {
      const result = assertions.notContains('ERROR occurred', 'error');
      expect(result.passed).toBe(false);
    });
  });

  describe('startsWith', () => {
    it('passes when content starts with prefix', () => {
      const result = assertions.startsWith('Your refund will arrive in 30 days', 'Your');
      expect(result.passed).toBe(true);
      expect(result.type).toBe('starts_with');
    });

    it('is case-insensitive', () => {
      const result = assertions.startsWith('REFUND processed', 'refund');
      expect(result.passed).toBe(true);
    });

    it('fails when content does not start with prefix', () => {
      const result = assertions.startsWith('The refund will arrive', 'Your');
      expect(result.passed).toBe(false);
      expect(result.details).toContain('does not start with');
    });

    it('handles empty content', () => {
      const result = assertions.startsWith('', 'anything');
      expect(result.passed).toBe(false);
    });

    it('passes when content is exactly the prefix', () => {
      const result = assertions.startsWith('hello', 'hello');
      expect(result.passed).toBe(true);
    });
  });

  describe('endsWith', () => {
    it('passes when content ends with suffix', () => {
      const result = assertions.endsWith('Your refund will arrive in 30 days', 'days');
      expect(result.passed).toBe(true);
      expect(result.type).toBe('ends_with');
    });

    it('is case-insensitive', () => {
      const result = assertions.endsWith('Processing REFUND', 'refund');
      expect(result.passed).toBe(true);
    });

    it('fails when content does not end with suffix', () => {
      const result = assertions.endsWith('The refund will arrive', 'tomorrow');
      expect(result.passed).toBe(false);
      expect(result.details).toContain('does not end with');
    });

    it('handles empty content', () => {
      const result = assertions.endsWith('', 'anything');
      expect(result.passed).toBe(false);
    });

    it('passes when content is exactly the suffix', () => {
      const result = assertions.endsWith('hello', 'hello');
      expect(result.passed).toBe(true);
    });
  });

  describe('maxLength', () => {
    it('passes when content is within limit', () => {
      const result = assertions.maxLength('short', 500);
      expect(result.passed).toBe(true);
      expect(result.type).toBe('max_length');
    });

    it('passes when content is exactly at limit', () => {
      const result = assertions.maxLength('abc', 3);
      expect(result.passed).toBe(true);
    });

    it('fails when content exceeds limit', () => {
      const result = assertions.maxLength('this is too long', 5);
      expect(result.passed).toBe(false);
      expect(result.details).toContain('exceeds');
    });
  });

  describe('minLength', () => {
    it('passes when content meets minimum', () => {
      const result = assertions.minLength('sufficient length content', 5);
      expect(result.passed).toBe(true);
      expect(result.type).toBe('min_length');
    });

    it('passes when content is exactly at minimum', () => {
      const result = assertions.minLength('abc', 3);
      expect(result.passed).toBe(true);
    });

    it('fails when content is too short', () => {
      const result = assertions.minLength('hi', 10);
      expect(result.passed).toBe(false);
      expect(result.details).toContain('too short');
    });
  });

  describe('matchesRegex', () => {
    it('passes with RegExp object', () => {
      const result = assertions.matchesRegex('Delivery in 5 days', /\d+ days/);
      expect(result.passed).toBe(true);
      expect(result.type).toBe('regex');
    });

    it('passes with string pattern', () => {
      const result = assertions.matchesRegex('Delivery in 5 days', '\\d+ days');
      expect(result.passed).toBe(true);
    });

    it('fails when pattern does not match', () => {
      const result = assertions.matchesRegex('No numbers here', /\d+/);
      expect(result.passed).toBe(false);
      expect(result.details).toContain('does not match');
    });
  });

  describe('isJson', () => {
    it('passes for valid JSON object', () => {
      const result = assertions.isJson('{"name":"test","value":42}');
      expect(result.passed).toBe(true);
      expect(result.type).toBe('is_json');
    });

    it('passes for valid JSON array', () => {
      const result = assertions.isJson('[1,2,3]');
      expect(result.passed).toBe(true);
    });

    it('fails for invalid JSON', () => {
      const result = assertions.isJson('not json at all');
      expect(result.passed).toBe(false);
      expect(result.details).toContain('not valid JSON');
    });

    it('fails for empty string', () => {
      const result = assertions.isJson('');
      expect(result.passed).toBe(false);
    });
  });

  describe('matchesJsonSchema', () => {
    it('passes when all keys match expected types', () => {
      const result = assertions.matchesJsonSchema('{"name":"Alice","age":30}', {
        name: 'string',
        age: 'number',
      });
      expect(result.passed).toBe(true);
      expect(result.type).toBe('json_schema');
    });

    it('fails when a key is missing', () => {
      const result = assertions.matchesJsonSchema('{"name":"Alice"}', {
        name: 'string',
        age: 'number',
      });
      expect(result.passed).toBe(false);
      expect(result.details).toContain('missing key "age"');
    });

    it('fails when a key has wrong type', () => {
      const result = assertions.matchesJsonSchema('{"name":"Alice","age":"thirty"}', {
        name: 'string',
        age: 'number',
      });
      expect(result.passed).toBe(false);
      expect(result.details).toContain('expected number, got string');
    });

    it('fails for invalid JSON', () => {
      const result = assertions.matchesJsonSchema('not json', { key: 'string' });
      expect(result.passed).toBe(false);
      expect(result.details).toContain('not valid JSON');
    });

    it('fails for JSON array', () => {
      const result = assertions.matchesJsonSchema('[1,2]', { key: 'string' });
      expect(result.passed).toBe(false);
      expect(result.details).toContain('not a JSON object');
    });

    it('fails for JSON primitive', () => {
      const result = assertions.matchesJsonSchema('"hello"', { key: 'string' });
      expect(result.passed).toBe(false);
      expect(result.details).toContain('not a JSON object');
    });
  });

  describe('runAll', () => {
    it('returns passed=true when all assertions pass', () => {
      const descriptors: AssertionDescriptor[] = [
        { type: 'contains', value: 'refund' },
        { type: 'max_length', value: 500 },
      ];
      const result = assertions.runAll('Your refund is on the way', descriptors);
      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.passed)).toBe(true);
    });

    it('returns passed=false when any assertion fails', () => {
      const descriptors: AssertionDescriptor[] = [
        { type: 'contains', value: 'refund' },
        { type: 'max_length', value: 5 },
      ];
      const result = assertions.runAll('Your refund is on the way', descriptors);
      expect(result.passed).toBe(false);
      expect(result.results[0].passed).toBe(true);
      expect(result.results[1].passed).toBe(false);
    });

    it('handles all assertion types', () => {
      const content = '{"status":"ok","count":3}';
      const descriptors: AssertionDescriptor[] = [
        { type: 'contains', value: 'ok' },
        { type: 'not_contains', value: 'error' },
        { type: 'starts_with', value: '{' },
        { type: 'ends_with', value: '}' },
        { type: 'max_length', value: 100 },
        { type: 'min_length', value: 5 },
        { type: 'regex', value: '\\d+' },
        { type: 'is_json', value: '' },
        { type: 'json_schema', value: { status: 'string', count: 'number' } },
        { type: 'case_sensitive_contains', value: 'status' },
        { type: 'word_count', value: { min: 1, max: 10 } },
      ];
      const result = assertions.runAll(content, descriptors);
      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(11);
    });

    it('returns empty results for empty descriptors', () => {
      const result = assertions.runAll('any content', []);
      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(0);
    });
  });
});

describe('containsAll', () => {
  it('passes when all substrings are found', () => {
    const result = assertions.containsAll('Your refund will arrive in 30 days', [
      'refund',
      'arrive',
      'days',
    ]);
    expect(result.passed).toBe(true);
    expect(result.type).toBe('contains_all');
  });

  it('is case-insensitive', () => {
    const result = assertions.containsAll('REFUND PROCESSED SUCCESSFULLY', ['refund', 'processed']);
    expect(result.passed).toBe(true);
  });

  it('fails when some substrings are missing', () => {
    const result = assertions.containsAll('Your refund will arrive', ['refund', 'error', 'days']);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('error');
    expect(result.details).toContain('days');
  });

  it('fails when all substrings are missing', () => {
    const result = assertions.containsAll('Hello world', ['foo', 'bar', 'baz']);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('foo');
    expect(result.details).toContain('bar');
    expect(result.details).toContain('baz');
  });

  it('handles empty array', () => {
    const result = assertions.containsAll('any content', []);
    expect(result.passed).toBe(true);
  });

  it('handles empty content', () => {
    const result = assertions.containsAll('', ['anything']);
    expect(result.passed).toBe(false);
  });

  it('reports all missing substrings in details', () => {
    const result = assertions.containsAll('test', ['a', 'b', 'c']);
    expect(result.details).toContain('"a"');
    expect(result.details).toContain('"b"');
    expect(result.details).toContain('"c"');
  });
});

describe('containsAny', () => {
  it('passes when at least one substring is found', () => {
    const result = assertions.containsAny('Your refund will arrive in 30 days', [
      'error',
      'refund',
      'warning',
    ]);
    expect(result.passed).toBe(true);
    expect(result.type).toBe('contains_any');
  });

  it('is case-insensitive', () => {
    const result = assertions.containsAny('REFUND PROCESSED', ['error', 'refund', 'warning']);
    expect(result.passed).toBe(true);
  });

  it('fails when no substrings are found', () => {
    const result = assertions.containsAny('Your order is confirmed', [
      'error',
      'warning',
      'failed',
    ]);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('None of the substrings found');
  });

  it('handles empty array', () => {
    const result = assertions.containsAny('any content', []);
    expect(result.passed).toBe(false);
  });

  it('handles empty content', () => {
    const result = assertions.containsAny('', ['anything']);
    expect(result.passed).toBe(false);
  });

  it('reports which substring matched', () => {
    const result = assertions.containsAny('Hello world', ['foo', 'world', 'bar']);
    expect(result.passed).toBe(true);
    expect(result.actual).toContain('world');
  });

  it('returns first matching substring', () => {
    const result = assertions.containsAny('abc def ghi', ['def', 'abc', 'ghi']);
    expect(result.passed).toBe(true);
    expect(result.actual).toContain('def');
  });
});

describe('caseSensitiveContains', () => {
  it('passes when content contains exact substring', () => {
    const result = assertions.caseSensitiveContains('Your refund will arrive', 'refund');
    expect(result.passed).toBe(true);
    expect(result.type).toBe('case_sensitive_contains');
  });

  it('fails when case does not match', () => {
    const result = assertions.caseSensitiveContains('Your REFUND will arrive', 'refund');
    expect(result.passed).toBe(false);
    expect(result.details).toContain('case-sensitive');
  });

  it('passes when case matches exactly', () => {
    const result = assertions.caseSensitiveContains('REFUND processed', 'REFUND');
    expect(result.passed).toBe(true);
  });

  it('fails when substring is not found', () => {
    const result = assertions.caseSensitiveContains('Your order is confirmed', 'refund');
    expect(result.passed).toBe(false);
    expect(result.details).toContain('does not contain');
  });

  it('handles empty content', () => {
    const result = assertions.caseSensitiveContains('', 'anything');
    expect(result.passed).toBe(false);
  });

  it('handles empty substring', () => {
    const result = assertions.caseSensitiveContains('content', '');
    expect(result.passed).toBe(true);
  });

  it('is case-sensitive for mixed case', () => {
    const result = assertions.caseSensitiveContains('The Refund Policy', 'Refund');
    expect(result.passed).toBe(true);
  });

  it('fails for partial case mismatch', () => {
    const result = assertions.caseSensitiveContains('The Refund Policy', 'refund');
    expect(result.passed).toBe(false);
  });
});

describe('wordCount', () => {
  it('passes when word count is within range', () => {
    const result = assertions.wordCount('one two three four five', { min: 3, max: 10 });
    expect(result.passed).toBe(true);
    expect(result.type).toBe('word_count');
  });

  it('counts words correctly', () => {
    const result = assertions.wordCount('one two three', { min: 3, max: 3 });
    expect(result.passed).toBe(true);
    expect(result.actual).toBe('3 words');
  });

  it('fails when word count is below minimum', () => {
    const result = assertions.wordCount('one two', { min: 5 });
    expect(result.passed).toBe(false);
    expect(result.details).toContain('Expected >= 5 words');
  });

  it('fails when word count exceeds maximum', () => {
    const result = assertions.wordCount('one two three four five', { max: 3 });
    expect(result.passed).toBe(false);
    expect(result.details).toContain('Expected <= 3 words');
  });

  it('handles empty content as zero words', () => {
    const result = assertions.wordCount('', { min: 0, max: 5 });
    expect(result.passed).toBe(true);
    expect(result.actual).toBe('0 words');
  });

  it('handles whitespace-only content as zero words', () => {
    const result = assertions.wordCount('   \t\n  ', { min: 0, max: 5 });
    expect(result.passed).toBe(true);
    expect(result.actual).toBe('0 words');
  });

  it('counts words with multiple spaces correctly', () => {
    const result = assertions.wordCount('one    two    three', { min: 3, max: 3 });
    expect(result.passed).toBe(true);
  });

  it('counts words with tabs and newlines correctly', () => {
    const result = assertions.wordCount('one\ttwo\nthree', { min: 3, max: 3 });
    expect(result.passed).toBe(true);
  });

  it('passes with only minimum constraint', () => {
    const result = assertions.wordCount('one two three four five', { min: 3 });
    expect(result.passed).toBe(true);
    expect(result.expected).toBe('>= 3 words');
  });

  it('passes with only maximum constraint', () => {
    const result = assertions.wordCount('one two three', { max: 10 });
    expect(result.passed).toBe(true);
    expect(result.expected).toBe('<= 10 words');
  });

  it('passes with no constraints', () => {
    const result = assertions.wordCount('any content here', {});
    expect(result.passed).toBe(true);
    expect(result.expected).toBe('any word count');
  });

  it('handles exact minimum boundary', () => {
    const result = assertions.wordCount('one two three', { min: 3 });
    expect(result.passed).toBe(true);
  });

  it('handles exact maximum boundary', () => {
    const result = assertions.wordCount('one two three', { max: 3 });
    expect(result.passed).toBe(true);
  });

  it('fails when below minimum boundary', () => {
    const result = assertions.wordCount('one two', { min: 3 });
    expect(result.passed).toBe(false);
  });

  it('fails when above maximum boundary', () => {
    const result = assertions.wordCount('one two three four', { max: 3 });
    expect(result.passed).toBe(false);
  });

  it('reports correct word count in details', () => {
    const result = assertions.wordCount('a b c d e', { min: 10 });
    expect(result.details).toContain('5 words');
  });
});

describe('latency', () => {
  it('passes when latency is within limit', () => {
    const result = assertions.latency(100, { max: 500 });
    expect(result.passed).toBe(true);
    expect(result.type).toBe('latency');
  });

  it('passes when latency equals limit', () => {
    const result = assertions.latency(500, { max: 500 });
    expect(result.passed).toBe(true);
  });

  it('fails when latency exceeds limit', () => {
    const result = assertions.latency(600, { max: 500 });
    expect(result.passed).toBe(false);
    expect(result.details).toContain('exceeding');
  });

  it('handles zero latency', () => {
    const result = assertions.latency(0, { max: 100 });
    expect(result.passed).toBe(true);
    expect(result.actual).toBe('0ms');
  });

  it('reports correct expected value', () => {
    const result = assertions.latency(100, { max: 500 });
    expect(result.expected).toBe('<= 500ms');
  });

  it('reports correct actual value', () => {
    const result = assertions.latency(250, { max: 500 });
    expect(result.actual).toBe('250ms');
  });

  it('includes latency and limit in failure details', () => {
    const result = assertions.latency(1000, { max: 500 });
    expect(result.details).toContain('1000ms');
    expect(result.details).toContain('500ms');
  });

  it('has no details when passing', () => {
    const result = assertions.latency(100, { max: 500 });
    expect(result.details).toBeUndefined();
  });
});

describe('tokenCount', () => {
  it('passes when total tokens within limit', () => {
    const result = assertions.tokenCount({ prompt: 100, completion: 50 }, { max: 200 });
    expect(result.passed).toBe(true);
    expect(result.type).toBe('token_count');
  });

  it('passes when total tokens equals limit', () => {
    const result = assertions.tokenCount({ prompt: 100, completion: 100 }, { max: 200 });
    expect(result.passed).toBe(true);
  });

  it('fails when total tokens exceed limit', () => {
    const result = assertions.tokenCount({ prompt: 150, completion: 100 }, { max: 200 });
    expect(result.passed).toBe(false);
    expect(result.details).toContain('total tokens');
  });

  it('passes when prompt tokens within limit', () => {
    const result = assertions.tokenCount({ prompt: 100, completion: 50 }, { maxPrompt: 150 });
    expect(result.passed).toBe(true);
  });

  it('fails when prompt tokens exceed limit', () => {
    const result = assertions.tokenCount({ prompt: 200, completion: 50 }, { maxPrompt: 150 });
    expect(result.passed).toBe(false);
    expect(result.details).toContain('prompt tokens');
  });

  it('passes when completion tokens within limit', () => {
    const result = assertions.tokenCount({ prompt: 100, completion: 50 }, { maxCompletion: 100 });
    expect(result.passed).toBe(true);
  });

  it('fails when completion tokens exceed limit', () => {
    const result = assertions.tokenCount({ prompt: 100, completion: 150 }, { maxCompletion: 100 });
    expect(result.passed).toBe(false);
    expect(result.details).toContain('completion tokens');
  });

  it('handles multiple limits simultaneously', () => {
    const result = assertions.tokenCount(
      { prompt: 100, completion: 50 },
      { max: 200, maxPrompt: 150, maxCompletion: 100 },
    );
    expect(result.passed).toBe(true);
  });

  it('fails when multiple limits are exceeded', () => {
    const result = assertions.tokenCount(
      { prompt: 200, completion: 150 },
      { max: 200, maxPrompt: 150, maxCompletion: 100 },
    );
    expect(result.passed).toBe(false);
    expect(result.details).toContain('total tokens');
    expect(result.details).toContain('prompt tokens');
    expect(result.details).toContain('completion tokens');
  });

  it('handles zero tokens', () => {
    const result = assertions.tokenCount({ prompt: 0, completion: 0 }, { max: 100 });
    expect(result.passed).toBe(true);
  });

  it('reports correct actual value', () => {
    const result = assertions.tokenCount({ prompt: 100, completion: 50 }, { max: 200 });
    expect(result.actual).toContain('prompt: 100');
    expect(result.actual).toContain('completion: 50');
  });

  it('reports correct expected value with single limit', () => {
    const result = assertions.tokenCount({ prompt: 100, completion: 50 }, { max: 200 });
    expect(result.expected).toContain('total <= 200');
  });

  it('reports correct expected value with multiple limits', () => {
    const result = assertions.tokenCount(
      { prompt: 100, completion: 50 },
      { max: 200, maxPrompt: 150, maxCompletion: 100 },
    );
    expect(result.expected).toContain('total <= 200');
    expect(result.expected).toContain('prompt <= 150');
    expect(result.expected).toContain('completion <= 100');
  });

  it('has no details when passing', () => {
    const result = assertions.tokenCount({ prompt: 100, completion: 50 }, { max: 200 });
    expect(result.details).toBeUndefined();
  });

  it('handles edge case: prompt at boundary', () => {
    const result = assertions.tokenCount({ prompt: 150, completion: 50 }, { maxPrompt: 150 });
    expect(result.passed).toBe(true);
  });

  it('handles edge case: completion at boundary', () => {
    const result = assertions.tokenCount({ prompt: 100, completion: 100 }, { maxCompletion: 100 });
    expect(result.passed).toBe(true);
  });

  it('handles edge case: total at boundary', () => {
    const result = assertions.tokenCount({ prompt: 100, completion: 100 }, { max: 200 });
    expect(result.passed).toBe(true);
  });

  it('fails when only one of multiple limits is exceeded', () => {
    const result = assertions.tokenCount(
      { prompt: 200, completion: 50 },
      { max: 300, maxPrompt: 150 },
    );
    expect(result.passed).toBe(false);
    expect(result.details).toContain('prompt tokens');
  });
});
