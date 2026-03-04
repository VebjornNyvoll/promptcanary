# Configuration Schema

This page documents the runtime schema implemented in `src/schema/test-case.ts` using Zod.

## `PromptCanaryConfigSchema`

```ts
{
  version: '1',
  config: {
    providers: ProviderConfig[],
    schedule?: string,
    alerts?: AlertConfig[],
    embedding_provider?: {
      api_key_env: string, // default: OPENAI_API_KEY
      model: string,       // default: text-embedding-3-small
    }
  },
  tests: TestCase[]
}
```

Constraints:

- `version` must be literal `"1"`.
- `config.providers` must contain at least 1 provider.
- `tests` must contain at least 1 test case.

## `ProviderConfigSchema`

Type:

```ts
{
  name: string,
  model: string,
  api_key_env: string,
  temperature?: number,
  max_tokens?: number,
  timeout_ms: number // default: 30000
}
```

Field constraints:

- `name`: non-empty string.
- `model`: non-empty string.
- `api_key_env`: non-empty string.
- `temperature`: number in range `0..2`.
- `max_tokens`: positive integer.
- `timeout_ms`: positive integer; default `30000`.

## `ResponseFormatSchema`

Enum values:

- `bullet_points`
- `numbered_list`
- `json`
- `plain_text`
- `markdown`

## `SemanticSimilaritySchema`

Type:

```ts
{
  baseline: string,
  threshold: number // default: 0.8
}
```

Field constraints:

- `baseline`: non-empty string.
- `threshold`: number in range `0..1`; default `0.8`.

## `ExpectationSchema`

Type:

```ts
{
  format?: ResponseFormat,
  max_length?: number,
  min_length?: number,
  must_contain?: string[],
  must_not_contain?: string[],
  tone?: 'professional' | 'casual' | 'technical' | 'friendly' | 'formal',
  semantic_similarity?: SemanticSimilarity
}
```

Field constraints:

- `max_length`: positive integer.
- `min_length`: non-negative integer.
- `must_contain`: array of non-empty strings.
- `must_not_contain`: array of non-empty strings.
- `tone`: enum of five values.
- `semantic_similarity`: optional nested object above.

Cross-field rule:

- If both are present, `min_length <= max_length`.

## `TestCaseSchema`

Type:

```ts
{
  name: string,
  prompt: string,
  variables?: Record<string, string>,
  providers?: string[],
  expect: Expectation
}
```

Field constraints:

- `name`: non-empty string.
- `prompt`: non-empty string.
- `variables`: record of string keys to string values.
- `providers`: array of non-empty strings.
- `expect`: required expectation object.

## `AlertConfigSchema` variants

`AlertConfigSchema` is a discriminated union keyed by `type`.

### Slack variant

```ts
{
  type: 'slack',
  webhook_url_env: string
}
```

Constraints:

- `webhook_url_env`: non-empty string.

### Webhook variant

```ts
{
  type: 'webhook',
  url: string,
  headers?: Record<string, string>
}
```

Constraints:

- `url`: non-empty string and must start with `http://` or `https://`.
- `headers`: optional string-to-string map.

## Embedding provider config

`config.embedding_provider` is optional and typed as:

```ts
{
  api_key_env: string, // default OPENAI_API_KEY
  model: string        // default text-embedding-3-small
}
```

Both fields are required if the object is present, but each has a default.

## Versioning

Current schema version is `"1"`.

- Any other value fails validation.
- Future schema changes should bump `version` and extend the parser accordingly.
