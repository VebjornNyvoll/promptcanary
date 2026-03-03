import type { z } from 'zod';
import type {
  ProviderConfigSchema,
  SemanticSimilaritySchema,
  ExpectationSchema,
  TestCaseSchema,
  AlertConfigSchema,
  PromptCanaryConfigSchema,
} from '../schema/test-case.js';

// Inferred types from Zod schemas
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type SemanticSimilarity = z.infer<typeof SemanticSimilaritySchema>;
export type Expectation = z.infer<typeof ExpectationSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type AlertConfig = z.infer<typeof AlertConfigSchema>;
export type PromptCanaryConfig = z.infer<typeof PromptCanaryConfigSchema>;

// Runtime types (not schema-derived)
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
}

export interface ComparisonResult {
  passed: boolean;
  severity: 'pass' | 'warning' | 'critical';
  assertions: AssertionResult[];
  semantic_score?: number;
  details: string;
}

export interface AlertPayload {
  test_name: string;
  provider: string;
  model: string;
  failure_type: 'assertion' | 'semantic_drift' | 'error';
  details: string;
  severity: 'warning' | 'critical';
  timestamp: Date;
  run_id: string;
}

export interface AlertChannel {
  type: string;
  send(alert: AlertPayload): Promise<void>;
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
