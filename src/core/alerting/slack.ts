import type { AlertPayload, AlertChannel } from '../../types/index.js';

export class SlackAlertChannel implements AlertChannel {
  type = 'slack' as const;
  private webhookUrl: string;
  private maxRetries: number;

  constructor(webhookUrlEnv: string, maxRetries = 2) {
    const url = process.env[webhookUrlEnv];
    if (!url) {
      throw new Error(
        `Missing Slack webhook URL: environment variable ${webhookUrlEnv} is not set`,
      );
    }
    this.webhookUrl = url;
    this.maxRetries = maxRetries;
  }

  async send(alert: AlertPayload): Promise<void> {
    const color = alert.severity === 'critical' ? '#dc3545' : '#ffc107';
    const emoji = alert.severity === 'critical' ? ':rotating_light:' : ':warning:';

    const payload = {
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${emoji} PromptCanary Alert: ${alert.test_name}`,
              },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Provider:*\n${alert.provider}` },
                { type: 'mrkdwn', text: `*Model:*\n${alert.model}` },
                { type: 'mrkdwn', text: `*Severity:*\n${alert.severity.toUpperCase()}` },
                { type: 'mrkdwn', text: `*Type:*\n${alert.failure_type}` },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Details:*\n${alert.details}`,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Run ID: ${alert.run_id} | ${alert.timestamp.toISOString()}`,
                },
              ],
            },
          ],
        },
      ],
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) return;

        const text = await response.text();
        lastError = new Error(`Slack webhook failed (${String(response.status)}): ${text}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      if (attempt < this.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }

    throw lastError ?? new Error('Slack webhook failed after retries');
  }
}
