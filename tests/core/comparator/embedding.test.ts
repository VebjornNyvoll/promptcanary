import { describe, it, expect, vi } from 'vitest';
import {
  cosineSimilarity,
  contentHash,
  EmbeddingCache,
  computeSemanticSimilarity,
  OpenAIEmbeddingFetcher,
} from '../../../src/core/comparator/embedding.js';
import type {
  EmbeddingFetcher,
  EmbeddingCacheBacking,
} from '../../../src/core/comparator/embedding.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 10);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 10);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0, 10);
  });

  it('handles normalized vectors', () => {
    const a = [0.6, 0.8]; // normalized
    const b = [0.8, 0.6]; // normalized
    const expected = 0.6 * 0.8 + 0.8 * 0.6; // = 0.96
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 10);
  });

  it('returns 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it('throws for mismatched dimensions', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('dimension mismatch');
  });
});

describe('contentHash', () => {
  it('returns consistent hash for same text', () => {
    const hash1 = contentHash('hello world');
    const hash2 = contentHash('hello world');
    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different text', () => {
    expect(contentHash('hello')).not.toBe(contentHash('world'));
  });

  it('returns a hex string', () => {
    expect(contentHash('test')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('EmbeddingCache', () => {
  it('stores and retrieves embeddings', () => {
    const cache = new EmbeddingCache();
    cache.set('hello', [1, 2, 3]);
    expect(cache.get('hello')).toEqual([1, 2, 3]);
  });

  it('returns undefined for missing entries', () => {
    const cache = new EmbeddingCache();
    expect(cache.get('missing')).toBeUndefined();
  });

  it('checks existence', () => {
    const cache = new EmbeddingCache();
    cache.set('hello', [1, 2, 3]);
    expect(cache.has('hello')).toBe(true);
    expect(cache.has('missing')).toBe(false);
  });

  it('tracks size', () => {
    const cache = new EmbeddingCache();
    expect(cache.size).toBe(0);
    cache.set('a', [1]);
    cache.set('b', [2]);
    expect(cache.size).toBe(2);
  });

  it('clears all entries', () => {
    const cache = new EmbeddingCache();
    cache.set('a', [1]);
    cache.set('b', [2]);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('falls back to backing store on memory miss', () => {
    const backing: EmbeddingCacheBacking = {
      getCachedEmbedding: vi.fn().mockReturnValue([4, 5, 6]),
      cacheEmbedding: vi.fn(),
    };

    const cache = new EmbeddingCache(backing);
    const result = cache.get('persisted-text');
    expect(result).toEqual([4, 5, 6]);
    expect(backing.getCachedEmbedding).toHaveBeenCalledOnce();
  });

  it('writes through to backing store on set', () => {
    const backing: EmbeddingCacheBacking = {
      getCachedEmbedding: vi.fn(),
      cacheEmbedding: vi.fn(),
    };

    const cache = new EmbeddingCache(backing, 'test-model');
    cache.set('new-text', [7, 8, 9]);
    expect(backing.cacheEmbedding).toHaveBeenCalledOnce();
    expect(backing.cacheEmbedding).toHaveBeenCalledWith(
      contentHash('new-text'),
      [7, 8, 9],
      'test-model',
    );
  });

  it('promotes backing store hit to memory', () => {
    const backing: EmbeddingCacheBacking = {
      getCachedEmbedding: vi.fn().mockReturnValueOnce([1, 2, 3]).mockReturnValue(undefined),
      cacheEmbedding: vi.fn(),
    };

    const cache = new EmbeddingCache(backing);
    cache.get('text');
    cache.get('text');
    expect(backing.getCachedEmbedding).toHaveBeenCalledTimes(1);
  });
});

describe('computeSemanticSimilarity', () => {
  const mockFetcher: EmbeddingFetcher = {
    fetchEmbedding(text: string): Promise<number[]> {
      // Return deterministic embeddings based on text
      if (text.includes('similar')) return Promise.resolve([0.9, 0.1, 0.0]);
      if (text.includes('different')) return Promise.resolve([0.0, 0.1, 0.9]);
      return Promise.resolve([0.5, 0.5, 0.5]);
    },
  };

  it('returns high similarity for similar texts', async () => {
    const score = await computeSemanticSimilarity('similar A', 'similar B', mockFetcher);
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('returns low similarity for different texts', async () => {
    const score = await computeSemanticSimilarity('similar text', 'different text', mockFetcher);
    expect(score).toBeLessThan(0.5);
  });

  it('uses cache when available', async () => {
    let fetchCount = 0;
    const countingFetcher: EmbeddingFetcher = {
      fetchEmbedding(text: string): Promise<number[]> {
        fetchCount++;
        return Promise.resolve(text.includes('a') ? [1, 0] : [0, 1]);
      },
    };

    const cache = new EmbeddingCache();
    await computeSemanticSimilarity('text_a', 'text_b', countingFetcher, cache);
    expect(fetchCount).toBe(2);

    // Second call should use cache
    fetchCount = 0;
    await computeSemanticSimilarity('text_a', 'text_b', countingFetcher, cache);
    expect(fetchCount).toBe(0);
  });
});

describe('OpenAIEmbeddingFetcher', () => {
  it('throws when API key env var is not set', () => {
    expect(() => new OpenAIEmbeddingFetcher('NONEXISTENT_KEY_FOR_TEST')).toThrow('Missing API key');
  });

  it('passes AbortSignal.timeout to fetch', async () => {
    vi.stubEnv('TEST_EMBEDDING_KEY', 'sk-test');

    const fetcher = new OpenAIEmbeddingFetcher('TEST_EMBEDDING_KEY', 'text-embedding-3-small', 50);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_url: string | URL | Request, init?: RequestInit) => {
        expect(init?.signal).toBeDefined();
        expect(init?.signal?.aborted).toBe(false);
        return new Response(JSON.stringify({ data: [{ embedding: [1, 2, 3] }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

    const result = await fetcher.fetchEmbedding('hello');
    expect(result).toEqual([1, 2, 3]);
    expect(fetchSpy).toHaveBeenCalledOnce();

    fetchSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('aborts when timeout expires', async () => {
    vi.stubEnv('TEST_EMBEDDING_KEY', 'sk-test');

    const fetcher = new OpenAIEmbeddingFetcher('TEST_EMBEDDING_KEY', 'text-embedding-3-small', 10);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_url: string | URL | Request, init?: RequestInit) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 5000);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(init.signal?.reason as Error);
          });
        });
        return new Response('{}', { status: 200 });
      });

    await expect(fetcher.fetchEmbedding('hello')).rejects.toThrow();

    fetchSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});
