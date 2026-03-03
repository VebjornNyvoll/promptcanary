import { describe, it, expect } from 'vitest';
import { compareResponse } from '../../../src/core/comparator/index.js';
import type { EmbeddingFetcher } from '../../../src/core/comparator/index.js';

const mockFetcher: EmbeddingFetcher = {
  fetchEmbedding(text: string): Promise<number[]> {
    // Return normalized vectors that produce predictable similarity
    if (text.includes('baseline')) return Promise.resolve([0.8, 0.6, 0.0]);
    return Promise.resolve([0.75, 0.65, 0.05]); // slightly different = high similarity
  },
};

describe('compareResponse', () => {
  it('passes with matching structural assertions', async () => {
    const result = await compareResponse({
      response: '- Hello World\n- Item two',
      expectations: {
        max_length: 100,
        must_contain: ['hello'],
        format: 'bullet_points',
      },
    });

    expect(result.passed).toBe(true);
    expect(result.severity).toBe('pass');
    expect(result.assertions.length).toBeGreaterThan(0);
    expect(result.details).toBe('All checks passed');
  });

  it('fails with structural assertion failure', async () => {
    const result = await compareResponse({
      response: 'Short',
      expectations: {
        min_length: 100,
        must_contain: ['missing'],
      },
    });

    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('runs semantic similarity when configured', async () => {
    const result = await compareResponse({
      response: 'Some response text',
      expectations: {
        semantic_similarity: {
          baseline: 'baseline text here',
          threshold: 0.5,
        },
      },
      embeddingFetcher: mockFetcher,
    });

    expect(result.semantic_score).toBeDefined();
    expect(result.assertions.some((a) => a.type === 'semantic_similarity')).toBe(true);
  });

  it('skips semantic similarity without fetcher', async () => {
    const result = await compareResponse({
      response: 'Some response',
      expectations: {
        semantic_similarity: {
          baseline: 'baseline',
          threshold: 0.8,
        },
      },
      // No embeddingFetcher provided
    });

    expect(result.semantic_score).toBeUndefined();
    expect(result.assertions.some((a) => a.type === 'semantic_similarity')).toBe(false);
  });

  it('treats embedding errors as warnings, not failures', async () => {
    const failingFetcher: EmbeddingFetcher = {
      fetchEmbedding(): Promise<number[]> {
        return Promise.reject(new Error('API error'));
      },
    };

    const result = await compareResponse({
      response: 'Some response',
      expectations: {
        semantic_similarity: {
          baseline: 'baseline',
          threshold: 0.8,
        },
      },
      embeddingFetcher: failingFetcher,
    });

    expect(result.passed).toBe(true);
    expect(result.severity).toBe('warning');
    const embeddingAssertion = result.assertions.find((a) => a.type === 'embedding_error');
    expect(embeddingAssertion?.passed).toBe(true);
    expect(embeddingAssertion?.details).toContain('API error');
  });

  it('preserves structural results when embedding fails', async () => {
    const failingFetcher: EmbeddingFetcher = {
      fetchEmbedding(): Promise<number[]> {
        return Promise.reject(new Error('service down'));
      },
    };

    const result = await compareResponse({
      response: '- Hello World\n- Another item',
      expectations: {
        must_contain: ['hello'],
        format: 'bullet_points',
        semantic_similarity: {
          baseline: 'baseline',
          threshold: 0.8,
        },
      },
      embeddingFetcher: failingFetcher,
    });

    expect(result.passed).toBe(true);
    expect(result.severity).toBe('warning');

    const structuralAssertions = result.assertions.filter((a) => a.type !== 'embedding_error');
    expect(structuralAssertions.every((a) => a.passed)).toBe(true);
    expect(result.assertions.some((a) => a.type === 'embedding_error')).toBe(true);
  });

  it('runs drift detection with historical scores', async () => {
    const result = await compareResponse({
      response: 'Some response text',
      expectations: {
        semantic_similarity: {
          baseline: 'baseline text here',
          threshold: 0.5,
        },
      },
      embeddingFetcher: mockFetcher,
      historicalScores: [0.95, 0.93, 0.94, 0.92],
    });

    expect(result.assertions.some((a) => a.type === 'drift_detection')).toBe(true);
  });

  it('classifies severity as warning for semantic-only failures', async () => {
    const lowSimFetcher: EmbeddingFetcher = {
      fetchEmbedding(text: string): Promise<number[]> {
        if (text.includes('baseline')) return Promise.resolve([1, 0, 0]);
        return Promise.resolve([0.5, 0.5, 0.5]); // moderate similarity
      },
    };

    const result = await compareResponse({
      response: 'Different response',
      expectations: {
        semantic_similarity: {
          baseline: 'baseline text',
          threshold: 0.95, // Very high threshold that will fail
        },
      },
      embeddingFetcher: lowSimFetcher,
    });

    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
  });

  it('returns empty assertions for empty expectations', async () => {
    const result = await compareResponse({
      response: 'anything',
      expectations: {},
    });

    expect(result.passed).toBe(true);
    expect(result.assertions).toHaveLength(0);
  });
});
