import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const CLI_PATH = resolve('dist/cli/index.js');

function run(
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolvePromise) => {
    const child = execFile(
      'node',
      [CLI_PATH, ...args],
      {
        cwd: options.cwd ?? process.cwd(),
        env: { ...process.env, ...options.env },
        timeout: 10_000,
      },
      (error, stdout, stderr) => {
        const code =
          error && 'code' in error && typeof error.code === 'number'
            ? error.code
            : (child.exitCode ?? 0);
        resolvePromise({
          stdout,
          stderr,
          exitCode: code,
        });
      },
    );
  });
}

describe('CLI integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'promptcanary-cli-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('--version', () => {
    it('prints the version', async () => {
      const { stdout, exitCode } = await run(['--version']);
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('--help', () => {
    it('prints help text', async () => {
      const { stdout, exitCode } = await run(['--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('promptcanary');
      expect(stdout).toContain('init');
      expect(stdout).toContain('validate');
      expect(stdout).toContain('run');
      expect(stdout).toContain('results');
    });
  });

  describe('init', () => {
    it('creates promptcanary.yaml in target directory', async () => {
      const { stdout, exitCode } = await run(['init'], { cwd: tempDir });
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Created promptcanary.yaml');
      expect(existsSync(join(tempDir, 'promptcanary.yaml'))).toBe(true);
    });

    it('refuses to overwrite existing file', async () => {
      writeFileSync(join(tempDir, 'promptcanary.yaml'), 'existing');
      const { stdout, exitCode } = await run(['init'], { cwd: tempDir });
      expect(exitCode).toBe(1);
      expect(stdout).toContain('already exists');
    });
  });

  describe('validate', () => {
    it('validates a valid config file', async () => {
      const configPath = join(tempDir, 'valid.yaml');
      writeFileSync(
        configPath,
        `version: "1"\nconfig:\n  providers:\n    - name: openai\n      model: gpt-4o-mini\n      api_key_env: OPENAI_API_KEY\ntests:\n  - name: test\n    prompt: hello\n    expect:\n      max_length: 100\n`,
      );
      const { stdout, exitCode } = await run(['validate', configPath]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('valid');
    });

    it('rejects an invalid config file', async () => {
      const configPath = join(tempDir, 'invalid.yaml');
      writeFileSync(configPath, 'version: "99"\ngarbage: true\n');
      const { stderr, exitCode } = await run(['validate', configPath]);
      expect(exitCode).toBe(1);
      expect(stderr.length).toBeGreaterThan(0);
    });

    it('errors on missing file', async () => {
      const { stderr, exitCode } = await run(['validate', join(tempDir, 'nonexistent.yaml')]);
      expect(exitCode).toBe(1);
      expect(stderr.length).toBeGreaterThan(0);
    });
  });

  describe('run', () => {
    it('errors on missing config file', async () => {
      const { stderr, exitCode } = await run(['run', 'nope.yaml'], { cwd: tempDir });
      expect(exitCode).toBe(1);
      expect(stderr.length).toBeGreaterThan(0);
    });

    it('errors on invalid config', async () => {
      const configPath = join(tempDir, 'bad.yaml');
      writeFileSync(configPath, 'not: valid\n');
      const { stderr, exitCode } = await run(['run', configPath]);
      expect(exitCode).toBe(1);
      expect(stderr.length).toBeGreaterThan(0);
    });
  });

  describe('results', () => {
    it('shows warning when no results exist', async () => {
      const { stdout, exitCode } = await run(['results'], { cwd: tempDir });
      expect(exitCode).toBe(0);
      expect(stdout).toContain('No test results found');
    });
  });

  describe('--dotenv', () => {
    it('errors when dotenv file does not exist', async () => {
      const configPath = join(tempDir, 'config.yaml');
      writeFileSync(
        configPath,
        `version: "1"\nconfig:\n  providers:\n    - name: openai\n      model: gpt-4o-mini\n      api_key_env: OPENAI_API_KEY\ntests:\n  - name: test\n    prompt: hello\n    expect:\n      max_length: 100\n`,
      );
      const result = await run(['--dotenv', join(tempDir, 'missing.env'), 'run', configPath]);
      expect(result.exitCode).toBe(1);
      const output = result.stdout + result.stderr;
      expect(output).toContain('Env file not found');
    });
  });
});
