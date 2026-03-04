# Alerting

PromptCanary can dispatch alerts to Slack and generic webhooks when tests fail.

## Slack setup

1. Create an Incoming Webhook in your Slack workspace.
2. Store the webhook URL in an environment variable.
3. Reference that variable in config.

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

```yaml
config:
  alerts:
    - type: slack
      webhook_url_env: SLACK_WEBHOOK_URL
```

## Webhook setup

Configure any HTTP endpoint:

```yaml
config:
  alerts:
    - type: webhook
      url: https://example.com/promptcanary-alerts
      headers:
        Authorization: Bearer your-token
```

Constraints:

- `url` must start with `http://` or `https://`.
- `headers` are optional and sent with JSON payloads.

## Alert deduplication

PromptCanary deduplicates alerts for the same test, provider, and channel within a cooldown period.

- Default cooldown is 60 minutes.
- This prevents repeated alert noise during sustained failures.

## Alert severity

PromptCanary emits two severities:

- `warning`: non-critical failures such as semantic drift above the critical floor.
- `critical`: structural assertion failures, severe semantic failures, or hard provider failures.

## Alert payload interface

```ts
interface AlertPayload {
  test_name: string;
  provider: string;
  model: string;
  failure_type: 'assertion' | 'semantic_drift' | 'error';
  details: string;
  severity: 'warning' | 'critical';
  timestamp: Date;
  run_id: string;
}
```

Webhook channel JSON payload shape:

```json
{
  "event": "prompt_canary_alert",
  "test_name": "Professional greeting",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "failure_type": "assertion",
  "severity": "critical",
  "details": "[must_contain] Expected hello",
  "run_id": "...",
  "timestamp": "2026-03-04T10:00:00.000Z"
}
```

## Email alerting status

Email alerting is not implemented in the current runtime and is intentionally excluded from the active config schema.
