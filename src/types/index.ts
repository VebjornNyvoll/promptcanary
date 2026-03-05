import type { z } from 'zod';
import type {
  ProviderConfigSchema,
  SemanticSimilaritySchema,
  ExpectationSchema,
  TestCaseSchema,
  PromptCanaryConfigSchema,
} from '../schema/test-case.js';

// Inferred types from Zod schemas
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type SemanticSimilarity = z.infer<typeof SemanticSimilaritySchema>;
export type Expectation = z.infer<typeof ExpectationSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type PromptCanaryConfig = z.infer<typeof PromptCanaryConfigSchema>;

// Runtime types (not schema-derived)
export type ErrorType = 'rate_limit' | 'timeout' | 'auth' | 'provider' | 'unknown';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TestPromptOptions {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  messages: ChatMessage[];
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  cache?: boolean;
  cacheTtl?: number;
}

export interface TestPromptResult {
  content: string;
  model: string;
  provider: string;
  latencyMs: number;
  tokenUsage: {
    prompt: number;
    completion: number;
  };
  cached?: boolean;
}

export interface SemanticSimilarityOptions {
  model?: string;
  apiKey?: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  latency_ms: number;
  token_usage: {
    prompt: number;
    completion: number;
  };
  timestamp: Date;
  error_type?: ErrorType;
  retry_after_ms?: number;
}

export interface RunResult {
  test_name: string;
  provider: string;
  model: string;
  response: LLMResponse;
  comparison: ComparisonResult;
  run_id: string;
}

export interface AssertionResult {
  type: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
  score?: number;
}

export interface ComparisonResult {
  passed: boolean;
  severity: 'pass' | 'warning' | 'critical';
  assertions: AssertionResult[];
  semantic_score?: number;
  details: string;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class TimeoutError extends ProviderError {
  constructor(provider: string, timeout_ms: number) {
    super(`Provider ${provider} timed out after ${String(timeout_ms)}ms`, provider);
    this.name = 'TimeoutError';
  }
}

export class RateLimitError extends ProviderError {
  constructor(
    provider: string,
    public retry_after_ms?: number,
  ) {
    super(`Provider ${provider} rate limited`, provider);
    this.name = 'RateLimitError';
  }
}

export class ConfigError extends Error {
  constructor(
    message: string,
    public filePath?: string,
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface JudgeOptions {
  provider?: 'openai' | 'anthropic' | 'google';
  model?: string;
  apiKey?: string;
  temperature?: number;
  timeoutMs?: number;
}

export interface JudgeResult {
  score: number;
  pass: boolean;
  reason: string;
}

export interface LlmRubricOptions {
  criteria: string;
  input?: string;
  threshold?: number;
  judge?: JudgeOptions;
}

export interface FactualityOptions {
  input: string;
  expected: string;
  judge?: JudgeOptions;
}

export interface AnswerRelevanceOptions {
  input: string;
  threshold?: number;
  judge?: JudgeOptions;
}

export interface FaithfulnessOptions {
  context: string;
  threshold?: number;
  judge?: JudgeOptions;
}

export interface ToxicityOptions {
  threshold?: number;
  judge?: JudgeOptions;
}

export interface TestPromptMultiOptions extends TestPromptOptions {
  runs: number;
}

export interface MultiRunResult {
  passed: boolean;
  passRate: number;
  totalRuns: number;
  passedRuns: number;
  responses: TestPromptResult[];
  assertionResults: MultiRunAssertionResult[];
}

export interface MultiRunAssertionResult {
  response: TestPromptResult;
  passed: boolean;
  results: AssertionResult[];
}

export interface CompareModelsModelConfig {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  apiKey?: string;
}

export interface CompareModelsOptions {
  models: CompareModelsModelConfig[];
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ModelComparisonResult {
  model: string;
  provider: string;
  response: TestPromptResult;
  passed: boolean;
  results: AssertionResult[];
  regressions: string[];
}

export interface CompareModelsResult {
  results: ModelComparisonResult[];
  regressions: string[];
  baselineModel: string;
}

export interface LevenshteinOptions {
  threshold?: number;
}

export interface Rouge1Options {
  threshold?: number;
}

export interface BleuOptions {
  threshold?: number;
}
