import { z } from 'zod';

/**
 * Schema for LLM provider configuration.
 */
export const ProviderConfigSchema = z.object({
  name: z
    .string()
    .min(1, 'Provider name is required')
    .describe('Unique identifier for this provider (e.g., "openai", "anthropic")'),
  model: z.string().min(1, 'Model name is required').describe('Model identifier (e.g., "gpt-4o")'),
  api_key_env: z
    .string()
    .min(1, 'API key environment variable name is required')
    .describe('Environment variable name containing the API key'),
  temperature: z.number().min(0).max(2).optional().describe('Sampling temperature (0-2)'),
  max_tokens: z.number().int().positive().optional().describe('Maximum tokens in response'),
  timeout_ms: z
    .number()
    .int()
    .positive()
    .default(30000)
    .describe('Request timeout in milliseconds'),
});

/**
 * Schema for semantic similarity configuration.
 */
export const SemanticSimilaritySchema = z.object({
  baseline: z
    .string()
    .min(1, 'Baseline text is required for semantic similarity')
    .describe('Expected baseline response for comparison'),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.8)
    .describe('Minimum cosine similarity score (0-1)'),
});

/**
 * Schema for response format types.
 */
export const ResponseFormatSchema = z.enum([
  'bullet_points',
  'numbered_list',
  'json',
  'plain_text',
  'markdown',
]);

/**
 * Schema for test case expectations — what the response should look like.
 */
export const ExpectationSchema = z
  .object({
    format: ResponseFormatSchema.optional().describe('Expected response format'),
    max_length: z.number().int().positive().optional().describe('Maximum character length'),
    min_length: z.number().int().nonnegative().optional().describe('Minimum character length'),
    must_contain: z
      .array(z.string().min(1))
      .optional()
      .describe('Strings that must appear in the response'),
    must_not_contain: z
      .array(z.string().min(1))
      .optional()
      .describe('Strings that must not appear in the response'),
    tone: z
      .enum(['professional', 'casual', 'technical', 'friendly', 'formal'])
      .optional()
      .describe('Expected tone (checked via semantic similarity)'),
    semantic_similarity: SemanticSimilaritySchema.optional().describe(
      'Embedding-based semantic similarity check',
    ),
  })
  .refine(
    (data) => {
      if (data.min_length !== undefined && data.max_length !== undefined) {
        return data.min_length <= data.max_length;
      }
      return true;
    },
    { message: 'min_length must be less than or equal to max_length' },
  );

/**
 * Schema for a single test case.
 */
export const TestCaseSchema = z.object({
  name: z.string().min(1, 'Test name is required').describe('Human-readable test name'),
  prompt: z.string().min(1, 'Prompt is required').describe('The prompt to send to the LLM'),
  variables: z
    .record(z.string(), z.string())
    .optional()
    .describe('Variables for template interpolation ({{variable}} syntax)'),
  providers: z
    .array(z.string().min(1))
    .optional()
    .describe('Override: run only against these providers'),
  expect: ExpectationSchema.describe('Expected response characteristics'),
});

/**
 * Schema for the top-level PromptCanary configuration file.
 */
export const PromptCanaryConfigSchema = z.object({
  version: z.literal('1').describe('Config schema version'),
  config: z.object({
    providers: z
      .array(ProviderConfigSchema)
      .min(1, 'At least one provider is required')
      .describe('LLM provider configurations'),
    embedding_provider: z
      .object({
        api_key_env: z.string().min(1).default('OPENAI_API_KEY'),
        model: z.string().min(1).default('text-embedding-3-small'),
      })
      .optional()
      .describe('Embedding provider for semantic similarity'),
  }),
  tests: z
    .array(TestCaseSchema)
    .min(1, 'At least one test case is required')
    .describe('Prompt test case definitions'),
});
