export const VERSION = '0.1.0';

// Schema exports
export {
  ProviderConfigSchema,
  SemanticSimilaritySchema,
  ResponseFormatSchema,
  ExpectationSchema,
  TestCaseSchema,
  AlertConfigSchema,
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
  AlertConfig,
  PromptCanaryConfig,
  LLMResponse,
  RunResult,
  AssertionResult,
  ComparisonResult,
  AlertPayload,
  AlertChannel,
} from './types/index.js';

export { ProviderError, TimeoutError, RateLimitError, ConfigError } from './types/index.js';
