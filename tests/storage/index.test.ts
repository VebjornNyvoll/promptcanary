import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { Storage, migrations } from '../../src/storage/index.js';
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

  describe('cleanup', () => {
    it('deleteRunsOlderThan removes old runs and cascades', () => {
      storage.saveRun('old-test', 'prompt', makeRunResult({ run_id: 'old-run-id' }));

      const db = (storage as unknown as { db: Database.Database }).db;
      db.prepare(
        "UPDATE runs SET created_at = datetime('now', '-60 days') WHERE test_name = ?",
      ).run('old-test');

      const deleted = storage.deleteRunsOlderThan(30);

      expect(deleted).toBe(1);
      expect(storage.getRuns({ testName: 'old-test' })).toHaveLength(0);
      expect(storage.getComparison('old-run-id')).toBeUndefined();
    });

    it('deleteRunsOlderThan preserves recent runs', () => {
      storage.saveRun('recent-test', 'prompt', makeRunResult({ run_id: 'recent-run-id' }));

      const deleted = storage.deleteRunsOlderThan(30);

      expect(deleted).toBe(0);
      expect(storage.getRuns({ testName: 'recent-test' })).toHaveLength(1);
      expect(storage.getComparison('recent-run-id')).toBeDefined();
    });

    it('deleteRunsOlderThan returns count of deleted runs', () => {
      storage.saveRun('old-a', 'prompt', makeRunResult({ run_id: 'old-run-a' }));
      storage.saveRun('old-b', 'prompt', makeRunResult({ run_id: 'old-run-b' }));
      storage.saveRun('recent-c', 'prompt', makeRunResult({ run_id: 'recent-run-c' }));

      const db = (storage as unknown as { db: Database.Database }).db;
      db.prepare(
        "UPDATE runs SET created_at = datetime('now', '-45 days') WHERE test_name IN (?, ?)",
      ).run('old-a', 'old-b');

      const deleted = storage.deleteRunsOlderThan(30);

      expect(deleted).toBe(2);
      expect(storage.getRuns()).toHaveLength(1);
      expect(storage.getRuns()[0].test_name).toBe('recent-c');
    });

    it('deleteOrphanedEmbeddings removes old cache entries', () => {
      storage.cacheEmbedding('old-hash', [0.1, 0.2], 'text-embedding-3-small');
      storage.cacheEmbedding('recent-hash', [0.3, 0.4], 'text-embedding-3-small');

      const db = (storage as unknown as { db: Database.Database }).db;
      db.prepare(
        "UPDATE embeddings_cache SET created_at = datetime('now', '-120 days') WHERE content_hash = ?",
      ).run('old-hash');

      const deleted = storage.deleteOrphanedEmbeddings();

      expect(deleted).toBe(1);
      expect(storage.getCachedEmbedding('old-hash')).toBeUndefined();
      expect(storage.getCachedEmbedding('recent-hash')).toBeDefined();
    });

    it('getStats returns correct counts', () => {
      storage.saveRun('stats-a', 'prompt', makeRunResult({ run_id: 'stats-run-a' }));
      storage.saveRun('stats-b', 'prompt', makeRunResult({ run_id: 'stats-run-b' }));
      storage.cacheEmbedding('stats-hash-a', [0.11, 0.22], 'text-embedding-3-small');
      storage.cacheEmbedding('stats-hash-b', [0.33, 0.44], 'text-embedding-3-small');

      const stats = storage.getStats();

      expect(stats.runs).toBe(2);
      expect(stats.comparisons).toBe(2);
      expect(stats.alerts).toBe(0);
      expect(stats.embeddings).toBe(2);
      expect(stats.dbSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('schema migrations', () => {
    it('creates schema_version table on fresh database', () => {
      const version = storage.getSchemaVersion();
      expect(version).toBe(migrations.length);
    });

    it('applies migrations to a pre-existing v0 database', () => {
      storage.close();
      if (existsSync(TEST_DB)) unlinkSync(TEST_DB);

      const raw = new Database(TEST_DB);
      raw.pragma('journal_mode = WAL');
      raw.exec(`
        CREATE TABLE runs (
          id TEXT PRIMARY KEY,
          test_name TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          prompt TEXT NOT NULL,
          response TEXT NOT NULL,
          latency_ms INTEGER NOT NULL,
          token_usage_prompt INTEGER DEFAULT 0,
          token_usage_completion INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      raw
        .prepare(
          'INSERT INTO runs (id, test_name, provider, model, prompt, response, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run('old-run', 'Legacy Test', 'openai', 'gpt-4', 'hello', 'world', 100);
      raw.close();

      const migrated = new Storage(TEST_DB);
      expect(migrated.getSchemaVersion()).toBe(migrations.length);

      const runs = migrated.getRuns();
      expect(runs).toHaveLength(1);
      expect(runs[0].test_name).toBe('Legacy Test');
      migrated.close();
    });

    it('skips already-applied migrations', () => {
      storage.close();
      if (existsSync(TEST_DB)) unlinkSync(TEST_DB);

      const first = new Storage(TEST_DB);
      first.saveRun('Test', 'prompt', makeRunResult());
      first.close();

      const second = new Storage(TEST_DB);
      expect(second.getSchemaVersion()).toBe(migrations.length);
      const runs = second.getRuns();
      expect(runs).toHaveLength(1);
      second.close();

      storage = new Storage(TEST_DB);
    });
  });
});
