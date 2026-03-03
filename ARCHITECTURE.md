# PromptCanary — Architecture Document

> Continuous monitoring for LLM prompt behavior. Like uptime monitoring, but for AI.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Language** | TypeScript 5.x (strict mode) | Type safety, excellent LLM SDK ecosystem, single language for CLI + Action |
| **Runtime** | Node.js 20 LTS | Stable, long-term support, native fetch, good cron libraries |
| **Package Manager** | pnpm | Fast, disk-efficient, strict dependency resolution |
| **Test Framework** | Vitest | Fast, native TypeScript, ESM-first, compatible with our stack |
| **Linting** | ESLint 9 (flat config) + Prettier | Industry standard, catches real bugs |
| **Build** | tsup | Zero-config TypeScript bundler, outputs ESM + CJS |
| **Schema Validation** | Zod | Runtime validation with TypeScript type inference |
| **YAML Parsing** | yaml (npm) | Full YAML 1.2 spec, good TypeScript types |
| **Embeddings** | OpenAI text-embedding-3-small | Best cost/quality ratio, 1536 dimensions |
| **LLM Providers** | OpenAI SDK, Anthropic SDK, custom HTTP | Start with big two, extensible provider interface |
| **Scheduler** | node-cron | Lightweight, well-tested cron expression support |
| **Storage** | SQLite (better-sqlite3) | Zero-config, single-file, perfect for local/self-hosted |
| **Alerting** | nodemailer, @slack/webhook, native fetch | Email, Slack, generic webhooks |
| **CLI** | commander | Lightweight, well-documented CLI framework |
| **CI/CD** | GitHub Actions (composite action) | Native GitHub integration, YAML-based |

---

## Project Structure

```
promptcanary/
├── src/
│   ├── cli/                    # CLI entry point and commands
│   │   ├── index.ts            # Main CLI entry
│   │   └── commands/           # CLI command handlers
│   │       ├── run.ts          # Run test suites
│   │       ├── validate.ts     # Validate test case files
│   │       └── init.ts         # Initialize config
│   ├── core/                   # Core business logic
│   │   ├── runner/             # Prompt execution engine
│   │   │   ├── index.ts        # Runner orchestrator
│   │   │   └── providers/      # LLM provider implementations
│   │   │       ├── base.ts     # Provider interface
│   │   │       ├── openai.ts   # OpenAI provider
│   │   │       └── anthropic.ts# Anthropic provider
│   │   ├── comparator/         # Semantic comparison engine
│   │   │   ├── index.ts        # Comparator orchestrator
│   │   │   ├── embedding.ts    # Embedding-based comparison
│   │   │   ├── structural.ts   # Format/structure checks
│   │   │   └── assertions.ts   # Rule-based assertions
│   │   ├── scheduler/          # Cron-based scheduling
│   │   │   └── index.ts        # Scheduler implementation
│   │   └── alerting/           # Alert dispatch
│   │       ├── index.ts        # Alert orchestrator
│   │       ├── slack.ts        # Slack webhook
│   │       ├── email.ts        # Email via SMTP
│   │       └── webhook.ts      # Generic webhook
│   ├── schema/                 # Test case schema & validation
│   │   ├── test-case.ts        # Zod schemas for test cases
│   │   └── config.ts           # Zod schemas for config
│   ├── storage/                # Persistence layer
│   │   ├── index.ts            # Storage interface
│   │   └── sqlite.ts           # SQLite implementation
│   └── types/                  # Shared TypeScript types
│       └── index.ts            # All shared types
├── action/                     # GitHub Action
│   ├── action.yml              # Action metadata
│   └── index.ts                # Action entry point
├── tests/                      # Test files (mirrors src/)
│   ├── core/
│   │   ├── runner/
│   │   ├── comparator/
│   │   └── scheduler/
│   └── schema/
├── examples/                   # Example test case files
│   └── basic.yaml              # Basic example test suite
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── tsup.config.ts
├── eslint.config.js
├── .prettierrc
├── .github/
│   └── workflows/
│       └── ci.yml              # CI pipeline
├── ARCHITECTURE.md
├── PRODUCT_SPEC.md
└── README.md
```

---

## Core Architecture

### 1. Test Case Definition (YAML/JSON)

Test cases are the core unit. Users define prompts and expectations in YAML:

```yaml
# promptcanary.yaml
version: "1"
config:
  providers:
    - name: openai
      model: gpt-4o
      api_key_env: OPENAI_API_KEY
    - name: anthropic
      model: claude-sonnet-4-20250514
      api_key_env: ANTHROPIC_API_KEY
  schedule: "0 */6 * * *"  # Every 6 hours
  alerts:
    - type: slack
      webhook_url_env: SLACK_WEBHOOK_URL
    - type: webhook
      url: "https://example.com/webhook"

tests:
  - name: "Article summarization"
    prompt: "Summarize this article in bullet points: {{article}}"
    variables:
      article: "NASA announced today that the James Webb Space Telescope..."
    providers: ["openai", "anthropic"]  # Optional: override global
    expect:
      format: "bullet_points"
      max_length: 500
      must_contain: ["James Webb", "telescope"]
      must_not_contain: ["error", "sorry"]
      tone: "professional"
      semantic_similarity:
        baseline: "The article discusses NASA's JWST findings..."
        threshold: 0.75

  - name: "Code generation quality"
    prompt: "Write a Python function to sort a list"
    expect:
      must_contain: ["def ", "return"]
      must_not_contain: ["TODO", "undefined"]
      max_length: 1000
```

**Schema validation via Zod** — validated at load time, clear error messages for malformed configs.

### 2. Prompt Runner (Provider-Agnostic)

```
┌─────────────────────────────────────────┐
│              Runner Orchestrator         │
│  - Loads test cases                     │
│  - Dispatches to providers in parallel  │
│  - Collects results                     │
│  - Passes to comparator                 │
└──────┬──────────────┬───────────────────┘
       │              │
  ┌────▼────┐   ┌────▼─────┐
  │ OpenAI  │   │Anthropic │   ... (extensible)
  │Provider │   │Provider  │
  └─────────┘   └──────────┘
```

**Provider interface:**
```typescript
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

- Providers are stateless and parallelized via `Promise.allSettled`
- Built-in retry with exponential backoff (3 attempts)
- Timeout per provider call (30s default)

### 3. Semantic Comparison Engine

Three-layer comparison:

```
┌─────────────────────────────────────┐
│         Comparison Pipeline         │
├─────────────────────────────────────┤
│ Layer 1: Structural Assertions      │
│  - max_length, must_contain,        │
│    must_not_contain, format checks  │
├─────────────────────────────────────┤
│ Layer 2: Semantic Similarity        │
│  - Embedding cosine similarity      │
│  - Compares against baseline or     │
│    previous successful run          │
├─────────────────────────────────────┤
│ Layer 3: Drift Detection            │
│  - Historical comparison            │
│  - Moving average similarity score  │
│  - Alerts when score crosses        │
│    threshold                        │
└─────────────────────────────────────┘
```

**Embedding approach:**
- Use OpenAI `text-embedding-3-small` (cheap, fast, good quality)
- Cosine similarity between response embedding and baseline embedding
- Threshold configurable per test (default: 0.80)
- Store embeddings in SQLite for historical comparison

**Cosine similarity formula:**
```
similarity(A, B) = (A · B) / (||A|| × ||B||)
```

### 4. Storage Layer

SQLite for all persistence:

```sql
-- Test run results
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  test_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  token_usage_prompt INTEGER,
  token_usage_completion INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Comparison results
CREATE TABLE comparisons (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES runs(id),
  assertion_type TEXT NOT NULL,  -- 'structural' | 'semantic' | 'drift'
  passed BOOLEAN NOT NULL,
  score REAL,                    -- similarity score (0-1)
  details TEXT,                  -- JSON details
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Embeddings cache
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL UNIQUE,
  embedding BLOB NOT NULL,       -- Float32Array serialized
  model TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Alert history
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES runs(id),
  channel TEXT NOT NULL,          -- 'slack' | 'email' | 'webhook'
  payload TEXT NOT NULL,          -- JSON
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN NOT NULL
);
```

### 5. Scheduler

- `node-cron` for cron expression scheduling
- Runs as long-lived process (`promptcanary monitor`)
- Each scheduled tick:
  1. Load test cases from YAML
  2. Execute all prompts via runner
  3. Compare results via comparator
  4. Store results in SQLite
  5. Dispatch alerts if thresholds breached

### 6. Alert System

```typescript
interface AlertChannel {
  type: 'slack' | 'email' | 'webhook';
  send(alert: AlertPayload): Promise<void>;
}

interface AlertPayload {
  test_name: string;
  provider: string;
  model: string;
  failure_type: 'assertion' | 'semantic_drift' | 'error';
  details: string;
  severity: 'warning' | 'critical';
  timestamp: Date;
  run_id: string;
}
```

Alert dispatch logic:
- **Warning**: Similarity score dropped below threshold but above critical
- **Critical**: Assertion failure or similarity below critical threshold
- **Dedup**: Don't re-alert for same test+provider within cooldown period (default: 1 hour)

### 7. GitHub Action

Composite action that:
1. Installs PromptCanary
2. Runs test suite from repo's `promptcanary.yaml`
3. Fails the workflow if any assertions fail
4. Posts summary as PR comment (optional)

```yaml
# Usage in user's workflow:
- uses: promptcanary/action@v1
  with:
    config: ./promptcanary.yaml
    fail-on-drift: true
    comment-on-pr: true
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### 8. CLI Interface

```bash
# Initialize config
promptcanary init

# Validate test case files
promptcanary validate ./promptcanary.yaml

# Run tests once
promptcanary run ./promptcanary.yaml

# Start continuous monitoring
promptcanary monitor ./promptcanary.yaml

# View results
promptcanary results --last 10
```

---

## Data Flow

```
User defines YAML          Scheduler triggers
      │                          │
      ▼                          ▼
  ┌──────────┐            ┌──────────┐
  │  Parser   │◄───────────│ Scheduler│
  │ (Zod)    │            │(node-cron)│
  └────┬─────┘            └──────────┘
       │
       ▼
  ┌──────────┐
  │  Runner   │──── Parallel provider calls
  │           │
  └────┬─────┘
       │ LLMResponse[]
       ▼
  ┌──────────┐
  │Comparator│──── Structural + Semantic + Drift
  │          │
  └────┬─────┘
       │ ComparisonResult[]
       ├────────────────┐
       ▼                ▼
  ┌──────────┐    ┌──────────┐
  │ Storage  │    │ Alerter  │──── Slack/Email/Webhook
  │ (SQLite) │    │          │
  └──────────┘    └──────────┘
```

---

## Key Design Decisions

1. **YAML over JSON for test cases** — More readable for humans, supports comments, industry standard for config
2. **Zod over JSON Schema** — Runtime validation with TypeScript inference, better DX, composable
3. **SQLite over Postgres** — Zero-config, single-file, perfect for self-hosted/local. Can upgrade later.
4. **Embedding-based comparison** — More robust than string matching for detecting semantic drift
5. **Provider-agnostic interface** — Easy to add new LLM providers without changing core logic
6. **Composite GitHub Action** — Runs in user's workflow, no separate infrastructure needed
7. **node-cron over external scheduler** — Self-contained, no external dependencies for scheduling
8. **pnpm over npm/yarn** — Strict, fast, disk-efficient

---

## MVP Scope (Milestones 1-6)

The MVP includes:
- ✅ YAML test case definition with schema validation
- ✅ OpenAI + Anthropic providers
- ✅ Structural assertions (contains, length, format)
- ✅ Semantic similarity via embeddings
- ✅ SQLite storage for results + historical comparison
- ✅ Cron-based scheduler
- ✅ Slack + webhook alerting
- ✅ CLI (init, validate, run, monitor)
- ✅ GitHub Action for CI/CD
- ❌ Dashboard UI (Milestone 7, post-MVP)
- ❌ Model changelog aggregator (future)
- ❌ Prompt sensitivity scoring (future)
