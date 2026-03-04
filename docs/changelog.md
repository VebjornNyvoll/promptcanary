# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-04

### Removed

- **`monitor` command** — use CI/CD scheduled workflows (cron) with `promptcanary run` instead
- **`cleanup` command** — no longer needed without continuous monitoring
- **Scheduler** (`startScheduler`, `executeRun`) — removed from public API
- **Alerting system** — Slack, webhook, `dispatchAlerts`, `createAlertChannels` all removed. Use your existing alerting infrastructure (PagerDuty, Datadog, CI notifications, etc.)
- **Alert types** — `AlertConfig`, `AlertPayload`, `AlertChannel`, `AlertConfigSchema` removed
- **`schedule` config field** — no longer part of the configuration schema
- **`node-cron` dependency** — no longer needed

### Migration from 0.2.0

If you were using `promptcanary monitor`:

- Replace with a CI/CD scheduled workflow (e.g., GitHub Actions `schedule`, GitLab CI schedule, or a system cron job) that runs `promptcanary run your-config.yaml`

If you were using alerting (Slack/webhook):

- Use your CI/CD pipeline's built-in notification system. PromptCanary exits with code `1` on failures, which triggers standard CI alerts automatically.

If you were using the `cleanup` command:

- No replacement needed. Without continuous monitoring, database growth is minimal.

If you imported `startScheduler`, `executeRun`, or alert types:

- Remove these imports. Use `testPrompt()`, `assertions`, and `semanticSimilarity()` for programmatic testing instead.

## [0.2.0] - 2026-03-04

### Added

- `testPrompt()` — standalone function to send prompts to any provider and get typed results
- `semanticSimilarity()` — compute cosine similarity between two strings using OpenAI embeddings
- `assertions` namespace — 7 synchronous assertion helpers (`contains`, `notContains`, `maxLength`, `minLength`, `matchesRegex`, `isJson`, `matchesJsonSchema`) plus `runAll()` for batch execution
- New types: `TestPromptOptions`, `TestPromptResult`, `ChatMessage`, `SemanticSimilarityOptions`, `AssertionDescriptor`, `RunAllResult`
- 45 new unit tests for the testing API

### Changed

- README repositioned from monitoring tool to testing library
- Getting started guide leads with programmatic API (Vitest/Jest) instead of CLI
- API reference rewritten to lead with `testPrompt()`, `semanticSimilarity()`, and `assertions`
- "What is PromptCanary?" intro page updated for testing library identity
- Docs sidebar reorganized: monitoring and alerting moved to Advanced section
- Configuration renamed to "Configuration (YAML)" in sidebar
- package.json description and keywords updated for npm discoverability

### Fixed

- CI workflow now runs Build before Test so CLI integration tests find `dist/` output

## [0.1.0] - 2026-03-03

### Added

- CLI commands: `init`, `validate`, `run`, `monitor`, `results`
- OpenAI and Anthropic provider support
- Structural assertions: `must_contain`, `must_not_contain`, `min_length`, `max_length`, `format`, `tone`
- Semantic similarity comparison using OpenAI embeddings with configurable thresholds
- Drift detection against historical semantic scores (2-sigma + 10% drop)
- SQLite storage for results, comparisons, and embedding cache
- Database schema versioning and migration system
- Embedding cache persistence across scheduler runs via SQLite backing
- Cron-based continuous monitoring with `config.schedule`
- Slack and webhook alert channels with retry and exponential backoff
- Alert deduplication with configurable cooldown
- `.env` file auto-loading with `--dotenv <path>` override
- YAML config validation with Zod schemas
- GitHub Action composite for CI integration
- CLI integration tests for all commands and flags
- Multi-environment CI matrix (Node 20+22, ubuntu/windows/macos)
- MIT license

### Fixed

- Embedding fetcher now has a configurable timeout (default 30s) via `AbortSignal.timeout()`
- Embedding API failures produce warnings instead of marking tests as failed
- Scheduler preserves `error_type` and `retry_after_ms` in runner error responses
- Email alert type removed from schema until implemented (was crashing at runtime)
- Scheduler warns when embedding provider fails to initialize
- Database writes use transactions for atomicity
- Dependency versions pinned to semver ranges

### Documentation

- README: full configuration reference, provider setup, alerting, GitHub Action, API keys
- README: troubleshooting section for better-sqlite3 native module
- `.env.example` template
