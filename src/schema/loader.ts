import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { ZodError } from 'zod';
import { PromptCanaryConfigSchema } from './test-case.js';
import type { PromptCanaryConfig, TestCase } from '../types/index.js';
import { ConfigError } from '../types/index.js';

/**
 * Load and validate a PromptCanary config file from disk.
 *
 * @param filePath - Path to the YAML or JSON config file
 * @returns Validated PromptCanaryConfig
 * @throws ConfigError on read or validation failure
 */
export function loadConfig(filePath: string): PromptCanaryConfig {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`Failed to read config file: ${message}`, filePath);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`Failed to parse YAML: ${message}`, filePath);
  }

  try {
    const config = PromptCanaryConfigSchema.parse(parsed);
    // Interpolate template variables in all test prompts
    const tests = config.tests.map((test) => interpolateVariables(test));
    return { ...config, tests };
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues
        .map((issue) => {
          const path = issue.path.join('.');
          return `  - ${path ? `${path}: ` : ''}${issue.message}`;
        })
        .join('\n');
      throw new ConfigError(
        `Config validation failed in ${filePath}:\n${issues}`,
        filePath,
      );
    }
    throw err;
  }
}

/**
 * Interpolate {{variable}} placeholders in a test case's prompt.
 *
 * @param test - Test case with potential template variables
 * @returns Test case with interpolated prompt
 */
export function interpolateVariables(test: TestCase): TestCase {
  if (!test.variables || Object.keys(test.variables).length === 0) {
    return test;
  }

  let prompt = test.prompt;
  for (const [key, value] of Object.entries(test.variables)) {
    // Replace all occurrences of {{key}} with value
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'g');
    prompt = prompt.replace(pattern, value);
  }

  return { ...test, prompt };
}

/**
 * Validate a config object without loading from file.
 * Useful for programmatic usage.
 */
export function validateConfig(data: unknown): PromptCanaryConfig {
  try {
    return PromptCanaryConfigSchema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues
        .map((issue) => {
          const path = issue.path.join('.');
          return `  - ${path ? `${path}: ` : ''}${issue.message}`;
        })
        .join('\n');
      throw new ConfigError(`Config validation failed:\n${issues}`);
    }
    throw err;
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
