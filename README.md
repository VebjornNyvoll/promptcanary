# PromptCanary

> Uptime monitoring for AI behavior. Catch model drift before your users do.

PromptCanary runs prompt tests continuously, compares responses against expectations, and alerts you when behavior changes.

## Quick Start

```bash
npm install -g promptcanary
promptcanary init
promptcanary run promptcanary.yaml --verbose
promptcanary results
```

## Features

- Continuous prompt monitoring on cron schedules
- Multi-provider execution (OpenAI, Anthropic, Google Gemini)
- Structural assertions and semantic similarity checks
- Slack and webhook alerting with deduplication
- SQLite storage for historical trend and drift analysis
- CI/CD integration support

Full documentation: [PromptCanary Docs](https://vebjornnyvoll.github.io/promptcanary/)

## License

MIT
