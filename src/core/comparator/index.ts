import type { AssertionResult, ComparisonResult, Expectation } from '../../types/index.js';
import { runStructuralAssertions } from './assertions.js';
import type { EmbeddingCache, EmbeddingFetcher } from './embedding.js';
import { computeSemanticSimilarity } from './embedding.js';

export { runStructuralAssertions } from './assertions.js';
export {
  cosineSimilarity,
  contentHash,
  EmbeddingCache,
  OpenAIEmbeddingFetcher,
  computeSemanticSimilarity,
} from './embedding.js';
export type { EmbeddingFetcher } from './embedding.js';

export interface CompareOptions {
  /** The LLM response text to evaluate */
  response: string;
  /** Expectation rules from the test case */
  expectations: Expectation;
  /** Embedding fetcher for semantic similarity (optional) */
  embeddingFetcher?: EmbeddingFetcher;
  /** Embedding cache (optional) */
  embeddingCache?: EmbeddingCache;
  /** Historical similarity scores for drift detection */
  historicalScores?: number[];
}

/**
 * Run the full comparison pipeline:
 * 1. Structural assertions (must_contain, max_length, format, etc.)
 * 2. Semantic similarity (if baseline is configured)
 * 3. Drift detection (if historical scores are provided)
 */
export async function compareResponse(options: CompareOptions): Promise<ComparisonResult> {
  const { response, expectations, embeddingFetcher, embeddingCache, historicalScores } = options;

  // Layer 1: Structural assertions
  const assertions = runStructuralAssertions(response, expectations);

  // Layer 2: Semantic similarity
  let semanticScore: number | undefined;
  if (expectations.semantic_similarity && embeddingFetcher) {
    try {
      semanticScore = await computeSemanticSimilarity(
        response,
        expectations.semantic_similarity.baseline,
        embeddingFetcher,
        embeddingCache,
      );

      const threshold = expectations.semantic_similarity.threshold;
      assertions.push({
        type: 'semantic_similarity',
        passed: semanticScore >= threshold,
        expected: `>= ${String(threshold)}`,
        actual: semanticScore.toFixed(4),
        details:
          semanticScore >= threshold
            ? undefined
            : `Semantic similarity ${semanticScore.toFixed(4)} is below threshold ${String(threshold)}`,
      });
    } catch (error) {
      assertions.push({
        type: 'embedding_error',
        passed: true,
        expected: 'embedding comparison',
        actual: 'skipped',
        details: `Embedding unavailable (warning): ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  // Layer 3: Drift detection (compare against historical average)
  if (semanticScore !== undefined && historicalScores && historicalScores.length > 0) {
    const driftResult = detectDrift(semanticScore, historicalScores);
    assertions.push(driftResult);
  }

  const failedAssertions = assertions.filter((a) => !a.passed);
  const hasEmbeddingError = assertions.some((a) => a.type === 'embedding_error');
  const severity = determineSeverity(failedAssertions, semanticScore, hasEmbeddingError);

  return {
    passed: failedAssertions.length === 0,
    severity,
    assertions,
    semantic_score: semanticScore,
    details: buildDetails(failedAssertions, hasEmbeddingError),
  };
}

/**
 * Detect drift by comparing current score against historical moving average.
 * A significant drop from the historical baseline indicates drift.
 */
function detectDrift(currentScore: number, historicalScores: number[]): AssertionResult {
  const avg = historicalScores.reduce((sum, s) => sum + s, 0) / historicalScores.length;
  const stdDev = Math.sqrt(
    historicalScores.reduce((sum, s) => sum + (s - avg) ** 2, 0) / historicalScores.length,
  );

  // Drift detected if current score is more than 2 standard deviations below average
  // or more than 10% below the average (whichever is more lenient)
  const threshold = Math.min(avg - 2 * stdDev, avg * 0.9);
  const drifted = currentScore < threshold;

  return {
    type: 'drift_detection',
    passed: !drifted,
    expected: `>= ${threshold.toFixed(4)} (historical avg: ${avg.toFixed(4)})`,
    actual: currentScore.toFixed(4),
    details: drifted
      ? `Score dropped significantly from historical average ${avg.toFixed(4)} to ${currentScore.toFixed(4)}`
      : undefined,
  };
}

function determineSeverity(
  failedAssertions: AssertionResult[],
  semanticScore?: number,
  hasEmbeddingError = false,
): 'pass' | 'warning' | 'critical' {
  if (failedAssertions.length === 0) {
    return hasEmbeddingError ? 'warning' : 'pass';
  }

  const hasStructuralFailure = failedAssertions.some(
    (a) => a.type !== 'semantic_similarity' && a.type !== 'drift_detection',
  );
  if (hasStructuralFailure) return 'critical';

  if (semanticScore !== undefined && semanticScore < 0.5) return 'critical';

  return 'warning';
}

function buildDetails(failedAssertions: AssertionResult[], hasEmbeddingError = false): string {
  if (failedAssertions.length === 0) {
    return hasEmbeddingError
      ? 'All checks passed (embedding service unavailable)'
      : 'All checks passed';
  }

  return failedAssertions
    .map((a) => `[${a.type}] ${a.details ?? `Expected ${a.expected}, got ${a.actual}`}`)
    .join('; ');
}
