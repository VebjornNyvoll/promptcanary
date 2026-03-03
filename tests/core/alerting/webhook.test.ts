import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookAlertChannel } from '../../../src/core/alerting/webhook.js';
import type { AlertPayload } from '../../../src/types/index.js';

const mockAlert: AlertPayload = {
  test_name: 'Test Case 1',
  provider: 'openai',
  model: 'gpt-4o',
  failure_type: 'assertion',
  details: 'must_contain check failed',
  severity: 'critical',
  timestamp: new Date('2025-01-01T00:00:00Z'),
  run_id: 'run-123',
};

describe('WebhookAlertChannel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST request with correct payload', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    const channel = new WebhookAlertChannel('https://example.com/hook');
    await channel.send(mockAlert);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://example.com/hook');
    expect(options?.method).toBe('POST');

    const body = JSON.parse(options?.body as string) as Record<string, unknown>;
    expect(body.event).toBe('prompt_canary_alert');
    expect(body.test_name).toBe('Test Case 1');
    expect(body.severity).toBe('critical');
  });

  it('includes custom headers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    const channel = new WebhookAlertChannel(
      'https://example.com/hook',
      { Authorization: 'Bearer token' },
    );
    await channel.send(mockAlert);

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token');
  });

  it('retries on failure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const channel = new WebhookAlertChannel('https://example.com/hook', undefined, 2);
    await channel.send(mockAlert);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws after all retries exhausted', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('error', { status: 500 }),
    );

    const channel = new WebhookAlertChannel('https://example.com/hook', undefined, 0);
    await expect(channel.send(mockAlert)).rejects.toThrow('Webhook failed');
  });
});
