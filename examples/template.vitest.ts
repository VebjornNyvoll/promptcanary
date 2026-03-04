import { describe, it, expect } from 'vitest';
import { testPrompt, assertions } from 'promptcanary';

describe('prompt tests', () => {
  it('responds with expected content', async () => {
    // Set your API key: export OPENAI_API_KEY="sk-..."
    const result = await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello in one sentence' }],
    });

    expect(assertions.contains(result.content, 'hello').passed).toBe(true);
    expect(assertions.maxLength(result.content, 200).passed).toBe(true);
  });
});
