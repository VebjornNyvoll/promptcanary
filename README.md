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
  <br><br>
  <a href="https://vebjornnyvoll.github.io/promptcanary/">Documentation</a>
  <span>&nbsp;&nbsp;&bull;&nbsp;&nbsp;</span>
  <a href="https://vebjornnyvoll.github.io/promptcanary/getting-started">Getting Started</a>
  <span>&nbsp;&nbsp;&bull;&nbsp;&nbsp;</span>
  <a href="https://vebjornnyvoll.github.io/promptcanary/changelog">Changelog</a>
</div>

---

## What is PromptCanary?

LLM providers silently update models, deprecate versions, and shift behavior — often without warning. PromptCanary continuously runs your prompts against live models and compares responses against expectations, so you find out about regressions _before_ your users do.

```bash
npm install -g promptcanary
```

## How it works

**1. Define** what you expect from your prompts:

```yaml
# promptcanary.yaml
prompts:
  - name: pricing-faq
    provider: openai
    model: gpt-4o-mini
    messages:
      - role: user
        content: 'What is the refund policy?'
    assertions:
      - type: contains
        value: '30 days'
      - type: max_length
        value: 500
```

**2. Run** tests on demand or on a schedule:

```bash
promptcanary run promptcanary.yaml --verbose
```

**3. Get alerted** when behavior drifts — via Slack, webhooks, or CI failures.

## Features

**Multi-provider testing** — Test across OpenAI, Anthropic, and Google Gemini simultaneously. Catch provider-specific regressions.

**Semantic similarity** — Go beyond string matching. Embedding-based comparison detects subtle meaning shifts that keyword checks miss.

**Structural assertions** — Validate response length, required content, JSON schema conformance, regex patterns, and more.

**Continuous monitoring** — Schedule tests on cron intervals. Pair with `promptcanary cleanup` for automatic data retention.

**Instant alerting** — Slack and webhook notifications with deduplication. Don't find out from your users.

**CI/CD ready** — Run in GitHub Actions, GitLab CI, or any pipeline. Non-zero exit on failures.

**Zero infrastructure** — Single binary, SQLite storage. No database to manage, no servers to provision.

## Quick Start

```bash
# Install globally
npm install -g promptcanary

# Create a config file
promptcanary init

# Run your prompt tests
promptcanary run promptcanary.yaml --verbose

# View historical results
promptcanary results

# Output as JSON for CI pipelines
promptcanary run promptcanary.yaml --json
```

See the [Getting Started guide](https://vebjornnyvoll.github.io/promptcanary/getting-started) for a full walkthrough.

## Programmatic API

```typescript
import { PromptCanary } from 'promptcanary';

const canary = new PromptCanary();
const results = await canary.run('./promptcanary.yaml');

for (const result of results) {
  console.log(`${result.name}: ${result.pass ? 'PASS' : 'FAIL'}`);
}
```

## Documentation

Full documentation is available at **[vebjornnyvoll.github.io/promptcanary](https://vebjornnyvoll.github.io/promptcanary/)**.

|                                                                             |                                        |
| --------------------------------------------------------------------------- | -------------------------------------- |
| [Configuration](https://vebjornnyvoll.github.io/promptcanary/configuration) | YAML config reference and examples     |
| [Providers](https://vebjornnyvoll.github.io/promptcanary/providers)         | OpenAI, Anthropic, Google Gemini setup |
| [Assertions](https://vebjornnyvoll.github.io/promptcanary/assertions)       | All assertion types and usage          |
| [CLI Reference](https://vebjornnyvoll.github.io/promptcanary/cli)           | Command-line interface docs            |
| [API Reference](https://vebjornnyvoll.github.io/promptcanary/api)           | Programmatic usage                     |
| [Architecture](https://vebjornnyvoll.github.io/promptcanary/architecture)   | Design and data flow                   |

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

## License

MIT
