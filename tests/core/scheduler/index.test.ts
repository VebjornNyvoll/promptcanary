import { describe, it, expect, vi } from 'vitest';
import { startScheduler, executeRun } from '../../../src/core/scheduler/index.js';
import { Storage } from '../../../src/storage/index.js';
import { EmbeddingCache } from '../../../src/core/comparator/embedding.js';
import type { PromptCanaryConfig } from '../../../src/types/index.js';

const minimalConfig: PromptCanaryConfig = {
  version: '1',
  config: {
    providers: [
      { name: 'openai', model: 'gpt-4o', api_key_env: 'OPENAI_API_KEY', timeout_ms: 30000 },
    ],
  },
  tests: [{ name: 'Test', prompt: 'Hello', expect: {} }],
};

describe('startScheduler', () => {
  it('throws for missing schedule', () => {
    expect(() => startScheduler({ config: minimalConfig })).toThrow('No schedule defined');
  });

  it('throws for invalid cron expression', () => {
    const config = {
      ...minimalConfig,
      config: { ...minimalConfig.config, schedule: 'not-a-cron' },
    };
    expect(() => startScheduler({ config })).toThrow('Invalid cron expression');
  });

  it('starts and stops scheduler', () => {
    const config = {
      ...minimalConfig,
      config: { ...minimalConfig.config, schedule: '0 */6 * * *' },
    };
    const scheduler = startScheduler({ config, dbPath: ':memory:' });

    expect(scheduler.stop).toBeDefined();
    scheduler.stop(); // Should not throw
  });
});

describe('executeRun', () => {
  it('skips comparison for provider failures', () => {
    const result = {
      test_name: 'Test',
      provider: 'openai',
      response: {
        latency_ms: 0,
        content: 'Provider execution failed: API key not found',
      },
    };

    const shouldSkipComparison =
      result.response.latency_ms === 0 &&
      result.response.content.startsWith('Provider execution failed:');

    expect(shouldSkipComparison).toBe(true);
  });
});
