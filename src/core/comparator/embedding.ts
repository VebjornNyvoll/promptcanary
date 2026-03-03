import { createHash } from 'node:crypto';
import { ProviderError } from '../../types/index.js';

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1 (typically 0-1 for normalized embeddings).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${String(a.length)} vs ${String(b.length)}`);
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

export interface EmbeddingCacheBacking {
  getCachedEmbedding(hash: string): number[] | undefined;
  cacheEmbedding(hash: string, embedding: number[], model: string): void;
}

export class EmbeddingCache {
  private cache = new Map<string, number[]>();
  private backing?: EmbeddingCacheBacking;
  private model: string;

  constructor(backing?: EmbeddingCacheBacking, model = 'text-embedding-3-small') {
    this.backing = backing;
    this.model = model;
  }

  get(text: string): number[] | undefined {
    const hash = contentHash(text);
    const memCached = this.cache.get(hash);
    if (memCached) return memCached;

    if (this.backing) {
      const persisted = this.backing.getCachedEmbedding(hash);
      if (persisted) {
        this.cache.set(hash, persisted);
        return persisted;
      }
    }

    return undefined;
  }

  set(text: string, embedding: number[]): void {
    const hash = contentHash(text);
    this.cache.set(hash, embedding);
    this.backing?.cacheEmbedding(hash, embedding, this.model);
  }

  has(text: string): boolean {
    return this.get(text) !== undefined;
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

/** Default timeout for embedding API calls (30 seconds). */
const DEFAULT_EMBEDDING_TIMEOUT_MS = 30_000;

export class OpenAIEmbeddingFetcher implements EmbeddingFetcher {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(
    apiKeyEnv: string,
    model = 'text-embedding-3-small',
    timeoutMs = DEFAULT_EMBEDDING_TIMEOUT_MS,
  ) {
    const key = process.env[apiKeyEnv];
    if (!key) {
      throw new ProviderError(
        `Missing API key: environment variable ${apiKeyEnv} is not set`,
        'embedding',
      );
    }
    this.apiKey = key;
    this.model = model;
    this.timeoutMs = timeoutMs;
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
      signal: AbortSignal.timeout(this.timeoutMs),
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
