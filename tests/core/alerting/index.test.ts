import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchAlerts } from '../../../src/core/alerting/index.js';
import type { AlertChannel, AlertPayload, RunResult } from '../../../src/types/index.js';

function makeChannel(name: string): AlertChannel & { calls: AlertPayload[] } {
  const calls: AlertPayload[] = [];
  return {
    type: name,
    calls,
    send: vi.fn((alert: AlertPayload) => {
      calls.push(alert);
      return Promise.resolve();
    }),
  };
}

function makeResult(overrides?: Partial<RunResult>): RunResult {
  return {
    test_name: 'Test 1',
    provider: 'openai',
    model: 'gpt-4o',
    response: {
      content: 'response',
      model: 'gpt-4o',
      provider: 'openai',
      latency_ms: 100,
      token_usage: { prompt: 10, completion: 5 },
      timestamp: new Date(),
    },
    comparison: {
      passed: false,
      severity: 'critical',
      assertions: [],
      details: 'Failed assertion',
    },
    run_id: 'run-1',
    ...overrides,
  };
}

describe('dispatchAlerts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends alerts for failed results', async () => {
    const channel = makeChannel('test');
    await dispatchAlerts({
      results: [makeResult()],
      channels: [channel],
    });

    expect(channel.calls).toHaveLength(1);
    expect(channel.calls[0].test_name).toBe('Test 1');
    expect(channel.calls[0].severity).toBe('critical');
  });

  it('skips alerts for passing results', async () => {
    const channel = makeChannel('test');
    await dispatchAlerts({
      results: [makeResult({ comparison: { passed: true, severity: 'pass', assertions: [], details: 'ok' } })],
      channels: [channel],
    });

    expect(channel.calls).toHaveLength(0);
  });

  it('sends to multiple channels', async () => {
    const slack = makeChannel('slack');
    const webhook = makeChannel('webhook');

    await dispatchAlerts({
      results: [makeResult()],
      channels: [slack, webhook],
    });

    expect(slack.calls).toHaveLength(1);
    expect(webhook.calls).toHaveLength(1);
  });

  it('handles channel errors gracefully', async () => {
    const failingChannel: AlertChannel = {
      type: 'failing',
      send: vi.fn().mockRejectedValue(new Error('Network error')),
    };

    // Should not throw
    await dispatchAlerts({
      results: [makeResult()],
      channels: [failingChannel],
    });
  });

  it('does nothing with no channels', async () => {
    await dispatchAlerts({
      results: [makeResult()],
      channels: [],
    });
    // No error = success
  });

  it('classifies semantic drift alerts correctly', async () => {
    const channel = makeChannel('test');
    await dispatchAlerts({
      results: [
        makeResult({
          comparison: {
            passed: false,
            severity: 'warning',
            assertions: [],
            semantic_score: 0.65,
            details: 'Semantic drift detected',
          },
        }),
      ],
      channels: [channel],
    });

    expect(channel.calls[0].failure_type).toBe('semantic_drift');
  });
});
