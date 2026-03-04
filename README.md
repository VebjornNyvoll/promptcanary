<div align="center">
  <a href="https://vebjornnyvoll.github.io/promptcanary/">
    <img src="docs/public/logo-banner.png" width="500" alt="PromptCanary" />
  </a>
  <br>
  <em>Uptime monitoring for AI behavior. Catch model drift before your users do.</em>
  <br><br>
  <a href="https://github.com/VebjornNyvoll/promptcanary/actions"><img src="https://img.shields.io/github/actions/workflow/status/VebjornNyvoll/promptcanary/ci.yml?branch=master&label=build" alt="Build" /></a>
  <a href="https://www.npmjs.com/package/promptcanary"><img src="https://img.shields.io/npm/v/promptcanary" alt="npm" /></a>
  <a href="https://github.com/VebjornNyvoll/promptcanary/blob/master/LICENSE"><img src="https://img.shields.io/github/license/VebjornNyvoll/promptcanary" alt="License" /></a>
</div>

---

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
