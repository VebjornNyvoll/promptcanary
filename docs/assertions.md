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
