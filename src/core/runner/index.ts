import { randomUUID } from 'node:crypto';
import type {
  ComparisonResult,
  ErrorType,
  LLMResponse,
  PromptCanaryConfig,
  ProviderConfig,
  RunResult,
} from '../../types/index.js';
import { ProviderError, RateLimitError, TimeoutError } from '../../types/index.js';
import { createProvider } from './providers/base.js';

export interface RunTestsOptions {
  config: PromptCanaryConfig;
  onProgress?: (result: RunResult) => void;
}

export async function runTests(options: RunTestsOptions): Promise<RunResult[]> {
  const results: RunResult[] = [];

  for (const testCase of options.config.tests) {
    const providerNames = testCase.providers ?? options.config.config.providers.map((p) => p.name);

    const providerRuns = providerNames.map((providerName) => {
      const providerConfig = options.config.config.providers.find((p) => p.name === providerName);

      return runProviderTest(
        testCase.name,
        testCase.prompt,
        providerName,
        providerConfig,
        options.onProgress,
      );
    });

    const settled = await Promise.allSettled(providerRuns);

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else if (result.reason instanceof ProviderRunFailure) {
        results.push(result.reason.result);
      } else {
        results.push(
          fallbackFailedResult(testCase.name, 'unknown', 'unknown', getErrorMessage(result.reason)),
        );
      }
    }
  }

  return results;
}

async function runProviderTest(
  testName: string,
  prompt: string,
  providerName: string,
  providerConfig: ProviderConfig | undefined,
  onProgress?: (result: RunResult) => void,
): Promise<RunResult> {
  try {
    if (!providerConfig) {
      throw new Error(`Provider config not found for: ${providerName}`);
    }

    const provider = createProvider(providerConfig);
    const response = await provider.execute(prompt, providerConfig);

    const result: RunResult = {
      test_name: testName,
      provider: providerName,
      model: providerConfig.model,
      response,
      comparison: pendingComparison(),
      run_id: randomUUID(),
    };

    onProgress?.(result);
    return result;
  } catch (error: unknown) {
    const result: RunResult = {
      test_name: testName,
      provider: providerName,
      model: providerConfig?.model ?? 'unknown',
      response: errorResponse(providerName, providerConfig?.model ?? 'unknown', error),
      comparison: {
        passed: false,
        severity: 'critical',
        assertions: [],
        details: getErrorMessage(error),
      },
      run_id: randomUUID(),
    };

    onProgress?.(result);
    throw new ProviderRunFailure(result);
  }
}

class ProviderRunFailure extends Error {
  public readonly result: RunResult;

  public constructor(result: RunResult) {
    super(result.comparison.details);
    this.name = 'ProviderRunFailure';
    this.result = result;
  }
}

function pendingComparison(): ComparisonResult {
  return {
    passed: true,
    severity: 'pass',
    assertions: [],
    details: 'pending',
  };
}

function classifyError(error: unknown): { error_type: ErrorType; retry_after_ms?: number } {
  if (error instanceof RateLimitError) {
    return { error_type: 'rate_limit', retry_after_ms: error.retry_after_ms };
  }
  if (error instanceof TimeoutError) {
    return { error_type: 'timeout' };
  }
  if (error instanceof ProviderError) {
    const msg = error.message.toLowerCase();
    if (msg.includes('auth') || msg.includes('api key') || msg.includes('401')) {
      return { error_type: 'auth' };
    }
    return { error_type: 'provider' };
  }
  return { error_type: 'unknown' };
}

function errorResponse(provider: string, model: string, error: unknown): LLMResponse {
  const { error_type, retry_after_ms } = classifyError(error);
  return {
    content: `Provider execution failed: ${getErrorMessage(error)}`,
    model,
    provider,
    latency_ms: 0,
    token_usage: {
      prompt: 0,
      completion: 0,
    },
    timestamp: new Date(),
    error_type,
    retry_after_ms,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function fallbackFailedResult(
  testName: string,
  provider: string,
  model: string,
  details: string,
): RunResult {
  return {
    test_name: testName,
    provider,
    model,
    response: {
      content: `Provider execution failed: ${details}`,
      model,
      provider,
      latency_ms: 0,
      token_usage: {
        prompt: 0,
        completion: 0,
      },
      timestamp: new Date(),
    },
    comparison: {
      passed: false,
      severity: 'critical',
      assertions: [],
      details,
    },
    run_id: randomUUID(),
  };
}
