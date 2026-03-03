import { createHash } from 'node:crypto';
import { ProviderError } from '../../types/index.js';

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1 (typically 0-1 for normalized embeddings).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${String(a.length)} vs ${String(b.length)}`,
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Content hash for embedding cache lookups.
 */
export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Embedding cache — stores embeddings in memory with content hash keys.
 * Can be backed by SQLite storage for persistence.
 */
export class EmbeddingCache {
  private cache = new Map<string, number[]>();

  get(text: string): number[] | undefined {
    return this.cache.get(contentHash(text));
  }

  set(text: string, embedding: number[]): void {
    this.cache.set(contentHash(text), embedding);
  }

  has(text: string): boolean {
    return this.cache.has(contentHash(text));
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Fetch an embedding from OpenAI's API.
 * In production this calls the real API; in tests, inject a mock fetcher.
 */
export interface EmbeddingFetcher {
  fetchEmbedding(text: string): Promise<number[]>;
}

export class OpenAIEmbeddingFetcher implements EmbeddingFetcher {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKeyEnv: string, model = 'text-embedding-3-small') {
    const key = process.env[apiKeyEnv];
    if (!key) {
      throw new ProviderError(
        `Missing API key: environment variable ${apiKeyEnv} is not set`,
        'embedding',
      );
    }
    this.apiKey = key;
    this.model = model;
  }

  async fetchEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: this.model,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ProviderError(
        `Embedding API error (${String(response.status)}): ${errorText}`,
        'embedding',
      );
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return data.data[0].embedding;
  }
}

/**
 * Get embeddings for two texts and compute their similarity.
 * Uses the cache to avoid redundant API calls.
 */
export async function computeSemanticSimilarity(
  response: string,
  baseline: string,
  fetcher: EmbeddingFetcher,
  cache?: EmbeddingCache,
): Promise<number> {
  const [responseEmbedding, baselineEmbedding] = await Promise.all([
    getOrFetchEmbedding(response, fetcher, cache),
    getOrFetchEmbedding(baseline, fetcher, cache),
  ]);

  return cosineSimilarity(responseEmbedding, baselineEmbedding);
}

async function getOrFetchEmbedding(
  text: string,
  fetcher: EmbeddingFetcher,
  cache?: EmbeddingCache,
): Promise<number[]> {
  if (cache) {
    const cached = cache.get(text);
    if (cached) return cached;
  }

  const embedding = await fetcher.fetchEmbedding(text);

  if (cache) {
    cache.set(text, embedding);
  }

  return embedding;
}
