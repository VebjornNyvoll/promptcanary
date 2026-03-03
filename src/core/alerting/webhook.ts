import type { AlertPayload, AlertChannel } from '../../types/index.js';

export class WebhookAlertChannel implements AlertChannel {
  type = 'webhook' as const;
  private url: string;
  private headers: Record<string, string>;
  private maxRetries: number;

  constructor(url: string, headers?: Record<string, string>, maxRetries = 2) {
    this.url = url;
    this.headers = headers ?? {};
    this.maxRetries = maxRetries;
  }

  async send(alert: AlertPayload): Promise<void> {
    const payload = {
      event: 'prompt_canary_alert',
      test_name: alert.test_name,
      provider: alert.provider,
      model: alert.model,
      failure_type: alert.failure_type,
      severity: alert.severity,
      details: alert.details,
      run_id: alert.run_id,
      timestamp: alert.timestamp.toISOString(),
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(this.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.headers,
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) return;

        const text = await response.text();
        lastError = new Error(`Webhook failed (${String(response.status)}): ${text}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      // Wait before retry (exponential backoff)
      if (attempt < this.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }

    throw lastError ?? new Error('Webhook failed after retries');
  }
}
