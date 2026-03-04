# CLI Commands

PromptCanary CLI syntax:

```bash
promptcanary [global options] <command> [command options]
```

## Global options

- `--dotenv <path>`: path to `.env` file (defaults to `.env` in current directory)
- `--version`: print version
- `--help`: show help

## `promptcanary init`

Creates starter `promptcanary.yaml` in the current directory.

```bash
promptcanary init
```

## `promptcanary validate <file>`

Loads and validates config file.

```bash
promptcanary validate promptcanary.yaml
```

Exit codes:

- `0` valid config
- `1` invalid config

## `promptcanary run <file>`

Runs tests against configured providers and stores results in SQLite.

```bash
promptcanary run promptcanary.yaml
```

Flags:

- `--json`: output machine-readable JSON
- `--verbose`: print progress lines for each completed provider run

Examples:

```bash
promptcanary run promptcanary.yaml --verbose
promptcanary run promptcanary.yaml --json
promptcanary --dotenv ~/.config/promptcanary/.env run promptcanary.yaml
```

Exit codes:

- `0` all tests passed
- `1` one or more tests failed or execution error

## `promptcanary results [--last N]`

Shows recent stored runs from `promptcanary.db`.

```bash
promptcanary results
promptcanary results --last 25
```

Options:

- `--last <number>`: number of recent runs to display (default `10`)
