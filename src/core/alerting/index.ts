import type { AlertChannel, AlertPayload, AlertConfig, RunResult } from '../../types/index.js';
import type { Storage } from '../../storage/index.js';
import { SlackAlertChannel } from './slack.js';
import { WebhookAlertChannel } from './webhook.js';

export { SlackAlertChannel } from './slack.js';
export { WebhookAlertChannel } from './webhook.js';

/**
 * Create alert channels from config.
 */
export function createAlertChannels(configs: AlertConfig[]): AlertChannel[] {
  return configs.map((config) => {
    switch (config.type) {
      case 'slack':
        return new SlackAlertChannel(config.webhook_url_env);
      case 'webhook':
        return new WebhookAlertChannel(config.url, config.headers);
      case 'email':
        // Email alerting is a post-MVP feature
        throw new Error('Email alerting is not yet implemented');
      default:
        throw new Error(`Unknown alert channel type`);
    }
  });
}

export interface DispatchAlertsOptions {
  results: RunResult[];
  channels: AlertChannel[];
  storage?: Storage;
  cooldownMinutes?: number;
}

/**
 * Dispatch alerts for failed test results.
 * Includes deduplication via cooldown period.
 */
export async function dispatchAlerts(options: DispatchAlertsOptions): Promise<void> {
  const { results, channels, storage, cooldownMinutes = 60 } = options;

  const failedResults = results.filter((r) => !r.comparison.passed);
  if (failedResults.length === 0 || channels.length === 0) return;

  const alertPromises: Promise<void>[] = [];

  for (const result of failedResults) {
    const alert: AlertPayload = {
      test_name: result.test_name,
      provider: result.provider,
      model: result.model,
      failure_type: result.comparison.semantic_score !== undefined ? 'semantic_drift' : 'assertion',
      details: result.comparison.details,
      severity: result.comparison.severity === 'critical' ? 'critical' : 'warning',
      timestamp: new Date(),
      run_id: result.run_id,
    };

    for (const channel of channels) {
      // Check deduplication
      if (storage) {
        const recentlySent = storage.wasAlertSentRecently(
          result.test_name,
          result.provider,
          channel.type,
          cooldownMinutes,
        );
        if (recentlySent) continue;
      }

      alertPromises.push(
        sendAlert(channel, alert, storage, result.run_id),
      );
    }
  }

  await Promise.allSettled(alertPromises);
}

async function sendAlert(
  channel: AlertChannel,
  alert: AlertPayload,
  storage: Storage | undefined,
  runId: string,
): Promise<void> {
  try {
    await channel.send(alert);
    storage?.saveAlert(runId, channel.type, { ...alert, timestamp: alert.timestamp.toISOString() }, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    storage?.saveAlert(runId, channel.type, { error: message }, false);
  }
}
