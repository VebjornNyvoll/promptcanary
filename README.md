# PromptCanary

> Uptime monitoring for AI behavior. Runs your test suite against your prompts on a schedule, alerts you before your users notice that a model update broke something.

## Why PromptCanary?

Prompt behavior drifts silently as providers roll out model updates, and teams usually find out from users after production quality drops. PromptCanary closes that gap by continuously validating your critical prompts, comparing responses against expectations, and alerting you when behavior changes before incidents reach customers.

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a starter config:

   ```bash
   promptcanary init
   ```

3. Run your first test suite:

   ```bash
   promptcanary run promptcanary.yaml
   ```

## Installation

Install globally to use the `promptcanary` command anywhere:

```bash
npm install -g promptcanary
```

## API Keys

PromptCanary reads API keys from environment variables. Choose the approach that fits your environment:

### Local development (`.env` file)

The CLI auto-loads a `.env` file from the current directory. Copy the template and fill in your keys:

```bash
cp .env.example .env
# Edit .env with your keys
promptcanary run promptcanary.yaml
```

`.env` is gitignored and never committed. dotenv will not overwrite variables already set in your shell.

To load a `.env` file from a different location (e.g. outside your repo for extra security):

```bash
promptcanary --dotenv ~/.config/promptcanary/.env run promptcanary.yaml
```

### Shell profile (more secure locally)

Set keys in your shell profile (`~/.bashrc`, `~/.zshrc`, or PowerShell `$PROFILE`) so they never exist in a project file that AI coding tools or other programs could read:

```bash
# ~/.bashrc or ~/.zshrc
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

### CI/CD

Use your CI provider's secrets management. Keys are injected as environment variables at runtime and never touch disk:

```yaml
# GitHub Actions
- run: promptcanary run promptcanary.yaml
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Production / Docker

Pass keys via environment variables. Use your platform's secret management (AWS Secrets Manager, Vault, Doppler, etc.):

```bash
docker run -e OPENAI_API_KEY="$OPENAI_API_KEY" promptcanary run config.yaml
```

## Configuration Reference

PromptCanary uses a YAML config file (typically `promptcanary.yaml`) with this structure:

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

  schedule: '0 */6 * * *'

  alerts:
    - type: slack
      webhook_url_env: SLACK_WEBHOOK_URL
    - type: webhook
      url: https://example.com/promptcanary
      headers:
        Authorization: Bearer your-token

  embedding_provider:
    api_key_env: OPENAI_API_KEY
    model: text-embedding-3-small

tests:
  - name: 'Professional greeting'
    prompt: 'Say hello in a professional way'
    variables:
      company: PromptCanary
    providers: [openai]
    expect:
      format: plain_text
      min_length: 20
      max_length: 200
      must_contain: ['hello']
      must_not_contain: ['error']
      tone: professional
      semantic_similarity:
        baseline: 'Hello and welcome. How can I help you today?'
        threshold: 0.8
```

Field-by-field reference:

- `version`: Config schema version. Must be `"1"`.
- `config.providers`: One or more model provider definitions.
  - `name`: Provider identifier (for example `openai`, `anthropic`).
  - `model`: Model name used for this provider.
  - `api_key_env`: Environment variable containing the API key.
  - `temperature` (optional): Sampling temperature (0 to 2).
  - `max_tokens` (optional): Maximum completion tokens.
  - `timeout_ms` (optional): Request timeout in milliseconds (default `30000`).
- `config.schedule` (optional): Cron expression for continuous monitoring.
- `config.alerts` (optional): Alert channel list.
  - `type: slack`: Requires `webhook_url_env`.
  - `type: webhook`: Requires `url`, optional `headers`.
  - `type: email`: Schema supports it, but runtime sending is not implemented yet.
- `config.embedding_provider` (optional): Embedding model for semantic similarity.
  - `api_key_env`: Environment variable for embedding API key.
  - `model`: Embedding model name.
- `tests`: One or more prompt tests.
  - `name`: Human-readable test name.
  - `prompt`: Prompt text sent to the provider.
  - `variables` (optional): Key-value variables interpolated into `{{variable}}` placeholders.
  - `providers` (optional): Restrict this test to specific provider names.
  - `expect`: Assertions for response validation.
    - `format` (optional): `bullet_points`, `numbered_list`, `json`, `plain_text`, or `markdown`.
    - `min_length` / `max_length` (optional): Response length constraints.
    - `must_contain` / `must_not_contain` (optional): Required or forbidden strings.
    - `tone` (optional): Expected tone (`professional`, `casual`, `technical`, `friendly`, `formal`).
    - `semantic_similarity` (optional): Embedding-based similarity check against a baseline.

## CLI Reference

### `promptcanary init`

Create a starter `promptcanary.yaml` in the current directory from `examples/basic.yaml`.

```bash
promptcanary init
```

### `promptcanary validate <file>`

Load and validate a config file.

```bash
promptcanary validate promptcanary.yaml
```

Returns exit code `0` when valid and `1` when invalid.

### `promptcanary run <file>`

Run all tests against all configured providers, compare responses, and persist results in SQLite.

```bash
promptcanary run promptcanary.yaml
```

Flags:

- `--json`: Output machine-readable JSON.
- `--verbose`: Print progress for each provider execution.
- `--dotenv <path>`: Load environment variables from a specific file instead of `.env`.

Examples:

```bash
promptcanary run promptcanary.yaml --verbose
promptcanary run promptcanary.yaml --json
```

Returns exit code `0` if all tests pass, `1` if any test fails.

### `promptcanary monitor <file>`

Start continuous monitoring using `config.schedule` (cron syntax). Supports graceful shutdown on `SIGINT` and `SIGTERM`.

```bash
promptcanary monitor promptcanary.yaml
```

### `promptcanary results [--last N]`

Show recent stored runs from SQLite (`promptcanary.db`).

```bash
promptcanary results
promptcanary results --last 25
```

Defaults to the latest 10 runs.

## Providers

### OpenAI

1. Export your API key:

   ```bash
   export OPENAI_API_KEY="your-key"
   ```

2. Configure provider entry:

   ```yaml
   config:
     providers:
       - name: openai
         model: gpt-4o-mini
         api_key_env: OPENAI_API_KEY
   ```

### Anthropic

1. Export your API key:

   ```bash
   export ANTHROPIC_API_KEY="your-key"
   ```

2. Configure provider entry:

   ```yaml
   config:
     providers:
       - name: anthropic
         model: claude-3-5-sonnet-20241022
         api_key_env: ANTHROPIC_API_KEY
   ```

You can run the same test suite across both providers to detect portability issues and provider-specific drift.

## Alerting

### Slack

Add a Slack incoming webhook, store it in an environment variable, then configure:

```yaml
config:
  alerts:
    - type: slack
      webhook_url_env: SLACK_WEBHOOK_URL
```

### Webhook

Send failures to any HTTP endpoint:

```yaml
config:
  alerts:
    - type: webhook
      url: https://example.com/promptcanary-alerts
      headers:
        Authorization: Bearer your-token
```

## GitHub Action

Use PromptCanary in CI to catch prompt regressions before deploy.

```yaml
name: Prompt Canary

on:
  pull_request:
  push:
    branches: [main]

jobs:
  prompt-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: node dist/cli/index.js run promptcanary.yaml
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Troubleshooting

### Native module: better-sqlite3

PromptCanary uses [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for local result storage. It ships prebuilt binaries for most platforms, but you may need extra steps in some environments.

**Prebuilt binaries fail to download:**

```bash
# Force rebuild from source (requires Python 3 and a C++ compiler)
npm rebuild better-sqlite3
```

**Alpine Linux / Docker (musl libc):**

```dockerfile
RUN apk add --no-cache python3 make g++
RUN npm install
```

**CI environments (GitHub Actions):**

The CI matrix already tests on ubuntu, windows, and macOS with Node 20 and 22. If you use a custom runner, ensure `python3`, `make`, and a C++ toolchain are available.

**Windows:**

Install the "Desktop development with C++" workload from Visual Studio Build Tools, or run:

```bash
npm install --global windows-build-tools
```

## How It Works

1. PromptCanary loads your YAML test cases and provider settings.
2. The runner executes each test prompt across target providers.
3. The comparator evaluates structural assertions and optional semantic similarity.
4. Results are stored in SQLite for trend tracking and drift detection.
5. Alert channels dispatch notifications for failures.
6. Scheduler mode repeats this flow on your cron interval for continuous monitoring.

## License

MIT
