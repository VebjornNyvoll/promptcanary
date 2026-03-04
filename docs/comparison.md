# PromptCanary vs promptfoo

Both tools help you test LLM outputs. They solve different problems.

## Quick comparison table

| Feature             | PromptCanary                             | promptfoo                                            |
| ------------------- | ---------------------------------------- | ---------------------------------------------------- |
| Architecture        | Testing library (npm package)            | Evaluation platform (CLI + web UI + DB)              |
| Test runner         | Uses yours (Vitest, Jest, Mocha)         | Has its own (promptfoo eval)                         |
| Config format       | TypeScript test files (or optional YAML) | YAML config (promptfooconfig.yaml)                   |
| Install size        | ~22 KB (13 files)                        | ~21 MB (349 files, 84 dependencies)                  |
| Infrastructure      | None — pure library                      | SQLite DB, optional web UI server                    |
| Provider support    | OpenAI, Anthropic, Google Gemini         | 60+ providers built-in                               |
| Assertions          | 7 built-in + custom via test runner      | 30+ built-in + model-graded (LLM-as-judge)           |
| Red teaming         | No                                       | Yes — 50+ vulnerability types, OWASP/NIST compliance |
| Web UI              | No                                       | Yes — local viewer + enterprise cloud                |
| Semantic similarity | Yes (embedding-based)                    | Yes (embedding-based)                                |
| CI/CD               | Runs wherever your tests run             | Dedicated CI integrations                            |
| Enterprise features | No                                       | RBAC, SSO, team sharing, audit logs                  |
| Price               | Free (MIT)                               | Free OSS + paid enterprise                           |

## When to use PromptCanary

- You already have a test suite (Vitest, Jest, etc.) and want to add LLM coverage
- You want prompt tests that look and feel like your unit tests
- You need zero infrastructure — no database, no server, no new tools
- You test against 1-3 providers and need basic assertions + semantic similarity
- You value simplicity and small dependency footprint

Example:

```typescript
import { testPrompt, assertions } from 'promptcanary';

it('refund policy mentions 30-day window', async () => {
  const result = await testPrompt({
    provider: 'openai',
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'What is the refund policy?' }],
  });
  expect(assertions.contains(result.content, '30 days').passed).toBe(true);
});
```

## When to use promptfoo

- You need to evaluate prompts across many providers simultaneously (matrix testing)
- You need model-graded assertions (LLM-as-judge, factuality scoring, RAG metrics)
- You need red teaming and security compliance scanning (OWASP, NIST, HIPAA)
- You want a web UI for exploring and sharing results across a team
- You need enterprise features (RBAC, SSO, audit trails)
- You're building evaluation datasets or doing systematic prompt optimization

## Can you use both?

Yes. PromptCanary handles prompt regression tests in your test suite (run on every PR). promptfoo handles deeper evaluation and red teaming (run periodically or during prompt development). They don't conflict.

## Summary

promptfoo is a full evaluation platform for teams doing systematic LLM evaluation, red teaming, and prompt optimization. PromptCanary is a testing library for teams that want prompt regression tests inside their existing test suite. Different tools for different jobs.
