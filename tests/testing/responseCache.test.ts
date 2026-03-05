import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { ResponseCache } from '../../src/testing/responseCache.js';
import type { TestPromptResult } from '../../src/types/index.js';

const TEST_DB = '.test-response-cache.db';

function makeMockResult(content: string): TestPromptResult {
  return {
    content,
    model: 'gpt-4o-mini',
    provider: 'openai',
    latencyMs: 150,
    tokenUsage: { prompt: 10, completion: 20 },
  };
}

describe('ResponseCache', () => {
  let cache: ResponseCache;

  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    cache = new ResponseCache(TEST_DB);
  });

  afterEach(() => {
    cache.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  it('returns undefined for cache miss', () => {
    const result = cache.get('nonexistent-key');
    expect(result).toBeUndefined();
  });

  it('stores and retrieves a cached response', () => {
    const mockResult = makeMockResult('cached answer');
    const key = 'test-key-1';

    cache.set(key, mockResult);
    const retrieved = cache.get(key);

    expect(retrieved).toBeDefined();
    expect(retrieved?.content).toBe('cached answer');
    expect(retrieved?.model).toBe('gpt-4o-mini');
    expect(retrieved?.provider).toBe('openai');
    expect(retrieved?.tokenUsage).toEqual({ prompt: 10, completion: 20 });
  });

  it('evicts expired entries', () => {
    const mockResult = makeMockResult('old answer');
    const key = 'expired-key';

    cache.set(key, mockResult);

    const result = cache.get(key, 0);
    expect(result).toBeUndefined();
  });

  it('respects TTL for non-expired entries', () => {
    const mockResult = makeMockResult('fresh answer');
    const key = 'fresh-key';

    cache.set(key, mockResult);

    const result = cache.get(key, 86400);
    expect(result).toBeDefined();
    expect(result?.content).toBe('fresh answer');
  });

  it('overwrites existing entry with same key', () => {
    const key = 'overwrite-key';

    cache.set(key, makeMockResult('first'));
    cache.set(key, makeMockResult('second'));

    const result = cache.get(key);
    expect(result?.content).toBe('second');
  });

  it('clears all cached entries', () => {
    cache.set('key1', makeMockResult('one'));
    cache.set('key2', makeMockResult('two'));

    cache.clear();

    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBeUndefined();
  });

  describe('buildCacheKey', () => {
    it('produces deterministic keys for same inputs', () => {
      const key1 = ResponseCache.buildCacheKey({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello' }],
        temperature: 0.7,
      });
      const key2 = ResponseCache.buildCacheKey({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello' }],
        temperature: 0.7,
      });
      expect(key1).toBe(key2);
    });

    it('produces different keys for different messages', () => {
      const key1 = ResponseCache.buildCacheKey({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello' }],
      });
      const key2 = ResponseCache.buildCacheKey({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'goodbye' }],
      });
      expect(key1).not.toBe(key2);
    });

    it('produces different keys for different models', () => {
      const key1 = ResponseCache.buildCacheKey({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello' }],
      });
      const key2 = ResponseCache.buildCacheKey({
        provider: 'openai',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hello' }],
      });
      expect(key1).not.toBe(key2);
    });

    it('produces different keys for different temperatures', () => {
      const key1 = ResponseCache.buildCacheKey({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello' }],
        temperature: 0.5,
      });
      const key2 = ResponseCache.buildCacheKey({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello' }],
        temperature: 0.7,
      });
      expect(key1).not.toBe(key2);
    });

    it('treats undefined temperature same as null', () => {
      const key1 = ResponseCache.buildCacheKey({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello' }],
      });
      const key2 = ResponseCache.buildCacheKey({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello' }],
        temperature: undefined,
      });
      expect(key1).toBe(key2);
    });

    it('returns a hex string', () => {
      const key = ResponseCache.buildCacheKey({
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello' }],
      });
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
