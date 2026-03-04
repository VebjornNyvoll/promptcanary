import { computeSemanticSimilarity, OpenAIEmbeddingFetcher } from '../core/comparator/embedding.js';
import type { SemanticSimilarityOptions } from '../types/index.js';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_API_KEY_ENV = 'OPENAI_API_KEY';

export async function semanticSimilarity(
  actual: string,
  expected: string,
  options?: SemanticSimilarityOptions,
): Promise<number> {
  const model = options?.model ?? DEFAULT_MODEL;
  const apiKeyEnv = DEFAULT_API_KEY_ENV;

  const previousKey = process.env[apiKeyEnv];
  if (options?.apiKey) {
    process.env[apiKeyEnv] = options.apiKey;
  }

  try {
    const fetcher = new OpenAIEmbeddingFetcher(apiKeyEnv, model);
    return await computeSemanticSimilarity(actual, expected, fetcher);
  } finally {
    if (options?.apiKey) {
      if (previousKey === undefined) {
        Reflect.deleteProperty(process.env, apiKeyEnv);
      } else {
        process.env[apiKeyEnv] = previousKey;
      }
    }
  }
}
