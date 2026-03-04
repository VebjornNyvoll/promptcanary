import { describe, it, expect } from 'vitest';
import {
  ProviderConfigSchema,
  SemanticSimilaritySchema,
  ExpectationSchema,
  TestCaseSchema,
  PromptCanaryConfigSchema,
  ResponseFormatSchema,
} from '../../src/schema/test-case.js';

describe('ProviderConfigSchema', () => {
  it('validates a minimal provider config', () => {
    const result = ProviderConfigSchema.parse({
      name: 'openai',
      model: 'gpt-4o',
      api_key_env: 'OPENAI_API_KEY',
    });
    expect(result.name).toBe('openai');
    expect(result.model).toBe('gpt-4o');
    expect(result.timeout_ms).toBe(30000); // default
  });

  it('validates a full provider config', () => {
    const result = ProviderConfigSchema.parse({
      name: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      api_key_env: 'ANTHROPIC_API_KEY',
      temperature: 0.5,
      max_tokens: 1000,
      timeout_ms: 60000,
    });
    expect(result.temperature).toBe(0.5);
    expect(result.max_tokens).toBe(1000);
    expect(result.timeout_ms).toBe(60000);
  });

  it('rejects empty name', () => {
    expect(() =>
      ProviderConfigSchema.parse({ name: '', model: 'gpt-4o', api_key_env: 'KEY' }),
    ).toThrow();
  });

  it('rejects invalid temperature', () => {
    expect(() =>
      ProviderConfigSchema.parse({
        name: 'openai',
        model: 'gpt-4o',
        api_key_env: 'KEY',
        temperature: 3.0,
      }),
    ).toThrow();
  });
});

describe('SemanticSimilaritySchema', () => {
  it('validates with default threshold', () => {
    const result = SemanticSimilaritySchema.parse({ baseline: 'Some baseline text' });
    expect(result.threshold).toBe(0.8);
  });

  it('validates with custom threshold', () => {
    const result = SemanticSimilaritySchema.parse({ baseline: 'text', threshold: 0.9 });
    expect(result.threshold).toBe(0.9);
  });

  it('rejects empty baseline', () => {
    expect(() => SemanticSimilaritySchema.parse({ baseline: '' })).toThrow();
  });

  it('rejects threshold out of range', () => {
    expect(() => SemanticSimilaritySchema.parse({ baseline: 'text', threshold: 1.5 })).toThrow();
  });
});

describe('ResponseFormatSchema', () => {
  it('accepts valid formats', () => {
    expect(ResponseFormatSchema.parse('bullet_points')).toBe('bullet_points');
    expect(ResponseFormatSchema.parse('json')).toBe('json');
    expect(ResponseFormatSchema.parse('numbered_list')).toBe('numbered_list');
    expect(ResponseFormatSchema.parse('plain_text')).toBe('plain_text');
    expect(ResponseFormatSchema.parse('markdown')).toBe('markdown');
  });

  it('rejects invalid formats', () => {
    expect(() => ResponseFormatSchema.parse('xml')).toThrow();
  });
});

describe('ExpectationSchema', () => {
  it('validates a minimal expectation', () => {
    const result = ExpectationSchema.parse({ max_length: 500 });
    expect(result.max_length).toBe(500);
  });

  it('validates a full expectation', () => {
    const result = ExpectationSchema.parse({
      format: 'bullet_points',
      max_length: 500,
      min_length: 10,
      must_contain: ['key', 'finding'],
      must_not_contain: ['error'],
      tone: 'professional',
      semantic_similarity: { baseline: 'expected response', threshold: 0.75 },
    });
    expect(result.format).toBe('bullet_points');
    expect(result.must_contain).toEqual(['key', 'finding']);
    expect(result.semantic_similarity?.threshold).toBe(0.75);
  });

  it('rejects min_length > max_length', () => {
    expect(() => ExpectationSchema.parse({ min_length: 100, max_length: 50 })).toThrow(
      'min_length must be less than or equal to max_length',
    );
  });

  it('allows empty expectation', () => {
    const result = ExpectationSchema.parse({});
    expect(result).toBeDefined();
  });
});

describe('TestCaseSchema', () => {
  it('validates a minimal test case', () => {
    const result = TestCaseSchema.parse({
      name: 'My test',
      prompt: 'Hello world',
      expect: { max_length: 100 },
    });
    expect(result.name).toBe('My test');
    expect(result.prompt).toBe('Hello world');
  });

  it('validates a test case with variables', () => {
    const result = TestCaseSchema.parse({
      name: 'Template test',
      prompt: 'Summarize: {{article}}',
      variables: { article: 'Some article text' },
      expect: {},
    });
    expect(result.variables?.article).toBe('Some article text');
  });

  it('validates a test case with provider override', () => {
    const result = TestCaseSchema.parse({
      name: 'OpenAI only',
      prompt: 'Test',
      providers: ['openai'],
      expect: {},
    });
    expect(result.providers).toEqual(['openai']);
  });

  it('rejects empty name', () => {
    expect(() => TestCaseSchema.parse({ name: '', prompt: 'x', expect: {} })).toThrow();
  });

  it('rejects empty prompt', () => {
    expect(() => TestCaseSchema.parse({ name: 'x', prompt: '', expect: {} })).toThrow();
  });
});

describe('PromptCanaryConfigSchema', () => {
  const minimalConfig = {
    version: '1' as const,
    config: {
      providers: [{ name: 'openai', model: 'gpt-4o', api_key_env: 'OPENAI_API_KEY' }],
    },
    tests: [{ name: 'Test 1', prompt: 'Hello', expect: {} }],
  };

  it('validates a minimal config', () => {
    const result = PromptCanaryConfigSchema.parse(minimalConfig);
    expect(result.version).toBe('1');
    expect(result.tests).toHaveLength(1);
    expect(result.config.providers).toHaveLength(1);
  });

  it('validates a full config', () => {
    const result = PromptCanaryConfigSchema.parse({
      ...minimalConfig,
      config: {
        ...minimalConfig.config,
        embedding_provider: {
          api_key_env: 'OPENAI_API_KEY',
          model: 'text-embedding-3-small',
        },
      },
    });
    expect(result.config.embedding_provider?.model).toBe('text-embedding-3-small');
  });

  it('rejects empty providers array', () => {
    expect(() =>
      PromptCanaryConfigSchema.parse({
        version: '1',
        config: { providers: [] },
        tests: [{ name: 'Test', prompt: 'x', expect: {} }],
      }),
    ).toThrow('At least one provider is required');
  });

  it('rejects empty tests array', () => {
    expect(() =>
      PromptCanaryConfigSchema.parse({
        version: '1',
        config: {
          providers: [{ name: 'openai', model: 'gpt-4o', api_key_env: 'KEY' }],
        },
        tests: [],
      }),
    ).toThrow('At least one test case is required');
  });

  it('rejects invalid version', () => {
    expect(() => PromptCanaryConfigSchema.parse({ ...minimalConfig, version: '2' })).toThrow();
  });
});
