# Programmatic API

PromptCanary can be used as a library in Node.js/TypeScript.

## Installation

```bash
npm install promptcanary
```

## Main exports

From `src/index.ts`, PromptCanary exports:

- `runTests(options)`: run configured test suite
- `compareResponse(options)`: compare a response against expectations
- `startScheduler(options)`: start continuous monitoring scheduler
- `dispatchAlerts(options)`: dispatch alerts for failed results
- `Storage`: SQLite-backed persistence class
- `loadConfig(path)`: load and validate config file from disk
- `validateConfig(data)`: validate config object

Also exported:

- `executeRun` (single scheduler run helper)
- `createAlertChannels`
- Schema exports (`ProviderConfigSchema`, `ExpectationSchema`, and others)

## Type exports

Available types include:

- `PromptCanaryConfig`
- `ProviderConfig`
- `Expectation`
- `TestCase`
- `RunResult`
- `LLMResponse`
- `AssertionResult`
- `ComparisonResult`
- `AlertPayload`
- `AlertChannel`

## Error classes

- `ProviderError`
- `TimeoutError`
- `RateLimitError`
- `ConfigError`

## Usage example

```typescript
import { loadConfig, runTests, compareResponse, Storage } from 'promptcanary';

const config = loadConfig('promptcanary.yaml');
const results = await runTests({ config });

const storage = new Storage();
for (const result of results) {
  storage.saveRun(result.test_name, 'prompt text', result);
}
storage.close();
```

## Function signatures (high level)

```ts
runTests(options: { config: PromptCanaryConfig; onProgress?: (result: RunResult) => void }): Promise<RunResult[]>

compareResponse(options: {
  response: string
  expectations: Expectation
  embeddingFetcher?: EmbeddingFetcher
  embeddingCache?: EmbeddingCache
  historicalScores?: number[]
}): Promise<ComparisonResult>

startScheduler(options: {
  config: PromptCanaryConfig
  dbPath?: string
  onRunStart?: () => void
  onRunComplete?: (passed: number, failed: number) => void
  onError?: (error: Error) => void
  onWarning?: (message: string) => void
}): { stop: () => void }

dispatchAlerts(options: {
  results: RunResult[]
  channels: AlertChannel[]
  storage?: Storage
  cooldownMinutes?: number
}): Promise<void>
```
