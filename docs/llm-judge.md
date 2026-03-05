# LLM-as-Judge Evaluation

Use a language model to evaluate LLM responses against custom criteria. This enables subjective evaluation — tone, helpfulness, factuality, safety — with just one extra API call per assertion.

## Basic Usage

```typescript
import { judge } from 'promptcanary';

const result = await judge(
  'Our refund policy allows returns within 30 days of purchase.',
  'Is the response clear and professional?',
);

console.log(result.score); // 0.0 - 1.0
console.log(result.pass); // true if score >= 0.5
console.log(result.reason); // "The response is concise and professional..."
```

## With Test Runners

```typescript
import { describe, it, expect } from 'vitest';
import { testPrompt, judge } from 'promptcanary';

describe('customer support prompt', () => {
  it('responds professionally', async () => {
    const response = await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'I want a refund' }],
    });

    const evaluation = await judge(
      response.content,
      'The response is polite, empathetic, and provides clear next steps',
    );

    expect(evaluation.pass).toBe(true);
    expect(evaluation.score).toBeGreaterThan(0.7);
  });
});
```

## JudgeOptions

| Option        | Type                                  | Default         | Description                               |
| ------------- | ------------------------------------- | --------------- | ----------------------------------------- |
| `provider`    | `'openai' \| 'anthropic' \| 'google'` | `'openai'`      | LLM provider for the judge                |
| `model`       | `string`                              | `'gpt-4o-mini'` | Model to use as judge                     |
| `apiKey`      | `string`                              | env variable    | API key override                          |
| `temperature` | `number`                              | `0`             | Temperature for judge (0 = deterministic) |
| `timeoutMs`   | `number`                              | `30000`         | Request timeout in milliseconds           |

```typescript
const result = await judge(content, criteria, {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
});
```

## JudgeResult

```typescript
interface JudgeResult {
  score: number; // 0.0 (completely fails) to 1.0 (perfectly meets criteria)
  pass: boolean; // true if score >= threshold
  reason: string; // Judge's explanation for the score
}
```

## Low-Level API

For advanced use cases, `callJudge` accepts a raw prompt:

```typescript
import { callJudge } from 'promptcanary';

const result = await callJudge({
  prompt: 'Evaluate whether this text is formal: "Hey dude, check this out"',
  model: 'gpt-4o',
});
```

`parseJudgeResponse` can parse raw LLM output into a `JudgeResult`:

```typescript
import { parseJudgeResponse } from 'promptcanary';

const result = parseJudgeResponse('{"score": 0.85, "pass": true, "reason": "Meets criteria"}');
```

## llmRubric

Evaluate LLM output against custom criteria using a ClosedQA-style rubric. This is the most versatile judge scorer — provide criteria in plain English, and the judge evaluates whether the output meets them.

```typescript
import { assertions } from 'promptcanary';

const result = await assertions.llmRubric(
  'Our refund policy allows returns within 30 days of purchase.',
  {
    criteria: 'The response should be professional in tone and mention the refund policy',
    input: 'What is your refund policy?', // optional: original prompt
    threshold: 0.7, // optional: pass/fail threshold (default: 0.5)
    judge: { model: 'gpt-4o-mini' }, // optional: judge configuration
  },
);

expect(result.pass).toBe(true);
expect(result.score).toBeGreaterThan(0.7);
```

### LlmRubricOptions

| Option      | Type           | Default | Description                                     |
| ----------- | -------------- | ------- | ----------------------------------------------- |
| `criteria`  | `string`       | —       | Natural language evaluation criteria (required) |
| `input`     | `string`       | —       | Original user prompt for context                |
| `threshold` | `number`       | `0.5`   | Score threshold for pass/fail                   |
| `judge`     | `JudgeOptions` | —       | Judge model configuration                       |

## factuality

Evaluate whether LLM output is factually consistent with a reference answer. Uses a 5-way classification adapted from the autoevals factuality template:

| Category | Description                           | Score |
| -------- | ------------------------------------- | ----- |
| (A)      | Subset of expert answer, consistent   | 0.4   |
| (B)      | Superset of expert answer, consistent | 0.6   |
| (C)      | Same details as expert answer         | 1.0   |
| (D)      | Disagrees with expert answer          | 0.0   |
| (E)      | Differs but not factually relevant    | 1.0   |

```typescript
import { assertions } from 'promptcanary';

const result = await assertions.factuality(
  'The company was founded in 2019 by Jane Smith in San Francisco.',
  {
    input: 'When was the company founded?',
    expected: 'The company was founded in 2019 by Jane Smith.',
    judge: { model: 'gpt-4o-mini' },
  },
);
// result.score → 0.6 (B: superset, consistent)
```

### FactualityOptions

| Option     | Type           | Default | Description                        |
| ---------- | -------------- | ------- | ---------------------------------- |
| `input`    | `string`       | —       | The original question (required)   |
| `expected` | `string`       | —       | Expert reference answer (required) |
| `judge`    | `JudgeOptions` | —       | Judge model configuration          |

## Coming Soon

Specialized scorers building on this infrastructure:

- **`answerRelevance`** — Response relevance to the input question
- **`faithfulness`** — RAG hallucination detection
- **`toxicity`** — Harmful content detection
