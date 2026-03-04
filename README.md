<div align="center">
  <a href="https://vebjornnyvoll.github.io/promptcanary/">
    <img src="docs/public/logo-banner.png" width="500" alt="PromptCanary" />
  </a>
  <br>
  <em>Test your prompts like you test your code.</em>
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

LLM providers silently update models, deprecate versions, and shift behavior — often without warning. PromptCanary lets you add prompt regression tests directly to your existing test suite, so you catch drift the same way you catch bugs.

```bash
npm install promptcanary
```

## How it works

**1. Install** as a dev dependency:

```bash
npm install --save-dev promptcanary
```

**2. Write tests** alongside your existing test suite:

```typescript
import { describe, it, expect } from 'vitest'; // or jest, mocha, etc.
import { testPrompt, assertions } from 'promptcanary';

describe('refund policy prompt', () => {
  it('mentions the 30-day window', async () => {
    const result = await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'What is the refund policy?' }],
    });

    expect(assertions.contains(result.content, '30 days').passed).toBe(true);
    expect(assertions.maxLength(result.content, 500).passed).toBe(true);
  });
});
```

**3. Run** with your test runner — in dev, in CI, everywhere:

```bash
npx vitest run
```

## Features

**Works with any test runner** — Vitest, Jest, Mocha, or anything that runs TypeScript/JavaScript. No proprietary test format required.

**Multi-provider testing** — Test across OpenAI, Anthropic, and Google Gemini. Catch provider-specific regressions by running the same prompt against multiple models.

**Semantic similarity** — Go beyond string matching. Embedding-based comparison detects subtle meaning shifts that keyword checks miss.

**Built-in assertions** — `contains`, `notContains`, `maxLength`, `minLength`, `matchesRegex`, `isJson`, `matchesJsonSchema`, plus `runAll()` for batch checks.

**CI/CD native** — Runs wherever your tests run. GitHub Actions, GitLab CI, any pipeline. Non-zero exit on failures.

**Zero infrastructure** — One npm package. No servers, no dashboards, no separate tools.

## Quick Start

```typescript
import { testPrompt, semanticSimilarity, assertions } from 'promptcanary';

// Test a prompt and check the response
const result = await testPrompt({
  provider: 'openai',
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Summarize our return policy' }],
});

// Individual assertions
assertions.contains(result.content, 'refund'); // { passed: true, ... }
assertions.maxLength(result.content, 500); // { passed: true, ... }
assertions.isJson(result.content); // { passed: false, ... }

// Batch assertions
const check = assertions.runAll(result.content, [
  { type: 'contains', value: 'refund' },
  { type: 'max_length', value: 500 },
  { type: 'regex', value: '\\d+ days' },
]);
// check.passed → true/false, check.results → individual results

// Semantic similarity (requires OPENAI_API_KEY for embeddings)
const score = await semanticSimilarity(
  result.content,
  'Customers can request a full refund within 30 days of purchase.',
);
// score → 0.0 to 1.0
```

See the [Getting Started guide](https://vebjornnyvoll.github.io/promptcanary/getting-started) for a full walkthrough.

## CLI Usage

For teams that prefer YAML config over code, PromptCanary also ships with a CLI:

```bash
# Install globally
npm install -g promptcanary

# Create a config file
promptcanary init

# Run prompt tests from YAML config
promptcanary run promptcanary.yaml --verbose

# Output as JSON for CI pipelines
promptcanary run promptcanary.yaml --json
```

## Documentation

Full documentation is available at **[vebjornnyvoll.github.io/promptcanary](https://vebjornnyvoll.github.io/promptcanary/)**.

|                                                                                 |                                        |
| ------------------------------------------------------------------------------- | -------------------------------------- |
| [Getting Started](https://vebjornnyvoll.github.io/promptcanary/getting-started) | Installation and first test            |
| [Providers](https://vebjornnyvoll.github.io/promptcanary/providers)             | OpenAI, Anthropic, Google Gemini setup |
| [Assertions](https://vebjornnyvoll.github.io/promptcanary/assertions)           | All assertion types and usage          |
| [API Reference](https://vebjornnyvoll.github.io/promptcanary/api)               | Programmatic API docs                  |
| [CI/CD Guide](https://vebjornnyvoll.github.io/promptcanary/ci-cd)               | GitHub Actions, GitLab CI setup        |
| [CLI Reference](https://vebjornnyvoll.github.io/promptcanary/cli)               | Command-line interface docs            |
| [Architecture](https://vebjornnyvoll.github.io/promptcanary/architecture)       | Design and data flow                   |

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.
