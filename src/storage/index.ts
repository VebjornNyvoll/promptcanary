import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { RunResult } from '../types/index.js';

export interface StoredRun {
  id: string;
  test_name: string;
  provider: string;
  model: string;
  prompt: string;
  response: string;
  latency_ms: number;
  token_usage_prompt: number;
  token_usage_completion: number;
  created_at: string;
}

export interface StoredComparison {
  id: string;
  run_id: string;
  passed: boolean;
  severity: string;
  semantic_score: number | null;
  details: string;
  assertions_json: string;
  created_at: string;
}

export interface StorageStats {
  runs: number;
  comparisons: number;
  alerts: number;
  embeddings: number;
  dbSizeBytes: number;
}

export interface Migration {
  version: number;
  up(db: Database.Database): void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    up(db: Database.Database): void {
      db.exec(`
        CREATE TABLE IF NOT EXISTS runs (
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
        );

        CREATE TABLE IF NOT EXISTS comparisons (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL REFERENCES runs(id),
          passed INTEGER NOT NULL,
          severity TEXT NOT NULL,
          semantic_score REAL,
          details TEXT NOT NULL,
          assertions_json TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS embeddings_cache (
          id TEXT PRIMARY KEY,
          content_hash TEXT NOT NULL UNIQUE,
          embedding BLOB NOT NULL,
          model TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS alerts (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL REFERENCES runs(id),
          channel TEXT NOT NULL,
          payload TEXT NOT NULL,
          sent_at TEXT DEFAULT (datetime('now')),
          success INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_runs_test_name ON runs(test_name);
        CREATE INDEX IF NOT EXISTS idx_runs_provider ON runs(provider);
        CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
        CREATE INDEX IF NOT EXISTS idx_comparisons_run_id ON comparisons(run_id);
        CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON embeddings_cache(content_hash);
        CREATE INDEX IF NOT EXISTS idx_alerts_run_id ON alerts(run_id);
      `);
    },
  },
];

export class Storage {
  private db: Database.Database;

  constructor(dbPath = 'promptcanary.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.runMigrations();
  }

  getSchemaVersion(): number {
    const tableExists = this.db
      .prepare(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='schema_version'",
      )
      .get() as { count: number };

    if (tableExists.count === 0) return 0;

    const row = this.db
      .prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
      .get() as { version: number } | undefined;

    return row?.version ?? 0;
  }

  private runMigrations(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const currentVersion = this.getSchemaVersion();
    const pending = migrations.filter((m) => m.version > currentVersion);

    if (pending.length === 0) return;

    const applyAll = this.db.transaction(() => {
      for (const migration of pending) {
        migration.up(this.db);
        this.db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);
      }
    });

    applyAll();
  }

  /**
   * Save a test run and its comparison result.
   */
  saveRun(testName: string, prompt: string, result: RunResult): string {
    const runId = result.run_id;

    const insertRunAndComparison = this.db.transaction(() => {
      const insertRun = this.db.prepare(`
        INSERT INTO runs (id, test_name, provider, model, prompt, response, latency_ms, token_usage_prompt, token_usage_completion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertRun.run(
        runId,
        testName,
        result.provider,
        result.model,
        prompt,
        result.response.content,
        result.response.latency_ms,
        result.response.token_usage.prompt,
        result.response.token_usage.completion,
      );

      // Save comparison
      const compId = randomUUID();
      const insertComp = this.db.prepare(`
        INSERT INTO comparisons (id, run_id, passed, severity, semantic_score, details, assertions_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertComp.run(
        compId,
        runId,
        result.comparison.passed ? 1 : 0,
        result.comparison.severity,
        result.comparison.semantic_score ?? null,
        result.comparison.details,
        JSON.stringify(result.comparison.assertions),
      );
    });

    insertRunAndComparison();
    return runId;
  }

  /**
   * Get recent runs, optionally filtered by test name and/or provider.
   */
  getRuns(options?: { testName?: string; provider?: string; limit?: number }): StoredRun[] {
    let sql = 'SELECT * FROM runs WHERE 1=1';
    const params: unknown[] = [];

    if (options?.testName) {
      sql += ' AND test_name = ?';
      params.push(options.testName);
    }
    if (options?.provider) {
      sql += ' AND provider = ?';
      params.push(options.provider);
    }

    sql += ' ORDER BY created_at DESC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    return this.db.prepare(sql).all(...params) as StoredRun[];
  }

  /**
   * Get comparison results for a run.
   */
  getComparison(runId: string): StoredComparison | undefined {
    return this.db.prepare('SELECT * FROM comparisons WHERE run_id = ?').get(runId) as
      | StoredComparison
      | undefined;
  }

  /**
   * Get historical semantic scores for a test+provider combination.
   * Used for drift detection.
   */
  getHistoricalScores(testName: string, provider: string, limit = 20): number[] {
    const rows = this.db
      .prepare(
        `SELECT c.semantic_score FROM comparisons c
         JOIN runs r ON c.run_id = r.id
         WHERE r.test_name = ? AND r.provider = ? AND c.semantic_score IS NOT NULL
         ORDER BY c.created_at DESC
         LIMIT ?`,
      )
      .all(testName, provider, limit) as Array<{ semantic_score: number }>;

    return rows.map((r) => r.semantic_score);
  }

  /**
   * Cache an embedding vector.
   */
  cacheEmbedding(contentHash: string, embedding: number[], model: string): void {
    const buffer = Buffer.from(new Float64Array(embedding).buffer);
    this.db
      .prepare(
        `INSERT OR REPLACE INTO embeddings_cache (id, content_hash, embedding, model)
         VALUES (?, ?, ?, ?)`,
      )
      .run(randomUUID(), contentHash, buffer, model);
  }

  /**
   * Retrieve a cached embedding by content hash.
   */
  getCachedEmbedding(contentHash: string): number[] | undefined {
    const row = this.db
      .prepare('SELECT embedding FROM embeddings_cache WHERE content_hash = ?')
      .get(contentHash) as { embedding: Buffer } | undefined;

    if (!row) return undefined;

    return Array.from(new Float64Array(row.embedding.buffer));
  }

  deleteRunsOlderThan(days: number): number {
    const cleanup = this.db.transaction((retentionDays: number) => {
      const deletedRunsRow = this.db
        .prepare(
          `SELECT COUNT(*) as count
           FROM runs
           WHERE created_at < datetime('now', '-' || ? || ' days')`,
        )
        .get(retentionDays) as { count: number };

      this.db
        .prepare(
          `DELETE FROM alerts
           WHERE run_id IN (
             SELECT id FROM runs WHERE created_at < datetime('now', '-' || ? || ' days')
           )`,
        )
        .run(retentionDays);

      this.db
        .prepare(
          `DELETE FROM comparisons
           WHERE run_id IN (
             SELECT id FROM runs WHERE created_at < datetime('now', '-' || ? || ' days')
           )`,
        )
        .run(retentionDays);

      this.db
        .prepare(`DELETE FROM runs WHERE created_at < datetime('now', '-' || ? || ' days')`)
        .run(retentionDays);

      return deletedRunsRow.count;
    });

    return cleanup(days);
  }

  deleteOrphanedEmbeddings(): number {
    const result = this.db
      .prepare(`DELETE FROM embeddings_cache WHERE created_at < datetime('now', '-90 days')`)
      .run();
    return result.changes;
  }

  getStats(): StorageStats {
    const runs = this.db.prepare('SELECT COUNT(*) as count FROM runs').get() as { count: number };
    const comparisons = this.db.prepare('SELECT COUNT(*) as count FROM comparisons').get() as {
      count: number;
    };
    const alerts = this.db.prepare('SELECT COUNT(*) as count FROM alerts').get() as {
      count: number;
    };
    const embeddings = this.db.prepare('SELECT COUNT(*) as count FROM embeddings_cache').get() as {
      count: number;
    };
    const dbSize = this.db
      .prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()')
      .get() as { size: number };

    return {
      runs: runs.count,
      comparisons: comparisons.count,
      alerts: alerts.count,
      embeddings: embeddings.count,
      dbSizeBytes: dbSize.size,
    };
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}
