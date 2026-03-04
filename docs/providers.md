# Providers

PromptCanary supports OpenAI, Anthropic, and Google Gemini providers out of the box. You can run one test suite across all providers to catch model-specific drift and portability issues.

## OpenAI

Set environment variable:

```bash
export OPENAI_API_KEY="sk-..."
```

Configuration:

```yaml
config:
  providers:
    - name: openai
      model: gpt-4o-mini
      api_key_env: OPENAI_API_KEY
```

Common models:

- `gpt-4o`
- `gpt-4o-mini`

## Anthropic

Set environment variable:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Configuration:

```yaml
config:
  providers:
    - name: anthropic
      model: claude-3-5-sonnet
      api_key_env: ANTHROPIC_API_KEY
```

Common models:

- `claude-3-5-sonnet`
- `claude-3-haiku`

## Google Gemini

Set environment variable:

```bash
export GOOGLE_API_KEY="AIza..."
```

Configuration:

```yaml
config:
  providers:
    - name: google
      model: gemini-2.0-flash
      api_key_env: GOOGLE_API_KEY
```

Common models:

- `gemini-2.0-flash`
- `gemini-1.5-pro`

## Cross-provider testing

You can define providers globally and run each test across all providers, or target specific providers per test.

Run all configured providers:

```yaml
tests:
  - name: Summarization
    prompt: Summarize this article in five bullet points.
    expect:
      format: bullet_points
```

Run only selected providers for a test:

```yaml
tests:
  - name: JSON extraction
    prompt: Extract fields as JSON.
    providers: [openai, google]
    expect:
      format: json
```

## Provider interface for custom providers

PromptCanary uses a provider-agnostic interface:

```ts
interface LLMProvider {
  name: string;
  execute(prompt: string, config: ProviderConfig): Promise<LLMResponse>;
}

interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  latency_ms: number;
  token_usage: { prompt: number; completion: number };
  timestamp: Date;
}
```

Internally, built-in providers are registered and executed in parallel through the same interface, so adding additional providers does not require changing runner logic.
