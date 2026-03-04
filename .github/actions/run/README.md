# PromptCanary GitHub Action

Run PromptCanary prompt regression tests in GitHub Actions with minimal configuration.

## Usage (minimal setup)

```yaml
name: Prompt Tests

on:
  pull_request:
    paths:
      - 'promptcanary.yaml'
      - 'prompts/**'

jobs:
  prompt-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: VebjornNyvoll/promptcanary/.github/actions/run@master
        with:
          config: promptcanary.yaml
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Inputs

| Input          | Required | Default             | Description                                             |
| -------------- | -------- | ------------------- | ------------------------------------------------------- |
| `config`       | Yes      | `promptcanary.yaml` | Path to PromptCanary YAML config file                   |
| `version`      | No       | `latest`            | PromptCanary version to run via `npx`                   |
| `verbose`      | No       | `false`             | Enable verbose output (`--verbose`)                     |
| `json`         | No       | `false`             | Enable JSON output (`--json`)                           |
| `node-version` | No       | `20`                | Node.js version used by `actions/setup-node`            |
| `args`         | No       | `''`                | Additional CLI arguments appended to `promptcanary run` |

## Secrets and API keys

Pass provider API keys as environment variables (recommended via repository/workflow secrets), not action inputs.

```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
```

## Examples

### Basic usage

```yaml
- uses: VebjornNyvoll/promptcanary/.github/actions/run@master
  with:
    config: promptcanary.yaml
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Verbose output

```yaml
- uses: VebjornNyvoll/promptcanary/.github/actions/run@master
  with:
    config: promptcanary.yaml
    verbose: true
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### JSON output

```yaml
- uses: VebjornNyvoll/promptcanary/.github/actions/run@master
  with:
    config: promptcanary.yaml
    json: true
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Multiple providers

```yaml
- uses: VebjornNyvoll/promptcanary/.github/actions/run@master
  with:
    config: promptcanary.yaml
    verbose: true
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
```
