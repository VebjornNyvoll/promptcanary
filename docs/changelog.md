# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
