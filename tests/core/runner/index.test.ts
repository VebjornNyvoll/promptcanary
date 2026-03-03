import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { runTests } from '../../../src/core/runner/index.js';
import { registerProvider, type LLMProvider } from '../../../src/core/runner/providers/base.js';
import type { LLMResponse, PromptCanaryConfig } from '../../../src/types/index.js';

function mockResponse(provider: string, model: string, content: string): LLMResponse {
  return {
    content,
    model,
    provider,
    latency_ms: 5,
    token_usage: {
      prompt: 1,
      completion: 1,
    },
    timestamp: new Date(),
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('runTests', () => {
  it('runs providers for a test in parallel and reports progress', async () => {
    vi.useFakeTimers();

    const providerAName = `provider-a-${randomUUID()}`;
    const providerBName = `provider-b-${randomUUID()}`;
    const providerAExecute = vi.fn(async () => {
      await wait(50);
      return mockResponse(providerAName, 'model-a', 'a');
    });
    const providerBExecute = vi.fn(async () => {
      await wait(50);
      return mockResponse(providerBName, 'model-b', 'b');
    });

    const providerA: LLMProvider = {
      name: providerAName,
      execute: providerAExecute,
    };

    const providerB: LLMProvider = {
      name: providerBName,
      execute: providerBExecute,
    };

    registerProvider(providerAName, providerA);
    registerProvider(providerBName, providerB);

    const config: PromptCanaryConfig = {
      version: '1',
      config: {
        providers: [
          { name: providerAName, model: 'model-a', api_key_env: 'KEY_A', timeout_ms: 1000 },
          { name: providerBName, model: 'model-b', api_key_env: 'KEY_B', timeout_ms: 1000 },
        ],
      },
      tests: [{ name: 'parallel-test', prompt: 'hello', expect: {} }],
    };

    const onProgress = vi.fn();
    const pending = runTests({ config, onProgress });

    await vi.advanceTimersByTimeAsync(0);
    expect(providerAExecute).toHaveBeenCalledTimes(1);
    expect(providerBExecute).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(50);
    const results = await pending;

    expect(results).toHaveLength(2);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(results.every((result) => result.run_id.length > 0)).toBe(true);
    expect(results[0].comparison.details).toBe('pending');

    vi.useRealTimers();
  });

  it('uses provider overrides when specified on test cases', async () => {
    const providerAName = `provider-override-a-${randomUUID()}`;
    const providerBName = `provider-override-b-${randomUUID()}`;
    const providerAExecute = vi.fn(() => Promise.resolve(mockResponse(providerAName, 'model-a', 'a')));
    const providerBExecute = vi.fn(() => Promise.resolve(mockResponse(providerBName, 'model-b', 'b')));

    const providerA: LLMProvider = {
      name: providerAName,
      execute: providerAExecute,
    };

    const providerB: LLMProvider = {
      name: providerBName,
      execute: providerBExecute,
    };

    registerProvider(providerAName, providerA);
    registerProvider(providerBName, providerB);

    const config: PromptCanaryConfig = {
      version: '1',
      config: {
        providers: [
          { name: providerAName, model: 'model-a', api_key_env: 'KEY_A', timeout_ms: 1000 },
          { name: providerBName, model: 'model-b', api_key_env: 'KEY_B', timeout_ms: 1000 },
        ],
      },
      tests: [
        { name: 'override-only-a', prompt: 'hello', providers: [providerAName], expect: {} },
        { name: 'all-providers', prompt: 'hello', expect: {} },
      ],
    };

    const results = await runTests({ config });
    const overrideResults = results.filter((result) => result.test_name === 'override-only-a');

    expect(overrideResults).toHaveLength(1);
    expect(overrideResults[0].provider).toBe(providerAName);
    expect(providerAExecute).toHaveBeenCalledTimes(2);
    expect(providerBExecute).toHaveBeenCalledTimes(1);
  });

  it('isolates provider errors without blocking other providers', async () => {
    const providerOkName = `provider-ok-${randomUUID()}`;
    const providerFailName = `provider-fail-${randomUUID()}`;
    const providerOkExecute = vi.fn(() => Promise.resolve(mockResponse(providerOkName, 'model-ok', 'ok')));
    const providerFailExecute = vi.fn(() => Promise.reject(new Error('boom')));

    const providerOk: LLMProvider = {
      name: providerOkName,
      execute: providerOkExecute,
    };

    const providerFail: LLMProvider = {
      name: providerFailName,
      execute: providerFailExecute,
    };

    registerProvider(providerOkName, providerOk);
    registerProvider(providerFailName, providerFail);

    const config: PromptCanaryConfig = {
      version: '1',
      config: {
        providers: [
          { name: providerOkName, model: 'model-ok', api_key_env: 'KEY_OK', timeout_ms: 1000 },
          { name: providerFailName, model: 'model-fail', api_key_env: 'KEY_FAIL', timeout_ms: 1000 },
        ],
      },
      tests: [{ name: 'error-isolation', prompt: 'hello', expect: {} }],
    };

    const results = await runTests({ config });
    const okResult = results.find((result) => result.provider === providerOkName);
    const failResult = results.find((result) => result.provider === providerFailName);

    expect(results).toHaveLength(2);
    expect(okResult?.comparison.passed).toBe(true);
    expect(failResult?.comparison.passed).toBe(false);
    expect(failResult?.response.content).toContain('Provider execution failed');
  });
});
