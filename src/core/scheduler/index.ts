import cron from 'node-cron';
import type { PromptCanaryConfig } from '../../types/index.js';
import { runTests } from '../runner/index.js';
import { compareResponse } from '../comparator/index.js';
import { EmbeddingCache, OpenAIEmbeddingFetcher } from '../comparator/embedding.js';
import type { EmbeddingFetcher } from '../comparator/embedding.js';
import { dispatchAlerts, createAlertChannels } from '../alerting/index.js';
import { Storage } from '../../storage/index.js';

export interface SchedulerOptions {
  config: PromptCanaryConfig;
  dbPath?: string;
  onRunStart?: () => void;
  onRunComplete?: (passed: number, failed: number) => void;
  onError?: (error: Error) => void;
}

/**
 * Start the continuous monitoring scheduler.
 * Returns a stop function to gracefully shut down.
 */
export function startScheduler(options: SchedulerOptions): { stop: () => void } {
  const { config, dbPath, onRunStart, onRunComplete, onError } = options;
  const schedule = config.config.schedule;

  if (!schedule) {
    throw new Error('No schedule defined in config. Use "schedule" field with a cron expression.');
  }

  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron expression: ${schedule}`);
  }

  const storage = new Storage(dbPath);
  const embeddingCache = new EmbeddingCache();

  let isRunning = false;

  const task = cron.schedule(schedule, () => {
    // Prevent overlapping runs
    if (isRunning) return;
    void executeRun(config, storage, embeddingCache, isRunning, onRunStart, onRunComplete, onError)
      .then(() => { isRunning = false; })
      .catch(() => { isRunning = false; });
    isRunning = true;
  });

  // Handle graceful shutdown
  const shutdown = (): void => {
    void task.stop();
    storage.close();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return {
    stop: shutdown,
  };
}

/**
 * Execute a single monitoring run (used by both scheduler and CLI).
 */
export async function executeRun(
  config: PromptCanaryConfig,
  storage: Storage,
  embeddingCache: EmbeddingCache,
  _isRunning: boolean,
  onRunStart?: () => void,
  onRunComplete?: (passed: number, failed: number) => void,
  onError?: (error: Error) => void,
): Promise<{ passed: number; failed: number }> {
  onRunStart?.();

  try {
    // Create embedding fetcher if configured
    let embeddingFetcher: EmbeddingFetcher | undefined;
    const embeddingConfig = config.config.embedding_provider;
    if (embeddingConfig) {
      try {
        embeddingFetcher = new OpenAIEmbeddingFetcher(
          embeddingConfig.api_key_env,
          embeddingConfig.model,
        );
      } catch {
        // Embedding provider not configured — skip semantic checks
      }
    }

    // Run all tests
    const results = await runTests({ config });

    // Run comparisons for each result
    for (const result of results) {
      const testCase = config.tests.find((t) => t.name === result.test_name);
      if (!testCase) continue;

      // Get historical scores for drift detection
      const historicalScores = storage.getHistoricalScores(
        result.test_name,
        result.provider,
      );

      // Run comparison
      const comparison = await compareResponse({
        response: result.response.content,
        expectations: testCase.expect,
        embeddingFetcher,
        embeddingCache,
        historicalScores,
      });

      result.comparison = comparison;

      // Save to storage
      storage.saveRun(result.test_name, testCase.prompt, result);
    }

    // Dispatch alerts
    const alertConfigs = config.config.alerts ?? [];
    if (alertConfigs.length > 0) {
      try {
        const channels = createAlertChannels(alertConfigs);
        await dispatchAlerts({ results, channels, storage });
      } catch {
        // Alert dispatch failure shouldn't crash the scheduler
      }
    }

    const passed = results.filter((r) => r.comparison.passed).length;
    const failed = results.filter((r) => !r.comparison.passed).length;

    onRunComplete?.(passed, failed);

    return { passed, failed };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    onError?.(error);
    throw error;
  }
}
