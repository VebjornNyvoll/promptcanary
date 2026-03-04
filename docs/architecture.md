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
│   │   └── comparator/
│   │       ├── index.ts
│   │       ├── embedding.ts
│   │       └── assertions.ts
│   ├── schema/
│   │   ├── test-case.ts
│   │   └── loader.ts
│   ├── storage/
│   │   └── index.ts
│   ├── testing/
│   │   ├── testPrompt.ts
│   │   ├── semanticSimilarity.ts
│   │   └── assertions.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── tests/
├── examples/
└── docs/
```

## Core architecture

### Testing API

The primary interface for most users:

- **`testPrompt()`** — Send a prompt to any provider and get a typed result with content, latency, and token usage.
- **`semanticSimilarity()`** — Compare response meaning using embeddings.
- **`assertions`** — Validate content, length, format, regex, JSON schema with structured pass/fail results.

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

- Persists runs, comparisons, and embeddings cache in SQLite.
- Uses schema migrations and transactions for consistency.
- Supports result querying for historical comparison.

## Data flow

```text
User defines tests (code or YAML)
      |
      v
  +----------+
  | Parser   |
  | (Zod)    |
  +----+-----+
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
       v
  +----------+
  | Storage  |
  | SQLite   |
  +----------+
```

## Key design decisions

1. YAML over JSON for readability and operator-friendly editing.
2. Zod for runtime validation plus TypeScript type inference.
3. SQLite for self-contained, zero-infrastructure operation.
4. Embedding-based checks for robust semantic drift detection.
5. Provider-agnostic runner interface for extensibility.
6. Library-first design — works as functions in any test runner, with an optional CLI for config-driven usage.
