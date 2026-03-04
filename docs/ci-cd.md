# CI/CD Integration

PromptCanary is designed to run as a test step in your existing CI/CD pipeline. It exits with code `1` when any prompt test fails, so your pipeline's built-in alerting (Slack, email, PagerDuty) handles notifications — no extra setup needed.

**Two common patterns:**

| Pattern              | Trigger             | Purpose                               |
| -------------------- | ------------------- | ------------------------------------- |
| **Regression check** | Pull request / push | Catch prompt regressions before merge |
| **Drift detection**  | Nightly / scheduled | Detect silent model behavior changes  |

## GitHub Actions

### Regression check on pull requests

Run prompt tests whenever prompt-related files change:

```yaml
name: Prompt Tests

on:
  pull_request:
    paths:
      - 'promptcanary.yaml'
      - 'prompts/**'
  push:
    branches: [main, master]

jobs:
  prompt-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run prompt tests
        run: npx promptcanary@latest run promptcanary.yaml --verbose
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

The job fails automatically if any assertion fails — your existing GitHub notification settings handle the rest.

### Scheduled drift detection

Run nightly to catch silent model changes between deploys:

```yaml
name: Nightly Prompt Drift Check

on:
  schedule:
    - cron: '0 2 * * *' # 2 AM UTC daily
  workflow_dispatch: # Allow manual trigger

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run prompt tests
        run: npx promptcanary@latest run promptcanary.yaml --json > results.json
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: prompt-test-results
          path: results.json
```

::: tip
Use `if: always()` on the upload step so results are saved even when tests fail. This gives you historical data to investigate regressions.
:::

### Multi-provider matrix

Test across providers in parallel for faster feedback:

```yaml
jobs:
  prompt-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        config: [openai-tests.yaml, anthropic-tests.yaml, gemini-tests.yaml]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run ${{ matrix.config }}
        run: npx promptcanary@latest run ${{ matrix.config }} --verbose
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
```

### Using the PromptCanary action

As an alternative to running `npx` directly, you can use the built-in PromptCanary composite action:

```yaml
- uses: VebjornNyvoll/promptcanary/.github/actions/run@master
  with:
    config: promptcanary.yaml
    verbose: true
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## GitLab CI

```yaml
prompt-tests:
  image: node:20-slim
  stage: test
  script:
    - npx promptcanary@latest run promptcanary.yaml --json > results.json
  variables:
    OPENAI_API_KEY: ${OPENAI_API_KEY}
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
  artifacts:
    paths:
      - results.json
    when: always
  rules:
    - changes:
        - promptcanary.yaml
        - prompts/**/*

# Nightly drift detection
nightly-drift-check:
  image: node:20-slim
  stage: test
  script:
    - npx promptcanary@latest run promptcanary.yaml --verbose
  variables:
    OPENAI_API_KEY: ${OPENAI_API_KEY}
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
```

Store API keys in **Settings > CI/CD > Variables** with the "Masked" and "Protected" flags enabled.

## Any CI system

PromptCanary works anywhere Node.js runs. The core pattern is always the same:

```bash
# Install and run (nothing else required)
npx promptcanary@latest run promptcanary.yaml

# Exit code 0 = all tests passed
# Exit code 1 = at least one test failed
echo $?
```

This works in Jenkins, CircleCI, Azure DevOps, Buildkite, Travis CI, or a plain cron job on a server.

### Cron job example

```bash
# /etc/cron.d/promptcanary-nightly
0 2 * * * deploy OPENAI_API_KEY=sk-... npx promptcanary@latest run /app/promptcanary.yaml --json >> /var/log/promptcanary.log 2>&1
```

## Parsing JSON output

Use `--json` to get machine-readable results for custom reporting or quality gates:

```bash
npx promptcanary@latest run promptcanary.yaml --json > results.json
```

### JSON structure

The output is an array of test results:

```json
[
  {
    "test_name": "pricing-faq",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "run_id": "550e8400-e29b-41d4-a716-446655440000",
    "response": {
      "content": "Our refund policy allows returns within 30 days...",
      "model": "gpt-4o-mini",
      "provider": "openai",
      "latency_ms": 1234,
      "token_usage": { "prompt": 15, "completion": 42 },
      "timestamp": "2026-03-04T10:30:00.000Z"
    },
    "comparison": {
      "passed": true,
      "severity": "pass",
      "assertions": [
        {
          "type": "must_contain",
          "passed": true,
          "expected": "30 days",
          "actual": "Our refund policy allows returns within 30 days..."
        }
      ],
      "semantic_score": 0.95,
      "details": "All assertions passed"
    }
  }
]
```

### Quality gates with jq

```bash
# Count failures
FAILURES=$(cat results.json | jq '[.[] | select(.comparison.passed == false)] | length')
echo "$FAILURES test(s) failed"

# Fail if any test has low semantic similarity
LOW_SCORES=$(cat results.json | jq '[.[] | select(.comparison.semantic_score != null and .comparison.semantic_score < 0.8)] | length')
if [ "$LOW_SCORES" -gt 0 ]; then
  echo "Warning: $LOW_SCORES test(s) have semantic similarity below 0.8"
  exit 1
fi

# Extract failed test names
cat results.json | jq -r '.[] | select(.comparison.passed == false) | .test_name'
```

### Post results to a Slack webhook

```bash
FAILURES=$(cat results.json | jq '[.[] | select(.comparison.passed == false)] | length')
TOTAL=$(cat results.json | jq 'length')

if [ "$FAILURES" -gt 0 ]; then
  curl -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"text\": \"PromptCanary: $FAILURES/$TOTAL tests failed. <$CI_JOB_URL|View results>\"}"
fi
```

## Exit codes

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| `0`  | All tests passed                                           |
| `1`  | At least one test failed, config error, or missing API key |

Any CI system will mark the job as failed on exit code `1`. This means your existing pipeline notifications (email, Slack, PagerDuty, etc.) work automatically — no PromptCanary-specific alerting setup required.

## API key management

| CI Platform    | Where to store secrets                                       |
| -------------- | ------------------------------------------------------------ |
| GitHub Actions | Settings > Secrets and variables > Actions                   |
| GitLab CI      | Settings > CI/CD > Variables (enable "Masked" + "Protected") |
| Jenkins        | Credentials > Add Credentials > Secret text                  |
| CircleCI       | Project Settings > Environment Variables                     |
| Azure DevOps   | Pipelines > Library > Variable Groups                        |

**Required variables** depend on which providers you use:

| Provider      | Environment Variable |
| ------------- | -------------------- |
| OpenAI        | `OPENAI_API_KEY`     |
| Anthropic     | `ANTHROPIC_API_KEY`  |
| Google Gemini | `GOOGLE_API_KEY`     |

The variable names are configured in your `promptcanary.yaml` under `api_key_env`, so you can use any name you prefer.

## Best practices

- **Scope triggers to prompt files** — use `paths:` (GitHub) or `rules: changes:` (GitLab) so prompt tests only run when relevant files change.
- **Separate PR checks from drift detection** — use fast models and few tests for PR feedback; run the full suite nightly.
- **Save results as artifacts** — upload `results.json` so you can investigate failures after the fact.
- **Use `--json` in CI, `--verbose` locally** — JSON is for machines, verbose is for humans debugging failures.
- **Start with one provider** — add more providers once your config is stable to avoid burning API credits during iteration.
