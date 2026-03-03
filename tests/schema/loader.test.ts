import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadConfig, interpolateVariables, validateConfig } from '../../src/schema/loader.js';
import { ConfigError } from '../../src/types/index.js';

const EXAMPLES_DIR = resolve(import.meta.dirname, '../../examples');

describe('loadConfig', () => {
  it('loads and validates basic.yaml', () => {
    const config = loadConfig(resolve(EXAMPLES_DIR, 'basic.yaml'));
    expect(config.version).toBe('1');
    expect(config.tests).toHaveLength(1);
    expect(config.tests[0].name).toBe('Greeting response');
    expect(config.config.providers).toHaveLength(1);
    expect(config.config.providers[0].name).toBe('openai');
  });

  it('loads and validates multi-provider.yaml', () => {
    const config = loadConfig(resolve(EXAMPLES_DIR, 'multi-provider.yaml'));
    expect(config.config.providers).toHaveLength(2);
    expect(config.tests).toHaveLength(2);
  });

  it('loads and validates full.yaml', () => {
    const config = loadConfig(resolve(EXAMPLES_DIR, 'full.yaml'));
    expect(config.config.providers).toHaveLength(2);
    expect(config.config.schedule).toBe('0 */6 * * *');
    expect(config.config.alerts).toHaveLength(2);
    expect(config.tests).toHaveLength(3);
  });

  it('interpolates template variables in prompts', () => {
    const config = loadConfig(resolve(EXAMPLES_DIR, 'multi-provider.yaml'));
    // The prompt should have {{article}} replaced with the variable value
    const summaryTest = config.tests[0];
    expect(summaryTest.prompt).not.toContain('{{article}}');
    expect(summaryTest.prompt).toContain("NASA's James Webb");
  });

  it('throws ConfigError for nonexistent file', () => {
    expect(() => loadConfig('/nonexistent/file.yaml')).toThrow(ConfigError);
  });

  it('throws ConfigError for invalid YAML content', () => {
    // Will fail because it has no valid structure
    expect(() => loadConfig(resolve(import.meta.dirname, '../../package.json'))).toThrow();
  });
});

describe('interpolateVariables', () => {
  it('replaces {{variable}} placeholders', () => {
    const test = {
      name: 'test',
      prompt: 'Hello {{name}}, welcome to {{place}}!',
      variables: { name: 'Alice', place: 'Wonderland' },
      expect: {},
    };
    const result = interpolateVariables(test);
    expect(result.prompt).toBe('Hello Alice, welcome to Wonderland!');
  });

  it('handles whitespace in template tags', () => {
    const test = {
      name: 'test',
      prompt: 'Hello {{ name }}!',
      variables: { name: 'Bob' },
      expect: {},
    };
    const result = interpolateVariables(test);
    expect(result.prompt).toBe('Hello Bob!');
  });

  it('returns unchanged test when no variables defined', () => {
    const test = {
      name: 'test',
      prompt: 'Hello {{name}}!',
      expect: {},
    };
    const result = interpolateVariables(test);
    expect(result.prompt).toBe('Hello {{name}}!');
  });

  it('returns unchanged test when variables is empty', () => {
    const test = {
      name: 'test',
      prompt: 'Hello {{name}}!',
      variables: {},
      expect: {},
    };
    const result = interpolateVariables(test);
    expect(result.prompt).toBe('Hello {{name}}!');
  });

  it('replaces multiple occurrences of same variable', () => {
    const test = {
      name: 'test',
      prompt: '{{x}} and {{x}}',
      variables: { x: 'hello' },
      expect: {},
    };
    const result = interpolateVariables(test);
    expect(result.prompt).toBe('hello and hello');
  });
});

describe('validateConfig', () => {
  it('validates a valid config object', () => {
    const config = validateConfig({
      version: '1',
      config: {
        providers: [{ name: 'openai', model: 'gpt-4o', api_key_env: 'KEY' }],
      },
      tests: [{ name: 'Test', prompt: 'Hello', expect: {} }],
    });
    expect(config.version).toBe('1');
  });

  it('throws ConfigError for invalid config', () => {
    expect(() => validateConfig({ version: '99' })).toThrow(ConfigError);
  });
});
