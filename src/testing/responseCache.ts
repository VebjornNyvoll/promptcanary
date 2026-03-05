import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import type { TestPromptResult } from '../types/index.js';

const DEFAULT_TTL_SECONDS = 86400;
const DEFAULT_DB_PATH = '.promptcanary-cache.db';

export class ResponseCache {
  private db: Database.Database;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS response_cache (
        cache_key TEXT PRIMARY KEY,
        response_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
  }

  static buildCacheKey(options: {
    provider: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
  }): string {
    const payload = JSON.stringify({
      provider: options.provider,
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? null,
    });
    return createHash('sha256').update(payload).digest('hex');
  }

  get(cacheKey: string, ttlSeconds: number = DEFAULT_TTL_SECONDS): TestPromptResult | undefined {
    const now = Math.floor(Date.now() / 1000);
    const row = this.db
      .prepare('SELECT response_json, created_at FROM response_cache WHERE cache_key = ?')
      .get(cacheKey) as { response_json: string; created_at: number } | undefined;

    if (!row) return undefined;

    if (now - row.created_at >= ttlSeconds) {
      this.db.prepare('DELETE FROM response_cache WHERE cache_key = ?').run(cacheKey);
      return undefined;
    }

    return JSON.parse(row.response_json) as TestPromptResult;
  }

  set(cacheKey: string, result: TestPromptResult): void {
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(
        'INSERT OR REPLACE INTO response_cache (cache_key, response_json, created_at) VALUES (?, ?, ?)',
      )
      .run(cacheKey, JSON.stringify(result), now);
  }

  clear(): void {
    this.db.exec('DELETE FROM response_cache');
  }

  close(): void {
    this.db.close();
  }
}
