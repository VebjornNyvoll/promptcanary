import { describe, it, expect } from 'vitest';
import { runStructuralAssertions } from '../../../src/core/comparator/assertions.js';

describe('runStructuralAssertions', () => {
  describe('max_length', () => {
    it('passes when within limit', () => {
      const results = runStructuralAssertions('hello', { max_length: 10 });
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('max_length');
      expect(results[0].passed).toBe(true);
    });

    it('fails when exceeding limit', () => {
      const results = runStructuralAssertions('hello world', { max_length: 5 });
      expect(results[0].passed).toBe(false);
      expect(results[0].details).toContain('exceeds');
    });

    it('passes at exact limit', () => {
      const results = runStructuralAssertions('hello', { max_length: 5 });
      expect(results[0].passed).toBe(true);
    });
  });

  describe('min_length', () => {
    it('passes when above minimum', () => {
      const results = runStructuralAssertions('hello world', { min_length: 5 });
      expect(results[0].passed).toBe(true);
    });

    it('fails when below minimum', () => {
      const results = runStructuralAssertions('hi', { min_length: 5 });
      expect(results[0].passed).toBe(false);
    });
  });

  describe('must_contain', () => {
    it('passes when all terms found', () => {
      const results = runStructuralAssertions('Hello World Foo', {
        must_contain: ['hello', 'world'],
      });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('is case-insensitive', () => {
      const results = runStructuralAssertions('Hello WORLD', {
        must_contain: ['hello', 'world'],
      });
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('fails when term missing', () => {
      const results = runStructuralAssertions('Hello World', {
        must_contain: ['hello', 'missing'],
      });
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(false);
    });
  });

  describe('must_not_contain', () => {
    it('passes when no forbidden terms found', () => {
      const results = runStructuralAssertions('Hello World', {
        must_not_contain: ['error', 'sorry'],
      });
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('fails when forbidden term found', () => {
      const results = runStructuralAssertions("I'm sorry, I can't do that", {
        must_not_contain: ['sorry'],
      });
      expect(results[0].passed).toBe(false);
    });
  });

  describe('format', () => {
    it('detects bullet points', () => {
      const response = '- First item\n- Second item\n- Third item';
      const results = runStructuralAssertions(response, { format: 'bullet_points' });
      expect(results[0].passed).toBe(true);
    });

    it('detects numbered list', () => {
      const response = '1. First item\n2. Second item\n3. Third item';
      const results = runStructuralAssertions(response, { format: 'numbered_list' });
      expect(results[0].passed).toBe(true);
    });

    it('detects JSON', () => {
      const response = '{"name": "test", "value": 42}';
      const results = runStructuralAssertions(response, { format: 'json' });
      expect(results[0].passed).toBe(true);
    });

    it('detects JSON in code blocks', () => {
      const response = '```json\n{"name": "test"}\n```';
      const results = runStructuralAssertions(response, { format: 'json' });
      expect(results[0].passed).toBe(true);
    });

    it('detects markdown', () => {
      const response = '# Title\n\nSome **bold** text\n\n```code```';
      const results = runStructuralAssertions(response, { format: 'markdown' });
      expect(results[0].passed).toBe(true);
    });

    it('plain_text always passes', () => {
      const results = runStructuralAssertions('anything at all', { format: 'plain_text' });
      expect(results[0].passed).toBe(true);
    });

    it('fails when format does not match', () => {
      const response = 'Just some plain text without any bullet points.';
      const results = runStructuralAssertions(response, { format: 'bullet_points' });
      expect(results[0].passed).toBe(false);
    });
  });

  describe('combined assertions', () => {
    it('runs multiple assertion types', () => {
      const results = runStructuralAssertions('- Hello World\n- Item two', {
        max_length: 100,
        min_length: 5,
        must_contain: ['hello'],
        must_not_contain: ['error'],
        format: 'bullet_points',
      });
      // max_length + min_length + must_contain(1) + must_not_contain(1) + format = 5
      expect(results).toHaveLength(5);
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('returns empty array for empty expectations', () => {
      const results = runStructuralAssertions('anything', {});
      expect(results).toHaveLength(0);
    });
  });
});
