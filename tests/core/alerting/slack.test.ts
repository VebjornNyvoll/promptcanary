import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlackAlertChannel } from '../../../src/core/alerting/slack.js';
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

describe('SlackAlertChannel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('throws when env var is not set', () => {
    expect(() => new SlackAlertChannel('MISSING_SLACK_VAR')).toThrow('Missing Slack webhook URL');
  });

  it('sends POST request with Slack block payload', async () => {
    vi.stubEnv('TEST_SLACK_URL', 'https://hooks.slack.com/test');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));

    const channel = new SlackAlertChannel('TEST_SLACK_URL');
    await channel.send(mockAlert);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://hooks.slack.com/test');
    expect(options?.method).toBe('POST');

    const body = JSON.parse(options?.body as string) as { attachments: unknown[] };
    expect(body.attachments).toHaveLength(1);
  });

  it('retries on failure', async () => {
    vi.stubEnv('TEST_SLACK_URL', 'https://hooks.slack.com/test');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const channel = new SlackAlertChannel('TEST_SLACK_URL', 2);
    await channel.send(mockAlert);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws after all retries exhausted', async () => {
    vi.stubEnv('TEST_SLACK_URL', 'https://hooks.slack.com/test');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('error', { status: 500 }));

    const channel = new SlackAlertChannel('TEST_SLACK_URL', 0);
    await expect(channel.send(mockAlert)).rejects.toThrow('Slack webhook failed');
  });
});
