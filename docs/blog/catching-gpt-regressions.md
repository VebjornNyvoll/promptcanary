---
title: How We Catch GPT Regressions in CI
published: false
description: "LLM providers silently update models. Here's how we catch regressions in our test suite."
tags: testing, ai, typescript, devops
---

# How We Catch GPT Regressions in CI

If you've shipped a feature powered by an LLM, you've probably felt that nagging anxiety: "Is it still working?"

Unlike traditional software, where a bug is usually the result of a code change you made, LLM-powered features can break while you're sleeping. You didn't change a line of code, but your "summarize this transcript" feature is suddenly outputting bullet points instead of a paragraph, or your JSON extractor is hallucinating a new field.

The culprit? Silent model updates. LLM providers like OpenAI, Anthropic, and Google are constantly tweaking their models. Even "pinned" versions like `gpt-4o-2024-08-06` can exhibit subtle shifts in behavior over time. Usually, you find out when a user complains, not when you deploy.

In this post, we'll look at why traditional testing fails for LLMs and how we use assertion-based testing in CI to catch these regressions before they hit production.

## The Problem: Silent Drifts and Breaking Changes

The core issue is that LLMs are black boxes. We treat them like APIs, but they don't follow semver. A "minor optimization" on the provider's end can completely derail a carefully tuned prompt.

I've seen this happen in real-time. We had a prompt that extracted customer intent into a specific JSON schema. It worked perfectly for months. Then, one morning, the model started wrapping the JSON in markdown code blocks (`json ... `) despite being told not to. Our parser broke, the feature died, and we only found out because our error monitoring spiked.

If this were a regular function, we'd have a unit test. But how do you unit test something that is non-deterministic and changes its mind every few weeks?

## The Naive Fix: Manual Eyeballing and Snapshots

When we first started, our "testing" was just pasting the prompt into ChatGPT and checking if the output looked okay. This obviously doesn't scale.

Then we tried snapshot testing. We'd save a "good" response to a file and compare new responses against it. This failed immediately. LLMs are non-deterministic; even with `temperature: 0`, you'll often get slight variations in wording or punctuation. Your tests will be 90% false positives, and eventually, you'll just start ignoring them.

We needed a way to test the _properties_ of the response, not the exact string.

## A Better Approach: Assertion-Based Prompt Testing

Think about how you test a UI component. You don't usually assert that the HTML is an exact string match. Instead, you assert that the button exists, it has the right label, and it's not hidden.

We can apply the same logic to prompts. Instead of checking if the response is _exactly_ "The refund window is 30 days," we assert on properties we care about:

- Does it contain the number "30"?
- Is it under 500 characters?
- Is it valid JSON?
- Does it match our required schema?
- Is the "vibe" or meaning still the same? (Semantic similarity)

This is what we call Assertion-Based Prompt Testing. It gives you the flexibility to handle non-determinism while still catching the regressions that actually matter.

## Implementation with PromptCanary

We built [PromptCanary](https://github.com/VebjornNyvoll/promptcanary) to make this pattern easy to implement in existing TypeScript/JavaScript test suites. It's a tiny (22KB) library that fits right into Vitest, Jest, or Mocha.

First, install it:

```bash
npm install --save-dev promptcanary
```

Here’s how you’d write a test for a support agent prompt using Vitest:

```typescript
import { describe, it, expect } from 'vitest';
import { testPrompt, assertions } from 'promptcanary';

describe('refund policy prompt', () => {
  it('mentions 30-day return window', async () => {
    const result = await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a support agent. Refund policy: 30 days, full refund.',
        },
        { role: 'user', content: 'What is the refund policy?' },
      ],
    });

    // Assert on specific properties
    expect(assertions.contains(result.content, '30').passed).toBe(true);
    expect(assertions.maxLength(result.content, 500).passed).toBe(true);
  });
});
```

### Batch Assertions

If you have a lot of requirements, you can use `runAll` to check them in one go. This is great for keeping your tests clean:

```typescript
const check = assertions.runAll(result.content, [
  { type: 'contains', value: 'refund' },
  { type: 'max_length', value: 500 },
  { type: 'regex', value: '\\d+ days' },
]);

expect(check.passed).toBe(true);
```

### Catching "Meaning Drift" with Semantic Similarity

Sometimes, keywords aren't enough. You want to make sure the _meaning_ of the response hasn't drifted, even if the wording changed. PromptCanary supports semantic similarity using embeddings:

```typescript
import { semanticSimilarity } from 'promptcanary';

const score = await semanticSimilarity(
  result.content,
  'Customers can get a full refund within 30 days of purchase.',
);

// A score of 1.0 is an exact semantic match
expect(score).toBeGreaterThan(0.8);
```

This is incredibly powerful for catching those subtle shifts where the model starts sounding too robotic, or worse, starts giving slightly incorrect advice that still contains the right keywords.

## Running in CI

The whole point of this is to catch regressions _before_ they merge. Since PromptCanary is just a JS library, you can run it in your existing CI pipeline.

Here’s a simple GitHub Actions snippet:

```yaml
- name: Run prompt tests
  run: npx vitest run tests/prompts/
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Or, if you prefer a more managed approach, you can use the PromptCanary GitHub Action:

```yaml
- uses: VebjornNyvoll/promptcanary/.github/actions/run@master
  with:
    config: promptcanary.yaml
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Now, every PR will verify that your prompts still behave as expected. If OpenAI updates a model and your "30-day" mention disappears, your build fails.

## Honest Limitations

Let's be real: testing LLMs is still harder than testing a pure function.

1. **Flakiness:** Because of non-determinism, you might occasionally get a "flake" where a perfectly good prompt fails an assertion. We recommend using lenient thresholds (like 0.8 for similarity) and focusing on structural properties rather than exact wording.
2. **Cost:** Every test run makes an actual API call. If you have 1,000 prompt tests and run them on every commit, your bill will notice. We suggest grouping prompt tests and perhaps running them only on PRs or on a schedule.
3. **Scope:** PromptCanary is built for _regression testing_—making sure what worked yesterday still works today. If you need to do massive, multi-model evaluation or red-teaming, tools like `promptfoo` are excellent and more comprehensive.

## Closing

If you're shipping LLM features to production, you can't rely on manual testing. The models are moving too fast.

PromptCanary was designed to be the simplest possible way to add a safety net to your prompts. It’s 22KB, requires zero infrastructure, and fits into the test suite you already have.

- **Docs:** [https://vebjornnyvoll.github.io/promptcanary/](https://vebjornnyvoll.github.io/promptcanary/)
- **NPM:** [https://www.npmjs.com/package/promptcanary](https://www.npmjs.com/package/promptcanary)
- **GitHub:** [https://github.com/VebjornNyvoll/promptcanary](https://github.com/VebjornNyvoll/promptcanary)

If you ship LLM features, add prompt tests to your CI pipeline. Your future self (and your users) will thank you.
