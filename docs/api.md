# API Reference

## Testing API

These are the primary functions for writing prompt tests in your test suite.

### `testPrompt(options)`

Send a prompt to an LLM provider and get back a typed result.

```typescript
import { testPrompt } from 'promptcanary';

const result = await testPrompt({
  provider: 'openai',
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'What is the refund policy?' }],
});
```

**Parameters** — `TestPromptOptions`:

| Parameter     | Type                                  | Required | Default          | Description                     |
| ------------- | ------------------------------------- | -------- | ---------------- | ------------------------------- |
| `provider`    | `'openai' \| 'anthropic' \| 'google'` | Yes      |                  | LLM provider to use             |
| `model`       | `string`                              | Yes      |                  | Model identifier                |
| `messages`    | `ChatMessage[]`                       | Yes      |                  | Conversation messages           |
| `apiKey`      | `string`                              | No       | From env         | Override the API key            |
| `temperature` | `number`                              | No       | Provider default | Sampling temperature            |
| `maxTokens`   | `number`                              | No       | Provider default | Maximum output tokens           |
| `timeoutMs`   | `number`                              | No       | `30000`          | Request timeout in milliseconds |

`ChatMessage` has the shape `{ role: 'system' | 'user' | 'assistant', content: string }`.

**Returns** — `TestPromptResult`:

| Field        | Type                                     | Description                   |
| ------------ | ---------------------------------------- | ----------------------------- |
| `content`    | `string`                                 | Model's response text         |
| `model`      | `string`                                 | Model that responded          |
| `provider`   | `string`                                 | Provider name                 |
| `latencyMs`  | `number`                                 | Response time in milliseconds |
| `tokenUsage` | `{ prompt: number, completion: number }` | Token counts                  |

**Errors**: Throws `ProviderError` (or subclass `TimeoutError`, `RateLimitError`) on failure.

**API key resolution**: If `apiKey` is not provided, `testPrompt` reads from the environment variable for the provider (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_API_KEY`).

---

### `semanticSimilarity(actual, expected, options?)`

Compute the cosine similarity between two strings using OpenAI embeddings.

```typescript
import { semanticSimilarity } from 'promptcanary';

const score = await semanticSimilarity(
  'Refunds are processed within 30 business days.',
  'You can get a full refund within 30 days of purchase.',
);
// score → 0.0 to 1.0
```

**Parameters**:

| Parameter        | Type     | Required | Default                    | Description                 |
| ---------------- | -------- | -------- | -------------------------- | --------------------------- |
| `actual`         | `string` | Yes      |                            | First text to compare       |
| `expected`       | `string` | Yes      |                            | Second text to compare      |
| `options.model`  | `string` | No       | `'text-embedding-3-small'` | Embedding model to use      |
| `options.apiKey` | `string` | No       | From `OPENAI_API_KEY`      | Override the OpenAI API key |

**Returns**: `Promise<number>` — cosine similarity score between 0.0 and 1.0.

---

### `assertions`

Synchronous assertion helpers for validating prompt responses. Each function returns an `AssertionResult`.

```typescript
import { assertions } from 'promptcanary';
```

#### `assertions.contains(content, substring)`

Checks that `content` includes `substring` (case-insensitive).

```typescript
assertions.contains('Your refund will arrive in 30 days', 'refund');
// { passed: true, type: 'contains', expected: 'contains "refund"', actual: 'found' }
```

#### `assertions.notContains(content, substring)`

Checks that `content` does not include `substring` (case-insensitive).

#### `assertions.maxLength(content, max)`

Checks that `content.length <= max`.

#### `assertions.minLength(content, min)`

Checks that `content.length >= min`.

#### `assertions.matchesRegex(content, pattern)`

Checks that `content` matches `pattern` (accepts `RegExp` or `string`).

```typescript
assertions.matchesRegex('Delivery in 5 days', /\d+ days/);
```

#### `assertions.isJson(content)`

Checks that `content` is valid JSON.

#### `assertions.matchesJsonSchema(content, schema)`

Checks that `content` is a JSON object whose keys match the expected `typeof` values.

```typescript
assertions.matchesJsonSchema('{"name":"Alice","age":30}', { name: 'string', age: 'number' });
```

The `schema` parameter is a plain object mapping key names to `typeof` strings (e.g. `'string'`, `'number'`, `'boolean'`).

#### `assertions.runAll(content, descriptors)`

Run multiple assertions at once and get an aggregate result.

```typescript
const check = assertions.runAll(content, [
  { type: 'contains', value: 'refund' },
  { type: 'max_length', value: 500 },
  { type: 'regex', value: '\\d+ days' },
  { type: 'is_json', value: '' },
]);
// check.passed → true if all pass
// check.results → AssertionResult[]
```

**Descriptor types**: `'contains'`, `'not_contains'`, `'max_length'`, `'min_length'`, `'regex'`, `'is_json'`, `'json_schema'`.

#### `AssertionResult`

Every assertion function returns this shape:

```typescript
{
  type: string;       // e.g. 'contains', 'max_length'
  passed: boolean;
  expected: string;   // Human-readable expectation
  actual: string;     // Human-readable actual value
  details?: string;   // Failure description (undefined on pass)
}
```

---

## Config-driven API

For teams using YAML config or building on PromptCanary's internals.

### `loadConfig(path)`

Load and validate a YAML config file from disk.

```typescript
import { loadConfig } from 'promptcanary';

const config = loadConfig('promptcanary.yaml');
```

### `validateConfig(data)`

Validate a config object against the PromptCanary schema.

```typescript
import { validateConfig } from 'promptcanary';

const config = validateConfig(rawObject);
```

### `runTests(options)`

Execute all tests defined in a config object.

```typescript
import { loadConfig, runTests } from 'promptcanary';

const config = loadConfig('promptcanary.yaml');
const results = await runTests({
  config,
  onProgress: (result) => console.log(result.test_name, result.comparison.passed),
});
```

**Signature**:

```typescript
runTests(options: {
  config: PromptCanaryConfig;
  onProgress?: (result: RunResult) => void;
}): Promise<RunResult[]>
```

### `compareResponse(options)`

Compare a response string against expectations.

```typescript
import { compareResponse } from 'promptcanary';

const comparison = await compareResponse({
  response: 'The refund takes 30 days.',
  expectations: { must_contain: ['refund'], max_length: 500 },
});
```

### `Storage`

SQLite-backed persistence for test results.

```typescript
import { Storage } from 'promptcanary';

const storage = new Storage();
storage.saveRun(testName, prompt, result);
const runs = storage.getRecentRuns(10);
storage.close();
```

### `startScheduler(options)`

Start a continuous monitoring scheduler (for daemon/cron use cases).

```typescript
import { loadConfig, startScheduler } from 'promptcanary';

const config = loadConfig('promptcanary.yaml');
const { stop } = startScheduler({ config });
```

### `dispatchAlerts(options)`

Dispatch alerts for failed test results to configured channels.

```typescript
import { dispatchAlerts, createAlertChannels } from 'promptcanary';

const channels = createAlertChannels(config.config.alerts ?? []);
await dispatchAlerts({ results: failedResults, channels });
```

---

## Error classes

| Class            | Extends         | Description                        |
| ---------------- | --------------- | ---------------------------------- |
| `ProviderError`  | `Error`         | Base class for provider failures   |
| `TimeoutError`   | `ProviderError` | Request timed out                  |
| `RateLimitError` | `ProviderError` | Provider rate limit hit            |
| `ConfigError`    | `Error`         | Config validation or loading error |

---

## Type exports

All types are importable from the package root:

```typescript
import type {
  TestPromptOptions,
  TestPromptResult,
  ChatMessage,
  SemanticSimilarityOptions,
  AssertionResult,
  AssertionDescriptor,
  RunAllResult,
  PromptCanaryConfig,
  ProviderConfig,
  Expectation,
  TestCase,
  RunResult,
  LLMResponse,
  ComparisonResult,
  AlertPayload,
  AlertChannel,
} from 'promptcanary';
```
