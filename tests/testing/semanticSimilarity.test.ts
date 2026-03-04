import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetchEmbedding = vi.fn();
const constructorCalls: Array<{ apiKeyEnv: string; model: string }> = [];

vi.mock('../../src/core/comparator/embedding.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/comparator/embedding.js')>();
  return {
    ...actual,
    OpenAIEmbeddingFetcher: class MockEmbeddingFetcher {
      constructor(apiKeyEnv: string, model: string) {
        if (!process.env[apiKeyEnv]) {
          throw new Error(`Missing API key: environment variable ${apiKeyEnv} is not set`);
        }
        constructorCalls.push({ apiKeyEnv, model });
      }
      fetchEmbedding = mockFetchEmbedding;
    },
  };
});

import { semanticSimilarity } from '../../src/testing/semanticSimilarity.js';

const MOCK_EMBEDDING_A = [0.6, 0.8, 0.0];
const MOCK_EMBEDDING_B = [0.8, 0.6, 0.0];

describe('semanticSimilarity', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env['OPENAI_API_KEY'];
    process.env['OPENAI_API_KEY'] = 'test-key-123';
    mockFetchEmbedding.mockReset();
    constructorCalls.length = 0;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env['OPENAI_API_KEY'];
    } else {
      process.env['OPENAI_API_KEY'] = originalKey;
    }
  });

  it('computes cosine similarity between two strings', async () => {
    mockFetchEmbedding
      .mockResolvedValueOnce(MOCK_EMBEDDING_A)
      .mockResolvedValueOnce(MOCK_EMBEDDING_B);

    const score = await semanticSimilarity('text a', 'text b');

    expect(score).toBeCloseTo(0.96, 2);
    expect(mockFetchEmbedding).toHaveBeenCalledTimes(2);
  });

  it('returns 1.0 for identical embeddings', async () => {
    mockFetchEmbedding
      .mockResolvedValueOnce(MOCK_EMBEDDING_A)
      .mockResolvedValueOnce(MOCK_EMBEDDING_A);

    const score = await semanticSimilarity('same', 'same');

    expect(score).toBeCloseTo(1.0, 5);
  });

  it('uses default model text-embedding-3-small', async () => {
    mockFetchEmbedding
      .mockResolvedValueOnce(MOCK_EMBEDDING_A)
      .mockResolvedValueOnce(MOCK_EMBEDDING_B);

    await semanticSimilarity('a', 'b');

    expect(constructorCalls[0].model).toBe('text-embedding-3-small');
  });

  it('accepts custom model override', async () => {
    mockFetchEmbedding
      .mockResolvedValueOnce(MOCK_EMBEDDING_A)
      .mockResolvedValueOnce(MOCK_EMBEDDING_B);

    await semanticSimilarity('a', 'b', { model: 'text-embedding-3-large' });

    expect(constructorCalls[0].model).toBe('text-embedding-3-large');
  });

  it('uses explicit apiKey and restores env afterwards', async () => {
    mockFetchEmbedding
      .mockResolvedValueOnce(MOCK_EMBEDDING_A)
      .mockResolvedValueOnce(MOCK_EMBEDDING_B);

    const keyBefore = process.env['OPENAI_API_KEY'];
    await semanticSimilarity('a', 'b', { apiKey: 'explicit-key' });
    const keyAfter = process.env['OPENAI_API_KEY'];

    expect(keyAfter).toBe(keyBefore);
  });

  it('restores env even when fetch fails', async () => {
    mockFetchEmbedding.mockRejectedValueOnce(new Error('API down'));

    const keyBefore = process.env['OPENAI_API_KEY'];
    await expect(semanticSimilarity('a', 'b', { apiKey: 'temp-key' })).rejects.toThrow('API down');
    const keyAfter = process.env['OPENAI_API_KEY'];

    expect(keyAfter).toBe(keyBefore);
  });

  it('throws when OPENAI_API_KEY is missing and no explicit key given', async () => {
    delete process.env['OPENAI_API_KEY'];

    await expect(semanticSimilarity('a', 'b')).rejects.toThrow('Missing API key');
  });
});
