# Configuration

PromptCanary uses YAML configuration (typically `promptcanary.yaml`) with provider settings, optional embedding configuration, and one or more test cases.

## Complete example

```yaml
version: '1'

config:
  providers:
    - name: openai
      model: gpt-4o-mini
      api_key_env: OPENAI_API_KEY
      temperature: 0.2
      max_tokens: 300
      timeout_ms: 30000

    - name: anthropic
      model: claude-3-5-sonnet
      api_key_env: ANTHROPIC_API_KEY
      temperature: 0.2
      max_tokens: 300
      timeout_ms: 30000

    - name: google
      model: gemini-2.0-flash
      api_key_env: GOOGLE_API_KEY
      temperature: 0.2
      max_tokens: 300
      timeout_ms: 30000

  embedding_provider:
    api_key_env: OPENAI_API_KEY
    model: text-embedding-3-small

tests:
  - name: Professional greeting
    prompt: Say hello in a professional way to {{company}}.
    variables:
      company: PromptCanary
    providers: [openai, anthropic, google]
    expect:
      format: plain_text
      min_length: 20
      max_length: 200
      must_contain: ['hello']
      must_not_contain: ['error']
      tone: professional
      semantic_similarity:
        baseline: Hello and welcome. How can I help you today?
        threshold: 0.8
```

## Field reference

### Top level

- `version`: Config schema version. Must be `"1"`.
- `config`: Global runtime configuration.
- `tests`: Array of test cases. At least one is required.

### `config.providers`

One or more provider entries:

- `name`: Provider id (for example `openai`, `anthropic`, `google`).
- `model`: Provider model identifier.
- `api_key_env`: Environment variable containing API key.
- `temperature` (optional): Number between `0` and `2`.
- `max_tokens` (optional): Positive integer maximum response tokens.
- `timeout_ms` (optional): Positive integer timeout in milliseconds. Defaults to `30000`.

### `config.embedding_provider`

Optional embedding config for semantic similarity checks:

- `api_key_env`: Environment variable for embedding API key (default `OPENAI_API_KEY`).
- `model`: Embedding model name (default `text-embedding-3-small`).

### `tests[]`

Each test contains:

- `name`: Human-readable test name.
- `prompt`: Prompt text sent to provider.
- `variables` (optional): Key-value map for interpolation.
- `providers` (optional): Restrict this test to specific providers.
- `expect`: Assertions and semantic expectations.

## Template variables

PromptCanary supports `{{variable}}` interpolation in `prompt` values.

```yaml
tests:
  - name: Support response
    prompt: Respond to {{customer_name}} about {{topic}} in a friendly tone.
    variables:
      customer_name: Alex
      topic: delayed shipment
```

Interpolation details:

- Uses `{{variable}}` syntax with optional whitespace (`{{ variable }}`).
- Replaces all occurrences in the prompt.
- If `variables` is missing, prompt is used as-is.

## Best practices for reliable tests

- Keep prompts deterministic where possible and avoid unnecessary randomness.
- Use `must_contain` for critical terms and `must_not_contain` for banned phrases.
- Set practical `min_length` and `max_length` bounds to catch truncation and rambling.
- Prefer semantic similarity for meaning-level checks over strict string equality.
- Run the same tests on multiple providers to catch portability regressions.
- Start thresholds conservatively, then tune based on historical results.
