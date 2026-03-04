# CI/CD Integration

Run PromptCanary in CI to catch prompt regressions before production.

## GitHub Actions example

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

## Exit codes

- `0`: all tests passed
- `1`: at least one test failed or execution error

Use this to fail CI jobs when prompt quality regresses.

## Machine-readable output with `--json`

Use JSON output for custom CI parsing and reporting:

```bash
promptcanary run promptcanary.yaml --json
```

## Best practices

- Run on pull requests to catch regressions before merge.
- Keep API keys in CI secrets, never in repository files.
- Run with at least one fast model for quick feedback.
- Add nightly scheduled checks for broader provider/model coverage.

## Multi-provider CI example

```yaml
- run: node dist/cli/index.js run promptcanary.yaml --json
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
```
