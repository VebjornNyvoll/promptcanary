#!/usr/bin/env node
import { copyFile, constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, InvalidArgumentError } from 'commander';
import type { PromptCanaryConfig, RunResult } from '../types/index.js';
import { VERSION } from '../index.js';
import { loadConfig } from '../schema/loader.js';
import { runTests } from '../core/runner/index.js';
import {
  compareResponse,
  EmbeddingCache,
  OpenAIEmbeddingFetcher,
  type EmbeddingFetcher,
} from '../core/comparator/index.js';
import { startScheduler } from '../core/scheduler/index.js';
import { Storage } from '../storage/index.js';

const ansi = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const here = fileURLToPath(new URL('.', import.meta.url));
const templatePath = resolve(here, '../../examples/basic.yaml');

const program = new Command();

program
  .name('promptcanary')
  .description('Uptime monitoring for AI behavior')
  .version(VERSION);

program
  .command('init')
  .description('Create a starter promptcanary.yaml in the current directory')
  .action(async () => {
    const targetPath = resolve(process.cwd(), 'promptcanary.yaml');

    try {
      await access(targetPath, constants.F_OK);
      printWarning(`promptcanary.yaml already exists at ${targetPath}`);
      process.exitCode = 1;
      return;
    } catch {
      // File does not exist; continue.
    }

    await new Promise<void>((resolvePromise, rejectPromise) => {
      copyFile(templatePath, targetPath, (error) => {
        if (error) {
          rejectPromise(error);
          return;
        }
        resolvePromise();
      });
    });

    printSuccess(`Created promptcanary.yaml at ${targetPath}`);
    printInfo('Next steps:');
    printInfo('1. Set OPENAI_API_KEY (and other provider keys) in your environment');
    printInfo('2. Edit promptcanary.yaml with your prompts and expectations');
    printInfo('3. Run: promptcanary validate promptcanary.yaml');
    printInfo('4. Run: promptcanary run promptcanary.yaml');
  });

program
  .command('validate <file>')
  .description('Load and validate a PromptCanary config file')
  .action((file: string) => {
    try {
      const config = loadConfig(file);
      printSuccess(
        `Config is valid (${String(config.tests.length)} tests, ${String(config.config.providers.length)} providers).`,
      );
      process.exitCode = 0;
    } catch (error) {
      printFailure(formatError(error));
      process.exitCode = 1;
    }
  });

program
  .command('run <file>')
  .description('Run all configured tests against all providers')
  .option('--json', 'Output machine-readable JSON results', false)
  .option('--verbose', 'Show verbose output', false)
  .action(async (file: string, options: { json: boolean; verbose: boolean }) => {
    let storage: Storage | undefined;
    try {
      const config = loadConfig(file);
      storage = new Storage();
      const embeddingCache = new EmbeddingCache();
      const embeddingFetcher = createEmbeddingFetcher(config);

      const runResults = await runTests({
        config,
        onProgress: options.verbose
          ? (result) => {
              printInfo(`Completed ${result.test_name} on ${result.provider}`);
            }
          : undefined,
      });

      await applyComparisons(runResults, config, embeddingFetcher, embeddingCache, storage);

      if (options.json) {
        process.stdout.write(`${JSON.stringify(runResults, null, 2)}\n`);
      } else {
        printRunTable(runResults);
      }

      const failed = runResults.filter((result) => !result.comparison.passed).length;
      const passed = runResults.length - failed;
      printInfo(`Passed: ${String(passed)}  Failed: ${String(failed)}`);
      process.exitCode = failed === 0 ? 0 : 1;
    } catch (error) {
      printFailure(formatError(error));
      process.exitCode = 1;
    } finally {
      storage?.close();
    }
  });

program
  .command('monitor <file>')
  .description('Start continuous monitoring from a config schedule')
  .action((file: string) => {
    let stop: (() => void) | undefined;
    try {
      const config = loadConfig(file);
      const schedule = config.config.schedule;
      if (!schedule) {
        throw new Error('Missing schedule in config.config.schedule');
      }

      const scheduler = startScheduler({
        config,
        onRunStart: () => {
          printInfo('Monitoring run started');
        },
        onRunComplete: (passed, failed) => {
          printInfo(`Monitoring run complete. Passed: ${String(passed)}, Failed: ${String(failed)}`);
        },
        onError: (error) => {
          printFailure(`Monitoring run error: ${error.message}`);
        },
      });
      stop = scheduler.stop;

      printSuccess(`Monitoring started with schedule: ${schedule}`);

      let stopping = false;
      const handleShutdown = (signal: NodeJS.Signals): void => {
        if (stopping) {
          return;
        }
        stopping = true;
        printWarning(`Received ${signal}. Shutting down monitor...`);
        stop?.();
      };

      process.on('SIGINT', () => {
        handleShutdown('SIGINT');
      });
      process.on('SIGTERM', () => {
        handleShutdown('SIGTERM');
      });
    } catch (error) {
      stop?.();
      printFailure(formatError(error));
      process.exitCode = 1;
    }
  });

program
  .command('results')
  .description('Show recent test results from SQLite storage')
  .option('--last <number>', 'Show the last N runs (default: 10)', parsePositiveInt, 10)
  .action((options: { last: number }) => {
    const storage = new Storage();
    try {
      const runs = storage.getRuns({ limit: options.last });
      if (runs.length === 0) {
        printWarning('No test results found. Run `promptcanary run <file>` first.');
        return;
      }

      const rows = runs.map((run) => {
        const comparison = storage.getComparison(run.id);
        const passed = comparison?.passed ?? false;
        return {
          test_name: run.test_name,
          provider: run.provider,
          status: passed,
          details: comparison?.details ?? 'No comparison details',
        };
      });

      printStoredRunTable(rows);
    } finally {
      storage.close();
    }
  });

void program.parseAsync(process.argv);

function printInfo(message: string): void {
  process.stdout.write(`${message}\n`);
}

function printSuccess(message: string): void {
  process.stdout.write(`${ansi.green}${message}${ansi.reset}\n`);
}

function printWarning(message: string): void {
  process.stdout.write(`${ansi.yellow}${message}${ansi.reset}\n`);
}

function printFailure(message: string): void {
  process.stderr.write(`${ansi.red}${message}${ansi.reset}\n`);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new InvalidArgumentError('Expected a positive integer.');
  }
  return parsed;
}

async function applyComparisons(
  results: RunResult[],
  config: PromptCanaryConfig,
  embeddingFetcher: EmbeddingFetcher | undefined,
  embeddingCache: EmbeddingCache,
  storage: Storage,
): Promise<void> {
  for (const result of results) {
    const testCase = config.tests.find((test) => test.name === result.test_name);
    if (!testCase) {
      continue;
    }

    const historicalScores = storage.getHistoricalScores(result.test_name, result.provider);
    result.comparison = await compareResponse({
      response: result.response.content,
      expectations: testCase.expect,
      embeddingFetcher,
      embeddingCache,
      historicalScores,
    });

    storage.saveRun(result.test_name, testCase.prompt, result);
  }
}

function createEmbeddingFetcher(config: PromptCanaryConfig): EmbeddingFetcher | undefined {
  const embeddingConfig = config.config.embedding_provider;
  if (!embeddingConfig) {
    return undefined;
  }

  try {
    return new OpenAIEmbeddingFetcher(embeddingConfig.api_key_env, embeddingConfig.model);
  } catch {
    return undefined;
  }
}

function printRunTable(results: RunResult[]): void {
  const headers = ['Test Name', 'Provider', 'Status', 'Details'];
  const dataRows = results.map((result) => {
    const statusText = result.comparison.passed
      ? `${ansi.green}PASS${ansi.reset}`
      : `${ansi.red}FAIL${ansi.reset}`;
    return [
      result.test_name,
      result.provider,
      statusText,
      truncate(result.comparison.details, 80),
    ];
  });

  printTable(headers, dataRows);
}

function printStoredRunTable(
  rows: Array<{ test_name: string; provider: string; status: boolean; details: string }>,
): void {
  const headers = ['Test Name', 'Provider', 'Status', 'Details'];
  const dataRows = rows.map((row) => {
    const statusText = row.status
      ? `${ansi.green}PASS${ansi.reset}`
      : `${ansi.red}FAIL${ansi.reset}`;
    return [row.test_name, row.provider, statusText, truncate(row.details, 80)];
  });

  printTable(headers, dataRows);
}

function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((header, columnIndex) => {
    const maxCellLength = rows.reduce((max, row) => {
      const cell = row[columnIndex] ?? '';
      return Math.max(max, stripAnsi(cell).length);
    }, 0);
    return Math.max(header.length, maxCellLength);
  });

  const headerLine = headers
    .map((header, idx) => `${ansi.bold}${pad(header, widths[idx])}${ansi.reset}`)
    .join('  ');
  const dividerLine = widths.map((width) => '-'.repeat(width)).join('  ');
  printInfo(headerLine);
  printInfo(dividerLine);

  for (const row of rows) {
    const line = row
      .map((cell, idx) => pad(cell, widths[idx]))
      .join('  ');
    printInfo(line);
  }
}

function pad(value: string, width: number): string {
  const visibleLength = stripAnsi(value).length;
  const needed = Math.max(0, width - visibleLength);
  return `${value}${' '.repeat(needed)}`;
}

function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, '');
}

function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.slice(0, maxLength - 3)}...`;
}
