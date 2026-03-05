import type {
  AssertionResult,
  MultiRunAssertionResult,
  MultiRunResult,
  ProviderConfig,
  TestPromptMultiOptions,
  TestPromptOptions,
  TestPromptResult,
} from '../types/index.js';
import type { AssertionDescriptor } from './assertions.js';
import { assertions } from './assertions.js';
import { getProvider } from '../core/runner/providers/base.js';
import '../core/runner/providers/openai.js';
import '../core/runner/providers/anthropic.js';
import '../core/runner/providers/google.js';

const DEFAULT_TIMEOUT_MS = 30000;

const providerApiKeyEnvMap: Record<TestPromptOptions['provider'], string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
};

function getLastUserMessageContent(messages: TestPromptOptions['messages']): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      return messages[i].content;
    }
  }

  return '';
}

export async function testPrompt(options: TestPromptOptions): Promise<TestPromptResult> {
  const apiKeyEnv = providerApiKeyEnvMap[options.provider];
  const originalApiKey = process.env[apiKeyEnv];
  const providerConfig: ProviderConfig = {
    name: options.provider,
    model: options.model,
    api_key_env: apiKeyEnv,
    timeout_ms: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
  };

  if (options.apiKey !== undefined) {
    process.env[apiKeyEnv] = options.apiKey;
  }

  try {
    const provider = getProvider(options.provider);
    // Provider execute currently accepts only a single prompt string.
    const prompt = getLastUserMessageContent(options.messages);
    const response = await provider.execute(prompt, providerConfig);

    return {
      content: response.content,
      model: response.model,
      provider: response.provider,
      latencyMs: response.latency_ms,
      tokenUsage: {
        prompt: response.token_usage.prompt,
        completion: response.token_usage.completion,
      },
    };
  } finally {
    if (options.apiKey !== undefined) {
      if (originalApiKey === undefined) {
        Reflect.deleteProperty(process.env, apiKeyEnv);
      } else {
        process.env[apiKeyEnv] = originalApiKey;
      }
    }
  }
}

export async function testPromptMulti(
  options: TestPromptMultiOptions,
  descriptors?: AssertionDescriptor[],
  passRate?: number,
): Promise<MultiRunResult> {
  if (options.runs < 1) {
    throw new Error('runs must be at least 1');
  }

  const effectivePassRate = passRate ?? 1.0;
  const { runs, ...promptOptions } = options;

  const promises: Promise<TestPromptResult>[] = [];
  for (let i = 0; i < runs; i += 1) {
    promises.push(testPrompt(promptOptions));
  }

  const responses = await Promise.all(promises);

  const assertionResults: MultiRunAssertionResult[] = responses.map((response) => {
    if (descriptors === undefined || descriptors.length === 0) {
      return { response, passed: true, results: [] as AssertionResult[] };
    }
    const runAllResult = assertions.runAll(response.content, descriptors);
    return {
      response,
      passed: runAllResult.passed,
      results: runAllResult.results,
    };
  });

  const passedRuns = assertionResults.filter((r) => r.passed).length;
  const actualPassRate = passedRuns / runs;
  const passed = actualPassRate >= effectivePassRate;

  return {
    passed,
    passRate: actualPassRate,
    totalRuns: runs,
    passedRuns,
    responses,
    assertionResults,
  };
}
