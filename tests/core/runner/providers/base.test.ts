import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createProvider,
  getProvider,
  getRegisteredProviders,
  registerProvider,
  type LLMProvider,
} from '../../../../src/core/runner/providers/base.js';
import type { ProviderConfig } from '../../../../src/types/index.js';
import { ProviderError } from '../../../../src/types/index.js';

describe('provider registry', () => {
  it('registers and retrieves a provider by name', () => {
    const providerName = `test-provider-${randomUUID()}`;
    const provider: LLMProvider = {
      name: providerName,
      execute: () =>
        Promise.resolve({
          content: 'ok',
          model: 'mock-model',
          provider: providerName,
          latency_ms: 1,
          token_usage: { prompt: 1, completion: 1 },
          timestamp: new Date(),
        }),
    };

    registerProvider(providerName, provider);
    expect(getProvider(providerName)).toBe(provider);
  });

  it('lists registered provider names', () => {
    const providerName = `list-provider-${randomUUID()}`;
    const provider: LLMProvider = {
      name: providerName,
      execute: () =>
        Promise.resolve({
          content: 'ok',
          model: 'mock-model',
          provider: providerName,
          latency_ms: 1,
          token_usage: { prompt: 1, completion: 1 },
          timestamp: new Date(),
        }),
    };

    registerProvider(providerName, provider);
    expect(getRegisteredProviders()).toContain(providerName);
  });

  it('throws for unknown providers', () => {
    const unknownName = `missing-provider-${randomUUID()}`;
    expect(() => getProvider(unknownName)).toThrow(ProviderError);
  });

  it('creates a provider from config name', () => {
    const providerName = `factory-provider-${randomUUID()}`;
    const provider: LLMProvider = {
      name: providerName,
      execute: () =>
        Promise.resolve({
          content: 'ok',
          model: 'mock-model',
          provider: providerName,
          latency_ms: 1,
          token_usage: { prompt: 1, completion: 1 },
          timestamp: new Date(),
        }),
    };

    registerProvider(providerName, provider);

    const config: ProviderConfig = {
      name: providerName,
      model: 'mock-model',
      api_key_env: 'TEST_KEY',
      timeout_ms: 1000,
    };

    expect(createProvider(config)).toBe(provider);
  });
});
