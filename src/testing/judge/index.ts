import type { JudgeOptions, JudgeResult, ProviderConfig } from '../../types/index.js';
import { getProvider } from '../../core/runner/providers/base.js';
import '../../core/runner/providers/openai.js';
import '../../core/runner/providers/anthropic.js';
import '../../core/runner/providers/google.js';
import { buildCriteriaPrompt } from './templates.js';

const DEFAULT_PROVIDER = 'openai';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0;
const DEFAULT_TIMEOUT_MS = 30000;

const providerApiKeyEnvMap: Record<NonNullable<JudgeOptions['provider']>, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  ollama: 'OLLAMA_BASE_URL',
  'openai-compatible': 'OPENAI_API_KEY',
};

export function parseJudgeResponse(rawContent: string): JudgeResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawContent);
  } catch {
    const jsonMatch = rawContent.match(/\{[\s\S]*?"score"[\s\S]*?"reason"[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse judge response: no valid JSON found');
    }
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('Failed to parse judge response: extracted JSON is invalid');
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Failed to parse judge response: expected a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.score !== 'number') {
    throw new Error('Failed to parse judge response: missing or invalid "score" (expected number)');
  }

  if (obj.score < 0 || obj.score > 1) {
    throw new Error(
      `Failed to parse judge response: "score" must be between 0 and 1, got ${String(obj.score)}`,
    );
  }

  if (typeof obj.pass !== 'boolean') {
    throw new Error('Failed to parse judge response: missing or invalid "pass" (expected boolean)');
  }

  if (typeof obj.reason !== 'string') {
    throw new Error(
      'Failed to parse judge response: missing or invalid "reason" (expected string)',
    );
  }

  return {
    score: obj.score,
    pass: obj.pass,
    reason: obj.reason,
  };
}

export async function callJudge(options: { prompt: string } & JudgeOptions): Promise<JudgeResult> {
  const providerName = options.provider ?? DEFAULT_PROVIDER;
  const model = options.model ?? DEFAULT_MODEL;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const apiKeyEnv = providerApiKeyEnvMap[providerName];

  const originalApiKey = process.env[apiKeyEnv];

  if (options.apiKey !== undefined) {
    process.env[apiKeyEnv] = options.apiKey;
  }

  const config: ProviderConfig = {
    name: providerName,
    model,
    api_key_env: apiKeyEnv,
    timeout_ms: timeoutMs,
    temperature,
    ...(options.baseUrl !== undefined ? { base_url: options.baseUrl } : {}),
  };

  try {
    const provider = getProvider(providerName);
    const response = await provider.execute(options.prompt, config);
    return parseJudgeResponse(response.content);
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

export async function judge(
  content: string,
  criteria: string,
  options?: JudgeOptions,
): Promise<JudgeResult> {
  const prompt = buildCriteriaPrompt(content, criteria);
  return callJudge({ prompt, ...options });
}
