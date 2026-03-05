export const VERSION = '1.1.0';

// Schema exports
export {
  ProviderConfigSchema,
  SemanticSimilaritySchema,
  ResponseFormatSchema,
  ExpectationSchema,
  TestCaseSchema,
  PromptCanaryConfigSchema,
} from './schema/test-case.js';

// Loader exports
export { loadConfig, validateConfig, interpolateVariables } from './schema/loader.js';

// Type exports
export type {
  ProviderConfig,
  SemanticSimilarity,
  Expectation,
  TestCase,
  PromptCanaryConfig,
  LLMResponse,
  RunResult,
  AssertionResult,
  ComparisonResult,
  TestPromptOptions,
  TestPromptResult,
  ChatMessage,
  SemanticSimilarityOptions,
  JudgeOptions,
  JudgeResult,
  LlmRubricOptions,
  FactualityOptions,
  AnswerRelevanceOptions,
  FaithfulnessOptions,
  ToxicityOptions,
  TestPromptMultiOptions,
  MultiRunResult,
  MultiRunAssertionResult,
  CompareModelsModelConfig,
  CompareModelsOptions,
  ModelComparisonResult,
  CompareModelsResult,
  LevenshteinOptions,
  Rouge1Options,
  BleuOptions,
} from './types/index.js';

export { ProviderError, TimeoutError, RateLimitError, ConfigError } from './types/index.js';

// Core exports
export { runTests } from './core/runner/index.js';
export { compareResponse } from './core/comparator/index.js';
// Storage exports
export { Storage } from './storage/index.js';

export { testPrompt, testPromptMulti } from './testing/testPrompt.js';
export { compareModels } from './testing/compareModels.js';
export { ResponseCache } from './testing/responseCache.js';
export { semanticSimilarity } from './testing/semanticSimilarity.js';
export { assertions } from './testing/assertions.js';
export type { AssertionDescriptor, RunAllResult } from './testing/assertions.js';
export { judge, parseJudgeResponse, callJudge } from './testing/judge/index.js';
export {
  buildCriteriaPrompt,
  buildRubricPrompt,
  buildFactualityPrompt,
  buildAnswerRelevancePrompt,
  buildFaithfulnessPrompt,
  buildToxicityPrompt,
} from './testing/judge/templates.js';
