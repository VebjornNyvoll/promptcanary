# Continuous Monitoring

Use `promptcanary monitor` to run your test suite continuously on a cron schedule.

## `promptcanary monitor`

```bash
promptcanary monitor promptcanary.yaml
```

Requirements:

- `config.schedule` must be set in your config file.
- Schedule must be a valid cron expression.

## Cron schedule syntax

PromptCanary uses `node-cron` with five-field cron syntax:

```text
* * * * *
| | | | |
| | | | +---- day of week (0-7)
| | | +------ month (1-12)
| | +-------- day of month (1-31)
| +---------- hour (0-23)
+------------ minute (0-59)
```

Examples:

- `*/15 * * * *` every 15 minutes
- `0 * * * *` every hour
- `0 */6 * * *` every 6 hours
- `0 9 * * 1-5` weekdays at 09:00

## Graceful shutdown

Monitor mode handles `SIGINT` and `SIGTERM`.

- Current run is allowed to finish cleanly.
- Scheduler task is stopped.
- SQLite connection is closed.

## Data retention and cleanup

Use cleanup to remove old runs and stale embedding cache entries:

```bash
promptcanary cleanup
promptcanary cleanup --older-than 90
promptcanary cleanup --dry-run
```

Behavior:

- Default retention for runs is 30 days.
- Embedding cache cleanup removes old cached entries.
- `--dry-run` previews deletion counts without mutating data.

## Running as a background service

### systemd (Linux)

```ini
[Unit]
Description=PromptCanary Monitor
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/promptcanary
ExecStart=/usr/bin/promptcanary monitor /opt/promptcanary/promptcanary.yaml
Environment=OPENAI_API_KEY=...
Environment=ANTHROPIC_API_KEY=...
Environment=GOOGLE_API_KEY=...
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### pm2

```bash
pm2 start "promptcanary monitor promptcanary.yaml" --name promptcanary-monitor
pm2 save
```

### Docker

```bash
docker run --rm \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e GOOGLE_API_KEY="$GOOGLE_API_KEY" \
  -v "$PWD:/app" \
  -w /app \
  node:20-alpine \
  sh -lc "npm install -g promptcanary && promptcanary monitor promptcanary.yaml"
```
