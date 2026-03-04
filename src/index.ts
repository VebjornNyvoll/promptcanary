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
  TestPromptOptions,
  TestPromptResult,
  ChatMessage,
  SemanticSimilarityOptions,
} from './types/index.js';

export { ProviderError, TimeoutError, RateLimitError, ConfigError } from './types/index.js';

// Core exports
export { runTests } from './core/runner/index.js';
export { compareResponse } from './core/comparator/index.js';
export { startScheduler, executeRun } from './core/scheduler/index.js';
export { dispatchAlerts, createAlertChannels } from './core/alerting/index.js';

// Storage exports
export { Storage } from './storage/index.js';

export { testPrompt } from './testing/testPrompt.js';
export { semanticSimilarity } from './testing/semanticSimilarity.js';
export { assertions } from './testing/assertions.js';
export type { AssertionDescriptor, RunAllResult } from './testing/assertions.js';
