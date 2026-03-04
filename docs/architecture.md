# Architecture

This page summarizes PromptCanary system architecture and major design choices.

## Tech stack

| Layer           | Technology                | Rationale                              |
| --------------- | ------------------------- | -------------------------------------- |
| Language        | TypeScript 5.x (strict)   | Type safety and strong SDK ecosystem   |
| Runtime         | Node.js 20 LTS            | Stable runtime, long-term support      |
| Package manager | pnpm                      | Fast and strict dependency resolution  |
| Test framework  | Vitest                    | Fast and ESM-friendly                  |
| Build           | tsup                      | Simple TypeScript bundling             |
| Validation      | Zod                       | Runtime validation plus inferred types |
| YAML parser     | yaml                      | YAML 1.2 support                       |
| Scheduler       | node-cron                 | Lightweight cron scheduling            |
| Storage         | SQLite via better-sqlite3 | Zero-config local persistence          |
| CLI             | commander                 | Mature CLI framework                   |

## Project structure

```text
promptcanary/
├── src/
│   ├── cli/
│   │   └── index.ts
│   ├── core/
│   │   ├── runner/
│   │   │   ├── index.ts
│   │   │   └── providers/
│   │   │       ├── base.ts
│   │   │       ├── openai.ts
│   │   │       ├── anthropic.ts
│   │   │       └── google.ts
│   │   ├── comparator/
│   │   │   ├── index.ts
│   │   │   ├── embedding.ts
│   │   │   └── assertions.ts
│   │   ├── scheduler/
│   │   │   └── index.ts
│   │   └── alerting/
│   │       ├── index.ts
│   │       ├── slack.ts
│   │       └── webhook.ts
│   ├── schema/
│   │   ├── test-case.ts
│   │   └── loader.ts
│   ├── storage/
│   │   └── index.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── tests/
├── examples/
└── docs/
```

## Core architecture

### Runner

- Loads providers from config.
- Executes tests across provider targets.
- Runs provider calls concurrently for each test.
- Returns normalized `RunResult[]`.

### Comparator

- Applies structural assertions (`format`, length, contain/not-contain, tone).
- Optionally computes semantic similarity using embeddings.
- Optionally evaluates drift against historical semantic scores.
- Produces pass/fail, severity, and detailed assertion output.

### Storage

- Persists runs, comparisons, embeddings cache, and alerts in SQLite.
- Uses schema migrations and transactions for consistency.
- Supports result querying, dedup checks, and cleanup operations.

### Scheduler

- Validates cron schedule and starts long-running task.
- Prevents overlapping runs.
- Executes runner, comparator, storage write, and alert dispatch.
- Exposes `stop()` for graceful shutdown.

### Alert system

- Creates configured channels (Slack and webhook).
- Builds alert payload from failed results.
- Applies cooldown-based deduplication.
- Retries channel sends with backoff at channel level.

## Data flow

```text
User defines YAML          Scheduler triggers
      |                          |
      v                          v
  +----------+             +-----------+
  | Parser   |<------------| Scheduler |
  | (Zod)    |             | (cron)    |
  +----+-----+             +-----------+
       |
       v
  +----------+
  | Runner   |---- parallel provider calls
  +----+-----+
       | LLMResponse[]
       v
  +----------+
  |Comparator|---- structural + semantic + drift
  +----+-----+
       | ComparisonResult[]
       +--------------+
       v              v
  +----------+   +----------+
  | Storage  |   | Alerter  |---- Slack/Webhook
  | SQLite   |   |          |
  +----------+   +----------+
```

## Key design decisions

1. YAML over JSON for readability and operator-friendly editing.
2. Zod for runtime validation plus TypeScript type inference.
3. SQLite for self-contained, zero-infrastructure operation.
4. Embedding-based checks for robust semantic drift detection.
5. Provider-agnostic runner interface for extensibility.
6. CLI-first architecture for local runs, CI, and daemon-like monitoring.
