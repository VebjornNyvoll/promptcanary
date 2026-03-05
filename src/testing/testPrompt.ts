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
import { ResponseCache } from './responseCache.js';
import { ConfigError } from '../types/index.js';
import '../core/runner/providers/openai.js';
import '../core/runner/providers/anthropic.js';
import '../core/runner/providers/google.js';
import '../core/runner/providers/ollama.js';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_CACHE_TTL = 86400;

let sharedCache: ResponseCache | undefined;

const providerApiKeyEnvMap: Record<TestPromptOptions['provider'], string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  ollama: 'OLLAMA_BASE_URL',
  'openai-compatible': 'OPENAI_API_KEY',
};

function getLastUserMessageContent(messages: TestPromptOptions['messages']): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      return messages[i].content;
    }
  }

  return '';
}

function interpolateMessages(
  messages: TestPromptOptions['messages'],
  variables: Record<string, string>,
): TestPromptOptions['messages'] {
  return messages.map((msg) => {
    let content = msg.content;
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(
        `\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`,
        'g',
      );
      content = content.replace(pattern, value);
    }

    const remaining = content.match(/\{\{\s*\w+\s*\}\}/g);
    if (remaining !== null) {
      throw new ConfigError(
        `Unresolved variables in message: ${remaining.join(', ')}. Provide values in the variables option.`,
      );
    }

    return { ...msg, content };
  });
}

export async function testPrompt(options: TestPromptOptions): Promise<TestPromptResult> {
  const messages =
    options.variables !== undefined && Object.keys(options.variables).length > 0
      ? interpolateMessages(options.messages, options.variables)
      : options.messages;

  if (options.cache === true) {
    const cacheKey = ResponseCache.buildCacheKey({
      provider: options.provider,
      model: options.model,
      messages,
      temperature: options.temperature,
    });

    if (sharedCache === undefined) {
      sharedCache = new ResponseCache();
    }

    const ttl = options.cacheTtl ?? DEFAULT_CACHE_TTL;
    const cached = sharedCache.get(cacheKey, ttl);
    if (cached !== undefined) {
      return { ...cached, cached: true };
    }

    const result = await executePrompt(options, messages);
    sharedCache.set(cacheKey, result);
    return result;
  }

  return executePrompt(options, messages);
}

async function executePrompt(
  options: TestPromptOptions,
  messages: TestPromptOptions['messages'],
): Promise<TestPromptResult> {
  const apiKeyEnv = providerApiKeyEnvMap[options.provider];
  const originalApiKey = process.env[apiKeyEnv];
  const providerConfig: ProviderConfig = {
    name: options.provider,
    model: options.model,
    api_key_env: apiKeyEnv,
    timeout_ms: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
    ...(options.baseUrl !== undefined ? { base_url: options.baseUrl } : {}),
  };

  if (options.apiKey !== undefined) {
    process.env[apiKeyEnv] = options.apiKey;
  }

  try {
    const provider = getProvider(options.provider);
    const prompt = getLastUserMessageContent(messages);
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
