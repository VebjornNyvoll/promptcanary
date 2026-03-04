# Getting Started

This guide gets PromptCanary running end to end: install, configure credentials, run tests, and inspect results.

## 1) Install PromptCanary

Install globally to use the `promptcanary` CLI command anywhere:

```bash
npm install -g promptcanary
```

## 2) Set up API keys

PromptCanary reads API keys from environment variables.

### Local development with `.env`

The CLI auto-loads `.env` in the current directory.

```bash
cp .env.example .env
# Edit .env with your keys
promptcanary run promptcanary.yaml
```

Use `--dotenv` to load a file from another path:

```bash
promptcanary --dotenv ~/.config/promptcanary/.env run promptcanary.yaml
```

Notes:

- `.env` is gitignored by default and should never be committed.
- `dotenv` does not overwrite variables that are already set in your shell.

### Shell profile setup

Set variables in your shell profile (`~/.bashrc`, `~/.zshrc`, or PowerShell profile):

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="AIza..."
```

### CI/CD setup

Use your CI provider secrets manager and inject env vars at runtime:

```yaml
- run: promptcanary run promptcanary.yaml
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
```

### Docker and production setup

Pass keys via environment variables and use your platform secret manager:

```bash
docker run -e OPENAI_API_KEY="$OPENAI_API_KEY" -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" -e GOOGLE_API_KEY="$GOOGLE_API_KEY" promptcanary run promptcanary.yaml
```

## 3) Create a config file

Generate starter config from the built-in template:

```bash
promptcanary init
```

This creates `promptcanary.yaml` in your current directory.

## 4) Run your first test suite

Run all configured tests and providers with verbose progress output:

```bash
promptcanary run promptcanary.yaml --verbose
```

## 5) View stored results

Inspect recent test runs from SQLite:

```bash
promptcanary results
```

## 6) Next steps

- Enable continuous monitoring with `promptcanary monitor promptcanary.yaml`
- Add CI checks in pull requests
- Configure Slack or webhook alerts for failures
