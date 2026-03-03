import type { AlertPayload, AlertChannel } from '../../types/index.js';

export class SlackAlertChannel implements AlertChannel {
  type = 'slack' as const;
  private webhookUrl: string;

  constructor(webhookUrlEnv: string) {
    const url = process.env[webhookUrlEnv];
    if (!url) {
      throw new Error(`Missing Slack webhook URL: environment variable ${webhookUrlEnv} is not set`);
    }
    this.webhookUrl = url;
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

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Slack webhook failed (${String(response.status)}): ${text}`);
    }
  }
}
