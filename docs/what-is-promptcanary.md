# What is PromptCanary?

PromptCanary is a testing library for LLM prompts. Add prompt regression tests to your existing test suite — Vitest, Jest, or any JavaScript test runner.

LLM providers silently update models, deprecate versions, and shift behavior. PromptCanary lets you catch those regressions the same way you catch code bugs: with tests that run in CI.

## The problem

Prompt behavior can change without any code changes in your application:

- Providers update models silently, altering output quality or format
- Safety layers shift, changing what responses are allowed
- Tokenization and context handling evolve between versions

Most teams discover these regressions from user complaints, not from tests.

## How PromptCanary helps

PromptCanary gives you three functions to test prompt behavior:

- **`testPrompt()`** — Send a prompt to any provider (OpenAI, Anthropic, Google Gemini) and get back a typed result with content, latency, and token usage
- **`semanticSimilarity()`** — Compare response meaning using embeddings, catching subtle drift that string matching misses
- **`assertions`** — Validate content, length, format, regex, JSON schema, and more with structured pass/fail results

These are regular functions. They work in Vitest, Jest, Mocha, or any runner. No YAML config, no separate tool, no special infrastructure.

```typescript
import { testPrompt, assertions } from 'promptcanary';

it('explains the refund policy correctly', async () => {
  const result = await testPrompt({
    provider: 'openai',
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'What is the refund policy?' }],
  });

  expect(assertions.contains(result.content, '30 days').passed).toBe(true);
});
```

## Who should use PromptCanary

PromptCanary is for any team with prompts in their codebase:

- Product teams running user-facing LLM features
- Platform teams maintaining shared prompt infrastructure
- AI engineering teams managing multi-step prompt pipelines
- Teams validating behavior across multiple providers

If prompt behavior affects user experience, PromptCanary gives you regression tests that run wherever your tests run.

## Additional capabilities

For teams that need more than test-time checks, PromptCanary also includes:

- **CLI with YAML config** — Config-driven testing for teams that prefer declarative test definitions
- **Continuous monitoring** — Schedule tests on cron intervals with SQLite-backed history
- **Alerting** — Slack and webhook notifications when behavior drifts

These are available under the [Advanced](/monitoring) section of the docs.
