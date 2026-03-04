# Getting Started

Add prompt regression tests to your existing test suite in under five minutes.

## Installation

Install PromptCanary as a dev dependency:

```bash
npm install --save-dev promptcanary
```

## Set up API keys

PromptCanary calls LLM providers on your behalf, so it needs API keys via environment variables.

Set the key for whichever provider(s) you test against:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="AIza..."
```

For local development, add these to a `.env` file (and make sure it's in `.gitignore`). Most test runners and CI systems support environment variables natively.

## Your first prompt test

Create a test file next to your existing tests. This example uses Vitest, but any runner works:

```typescript
// tests/prompts/refund-policy.test.ts
import { describe, it, expect } from 'vitest';
import { testPrompt, assertions } from 'promptcanary';

describe('refund policy prompt', () => {
  it('mentions the 30-day window', async () => {
    const result = await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'What is our refund policy?' }],
    });

    expect(assertions.contains(result.content, '30 days').passed).toBe(true);
    expect(assertions.maxLength(result.content, 500).passed).toBe(true);
  });

  it('stays under token budget', async () => {
    const result = await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Summarize the return process' }],
    });

    expect(result.tokenUsage.completion).toBeLessThan(200);
  });
});
```

Prefer Vitest when possible because it works natively with ESM. If your team uses Jest, this setup works with PromptCanary too:

```bash
npm install --save-dev promptcanary jest ts-jest @types/jest
```

```typescript
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
};

export default config;
```

```typescript
// tests/prompts/refund-policy.jest.test.ts
import { describe, expect, it } from '@jest/globals';
import { testPrompt, assertions } from 'promptcanary';

describe('refund policy prompt', () => {
  it('mentions the 30-day window', async () => {
    const result = await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'What is our refund policy?' }],
    });

    expect(assertions.contains(result.content, '30 days').passed).toBe(true);
    expect(assertions.maxLength(result.content, 500).passed).toBe(true);
  });
});
```

Jest setup note: PromptCanary is ESM-only, so configure Jest for ESM (`extensionsToTreatAsEsm: ['.ts']` plus a `transform` using `ts-jest` ESM support, or use `@swc/jest`). Depending on your Node/Jest version, you may also need `node --experimental-vm-modules` when running tests.

### What `testPrompt()` returns

```typescript
{
  content: string; // The model's response text
  model: string; // Model that responded (e.g. "gpt-4o-mini")
  provider: string; // Provider name ("openai", "anthropic", "google")
  latencyMs: number; // Response time in milliseconds
  tokenUsage: {
    prompt: number; // Input tokens
    completion: number; // Output tokens
  }
}
```

## Using assertions

PromptCanary ships assertion helpers that return structured results:

```typescript
import { assertions } from 'promptcanary';

// Each returns { passed: boolean, type: string, expected: string, actual: string, details?: string }
assertions.contains(content, 'refund');
assertions.notContains(content, 'error');
assertions.maxLength(content, 500);
assertions.minLength(content, 50);
assertions.matchesRegex(content, /\d+ days/);
assertions.isJson(content);
assertions.matchesJsonSchema(content, { status: 'string', count: 'number' });

// Batch multiple assertions
const check = assertions.runAll(content, [
  { type: 'contains', value: 'refund' },
  { type: 'max_length', value: 500 },
]);
// check.passed → true if all pass, check.results → individual results
```

## Semantic similarity

Compare response meaning using embeddings (requires `OPENAI_API_KEY`):

```typescript
import { testPrompt, semanticSimilarity } from 'promptcanary';

const result = await testPrompt({
  provider: 'openai',
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Explain our cancellation policy' }],
});

const score = await semanticSimilarity(
  result.content,
  'Users may cancel their subscription at any time with no penalty.',
);

expect(score).toBeGreaterThan(0.8);
```

## Running tests

Run with your normal test command — there's nothing special about prompt tests:

```bash
# Vitest
npx vitest run

# Jest
npx jest

# Or however you run tests
npm test
```

## Using in CI

Since prompt tests are regular test files, they run wherever your tests run. Set API keys as secrets in your CI provider:

```yaml
# .github/workflows/ci.yml
- name: Run tests
  run: npm test
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

See the [CI/CD Guide](./ci-cd.md) for GitHub Actions, GitLab CI, and JSON output examples.

## Alternative: CLI usage

For quick checks without a test suite, or for teams that prefer config-driven testing:

```bash
# Install the CLI globally
npm install -g promptcanary

# Generate a YAML config
promptcanary init

# Run tests from config
promptcanary run promptcanary.yaml --verbose

# Output JSON for CI parsing
promptcanary run promptcanary.yaml --json
```

See the [CLI Reference](./cli.md) for full command documentation.

## Next steps

- Browse the [API Reference](./api.md) for all exported functions and types
- Set up [multiple providers](./providers.md) to test across OpenAI, Anthropic, and Google Gemini
- Read the [Assertions guide](./assertions.md) for all available assertion types
