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
        { type: 'max_length', value: 100 },
        { type: 'min_length', value: 5 },
        { type: 'regex', value: '\\d+' },
        { type: 'is_json', value: '' },
        { type: 'json_schema', value: { status: 'string', count: 'number' } },
      ];
      const result = assertions.runAll(content, descriptors);
      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(7);
    });

    it('returns empty results for empty descriptors', () => {
      const result = assertions.runAll('any content', []);
      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(0);
    });
  });
});
