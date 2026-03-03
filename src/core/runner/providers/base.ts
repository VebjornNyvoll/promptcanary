import type { LLMResponse, ProviderConfig } from '../../../types/index.js';
import { ProviderError } from '../../../types/index.js';

export interface LLMProvider {
  name: string;
  execute(prompt: string, config: ProviderConfig): Promise<LLMResponse>;
}

const providerRegistry = new Map<string, LLMProvider>();

export function registerProvider(name: string, provider: LLMProvider): void {
  providerRegistry.set(name, provider);
}

export function getProvider(name: string): LLMProvider {
  const provider = providerRegistry.get(name);
  if (!provider) {
    throw new ProviderError(`Provider not found: ${name}`, name);
  }

  return provider;
}

export function getRegisteredProviders(): string[] {
  return Array.from(providerRegistry.keys());
}

export function createProvider(config: ProviderConfig): LLMProvider {
  return getProvider(config.name);
}
