import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'node:fs';
import { Storage } from '../../src/storage/index.js';
import type { RunResult } from '../../src/types/index.js';

const TEST_DB = 'test-promptcanary.db';

function makeRunResult(overrides?: Partial<RunResult>): RunResult {
  return {
    test_name: 'Test Case 1',
    provider: 'openai',
    model: 'gpt-4o',
    response: {
      content: 'Hello, world!',
      model: 'gpt-4o',
      provider: 'openai',
      latency_ms: 150,
      token_usage: { prompt: 10, completion: 5 },
      timestamp: new Date(),
    },
    comparison: {
      passed: true,
      severity: 'pass',
      assertions: [{ type: 'max_length', passed: true, expected: '<= 100', actual: '13 chars' }],
      semantic_score: 0.92,
      details: 'All checks passed',
    },
    run_id: 'run-test-001',
    ...overrides,
  };
}

describe('Storage', () => {
  let storage: Storage;

  beforeEach(() => {
    // Clean up test database
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    storage = new Storage(TEST_DB);
  });

  afterEach(() => {
    storage.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    // Also clean up WAL/SHM files
    if (existsSync(`${TEST_DB}-wal`)) unlinkSync(`${TEST_DB}-wal`);
    if (existsSync(`${TEST_DB}-shm`)) unlinkSync(`${TEST_DB}-shm`);
  });

  describe('saveRun / getRuns', () => {
    it('saves and retrieves a run', () => {
      const result = makeRunResult();
      storage.saveRun('Test Case 1', 'Hello prompt', result);

      const runs = storage.getRuns();
      expect(runs).toHaveLength(1);
      expect(runs[0].test_name).toBe('Test Case 1');
      expect(runs[0].provider).toBe('openai');
      expect(runs[0].response).toBe('Hello, world!');
    });

    it('filters by test name', () => {
      storage.saveRun('Test A', 'prompt', makeRunResult({ run_id: 'r1', test_name: 'Test A' }));
      storage.saveRun('Test B', 'prompt', makeRunResult({ run_id: 'r2', test_name: 'Test B' }));

      const runs = storage.getRuns({ testName: 'Test A' });
      expect(runs).toHaveLength(1);
      expect(runs[0].test_name).toBe('Test A');
    });

    it('filters by provider', () => {
      storage.saveRun('Test', 'prompt', makeRunResult({ run_id: 'r1', provider: 'openai' }));
      storage.saveRun('Test', 'prompt', makeRunResult({ run_id: 'r2', provider: 'anthropic' }));

      const runs = storage.getRuns({ provider: 'anthropic' });
      expect(runs).toHaveLength(1);
      expect(runs[0].provider).toBe('anthropic');
    });

    it('limits results', () => {
      for (let i = 0; i < 5; i++) {
        storage.saveRun('Test', 'prompt', makeRunResult({ run_id: `r${String(i)}` }));
      }

      const runs = storage.getRuns({ limit: 3 });
      expect(runs).toHaveLength(3);
    });
  });

  describe('getComparison', () => {
    it('retrieves comparison for a run', () => {
      const result = makeRunResult();
      storage.saveRun('Test', 'prompt', result);

      const comp = storage.getComparison('run-test-001');
      expect(comp).toBeDefined();
      expect(Boolean(comp?.passed)).toBe(true);
      expect(comp?.severity).toBe('pass');
      expect(comp?.semantic_score).toBe(0.92);
    });

    it('returns undefined for missing run', () => {
      const comp = storage.getComparison('nonexistent');
      expect(comp).toBeUndefined();
    });
  });

  describe('getHistoricalScores', () => {
    it('returns historical semantic scores', () => {
      const scores = [0.95, 0.93, 0.94];
      for (let i = 0; i < scores.length; i++) {
        storage.saveRun(
          'Test',
          'prompt',
          makeRunResult({
            run_id: `r${String(i)}`,
            comparison: {
              passed: true,
              severity: 'pass',
              assertions: [],
              semantic_score: scores[i],
              details: 'ok',
            },
          }),
        );
      }

      const history = storage.getHistoricalScores('Test', 'openai');
      expect(history).toHaveLength(3);
      // Should all be valid numbers
      for (const score of history) {
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });

    it('returns empty array when no history', () => {
      expect(storage.getHistoricalScores('Test', 'openai')).toEqual([]);
    });
  });

  describe('embedding cache', () => {
    it('stores and retrieves embeddings', () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      storage.cacheEmbedding('hash123', embedding, 'text-embedding-3-small');

      const cached = storage.getCachedEmbedding('hash123');
      expect(cached).toBeDefined();
      expect(cached).toHaveLength(5);
      // Float64 precision
      for (let i = 0; i < embedding.length; i++) {
        expect(cached?.[i]).toBeCloseTo(embedding[i], 10);
      }
    });

    it('returns undefined for missing embedding', () => {
      expect(storage.getCachedEmbedding('missing')).toBeUndefined();
    });
  });

  describe('alerts', () => {
    it('saves and retrieves alerts', () => {
      storage.saveRun('Test', 'prompt', makeRunResult());
      storage.saveAlert('run-test-001', 'slack', { test: 'data' }, true);

      const alerts = storage.getAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].channel).toBe('slack');
      expect(alerts[0].success).toBe(1);
    });

    it('detects recently sent alerts', () => {
      storage.saveRun('Test', 'prompt', makeRunResult());
      storage.saveAlert('run-test-001', 'slack', { test: 'data' }, true);

      expect(storage.wasAlertSentRecently('Test', 'openai', 'slack')).toBe(true);
      expect(storage.wasAlertSentRecently('Test', 'openai', 'webhook')).toBe(false);
      expect(storage.wasAlertSentRecently('Other', 'openai', 'slack')).toBe(false);
    });
  });
});
