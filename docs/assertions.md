# Assertions and Expectations

PromptCanary compares responses using structural rules plus optional semantic similarity.

## Assertion types

### `format`

Valid values:

- `bullet_points`
- `numbered_list`
- `json`
- `plain_text`
- `markdown`

Example:

```yaml
expect:
  format: json
```

### `min_length` and `max_length`

Use character-length bounds to catch truncated or excessively long outputs.

```yaml
expect:
  min_length: 40
  max_length: 500
```

Validation rule: `min_length` must be less than or equal to `max_length`.

### `must_contain` and `must_not_contain`

Use required and forbidden terms for contract-like checks.

```yaml
expect:
  must_contain: [refund policy, SLA]
  must_not_contain: [I cannot help, error]
```

### `startsWith` and `endsWith`

Check if content begins or ends with a specific string (case-insensitive).

```typescript
// Programmatic API
assertions.startsWith('Hello World', 'Hello'); // { passed: true, ... }
assertions.endsWith('Hello World', 'World'); // { passed: true, ... }

// With runAll()
assertions.runAll(content, [
  { type: 'starts_with', value: 'Dear Customer' },
  { type: 'ends_with', value: 'Best regards' },
]);
```

Both functions are case-insensitive, matching the behavior of `contains()`.

### `containsAll` and `containsAny`

Check if content contains multiple substrings (all or any).

```typescript
// Programmatic API
assertions.containsAll('Hello World Test', ['Hello', 'World']); // { passed: true, ... }
assertions.containsAny('Hello World', ['Goodbye', 'Hello']); // { passed: true, ... }

// With runAll()
assertions.runAll(content, [
  { type: 'contains_all', value: ['refund', 'policy', 'days'] },
  { type: 'contains_any', value: ['error', 'warning', 'failed'] },
]);
```

- `containsAll(content, substrings)`: Passes if ALL substrings are found (case-insensitive). Reports missing substrings in details.
- `containsAny(content, substrings)`: Passes if AT LEAST ONE substring is found (case-insensitive). Reports which one matched or that none did.

Both functions are case-insensitive, matching the behavior of `contains()`.

### `caseSensitiveContains`

Check if content contains a substring with exact case matching.

```typescript
// Programmatic API
assertions.caseSensitiveContains('Hello World', 'Hello'); // { passed: true, ... }
assertions.caseSensitiveContains('Hello World', 'hello'); // { passed: false, ... }

// With runAll()
assertions.runAll(content, [{ type: 'case_sensitive_contains', value: 'Error' }]);
```

Unlike `contains()` which is case-insensitive, `caseSensitiveContains()` requires exact case matching. Use this when you need to verify that specific capitalization is present in the response.

### `wordCount`

Check if content has a specific number of words within optional min/max bounds.

```typescript
// Programmatic API
assertions.wordCount('one two three four five', { min: 3, max: 10 }); // { passed: true, ... }
assertions.wordCount('hello world', { min: 5 }); // { passed: false, ... }

// With runAll()
assertions.runAll(content, [
  { type: 'word_count', value: { min: 10, max: 100 } },
  { type: 'word_count', value: { max: 50 } },
]);
```

- `wordCount(content, options)`: Counts words by splitting on whitespace. Passes if word count is within specified bounds.
  - `options.min`: Minimum word count (optional)
  - `options.max`: Maximum word count (optional)
  - If neither is specified, any word count passes
  - Empty or whitespace-only content counts as 0 words

### `levenshtein`

Compute normalized Levenshtein (edit distance) similarity between response content and expected text. Returns a score from 0.0 (completely different) to 1.0 (identical). Works locally with no API calls.

```typescript
// Programmatic API — score only (always passes)
assertions.levenshtein('hello world', 'hello world'); // { passed: true, score: 1.0, ... }

// With threshold — pass/fail based on minimum score
assertions.levenshtein('hello world', 'hello wrold', { threshold: 0.8 });
// { passed: true, score: 0.909, ... }

assertions.levenshtein('abc', 'xyz', { threshold: 0.5 });
// { passed: false, score: 0.0, ... }

// With runAll()
assertions.runAll(content, [
  { type: 'levenshtein', value: { expected: 'expected output', threshold: 0.7 } },
]);
```

- `levenshtein(content, expected, options?)`: Normalized edit distance scorer.
  - `expected`: The reference string to compare against
  - `options.threshold`: Minimum score to pass (optional — without it, always passes)
  - Formula: `1 - editDistance / max(content.length, expected.length)`
  - Score of 1.0 = identical strings, 0.0 = completely different

## Operational assertions

Operational assertions check performance and resource metrics from the test result, not the response content.

### `latency`

Check if response latency is within acceptable limits.

```typescript
// Programmatic API
const result = await testPrompt({
  /* ... */
});
assertions.latency(result.latencyMs, { max: 500 }); // { passed: true, ... }

// Typical usage in tests
it('responds within 500ms', async () => {
  const result = await testPrompt({
    provider: 'openai',
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello' }],
  });
  expect(assertions.latency(result.latencyMs, { max: 500 }).passed).toBe(true);
});
```

- `latency(latencyMs, options)`: Checks response latency in milliseconds.
  - `latencyMs`: The latency value from `TestPromptResult.latencyMs`
  - `options.max`: Maximum acceptable latency in milliseconds (required)
  - Passes if `latencyMs <= max`

### `tokenCount`

Check if token usage is within acceptable limits.

```typescript
// Programmatic API
const result = await testPrompt({
  /* ... */
});
assertions.tokenCount(result.tokenUsage, { max: 1000 }); // { passed: true, ... }

// Check specific token types
assertions.tokenCount(result.tokenUsage, {
  maxPrompt: 500,
  maxCompletion: 500,
});

// Check all limits simultaneously
assertions.tokenCount(result.tokenUsage, {
  max: 1000,
  maxPrompt: 500,
  maxCompletion: 500,
});

// Typical usage in tests
it('uses tokens efficiently', async () => {
  const result = await testPrompt({
    provider: 'openai',
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Summarize this...' }],
  });
  expect(assertions.tokenCount(result.tokenUsage, { max: 1000 }).passed).toBe(true);
});
```

- `tokenCount(tokenUsage, options)`: Checks token usage metrics.
  - `tokenUsage`: The token usage object from `TestPromptResult.tokenUsage` with `{ prompt: number, completion: number }`
  - `options.max`: Maximum total tokens (prompt + completion) (optional)
  - `options.maxPrompt`: Maximum prompt tokens (optional)
  - `options.maxCompletion`: Maximum completion tokens (optional)
  - Passes if all specified limits are met
  - At least one limit must be specified
  - Useful for monitoring API costs and ensuring efficient prompt design

### `tone`

Allowed values:

- `professional`
- `casual`
- `technical`
- `friendly`
- `formal`

Example:

```yaml
expect:
  tone: professional
```

### `semantic_similarity`

Checks meaning similarity against a baseline response using embeddings.

```yaml
expect:
  semantic_similarity:
    baseline: The service is available and healthy.
    threshold: 0.8
```

- `baseline`: required reference text
- `threshold`: number from `0` to `1` (default `0.8`)

## Three-layer comparison pipeline

PromptCanary evaluates responses in three layers:

1. Structural assertions (`format`, `length`, required/forbidden terms, tone).
2. Semantic similarity via cosine similarity between response and baseline embeddings.
3. Drift detection against historical semantic scores.

Drift detection flags significant score drops using a moving average baseline:

- More than 2 standard deviations below historical average, or
- More than 10 percent below average (whichever is more lenient)

## Reliability tips

- Use several assertion types together instead of one strict check.
- Keep baselines short and stable for semantic comparisons.
- Avoid brittle `must_contain` strings that depend on exact phrasing.
- Set realistic thresholds; tune from observed production runs.
- Use provider-specific tests when behavior intentionally differs across models.
