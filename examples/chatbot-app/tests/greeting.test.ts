import { describe, it, expect } from 'vitest';
import { testPrompt, semanticSimilarity } from 'promptcanary';

describe('greeting prompt', () => {
  it('responds with a friendly greeting', async () => {
    const result = await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a friendly assistant. Greet the user warmly.' },
        { role: 'user', content: 'Hello!' },
      ],
    });

    const score = await semanticSimilarity(result.content, 'Hello! How can I help you today?');
    expect(score).toBeGreaterThan(0.7);
  });

  it('gives consistent responses across providers', async () => {
    const prompt = {
      messages: [
        {
          role: 'system' as const,
          content: 'You are a helpful assistant. Respond in one short sentence.',
        },
        { role: 'user' as const, content: 'What is 2 + 2?' },
      ],
    };

    const [openai, anthropic] = await Promise.all([
      testPrompt({ provider: 'openai', model: 'gpt-4o-mini', ...prompt }),
      testPrompt({
        provider: 'anthropic',
        model: 'claude-3-5-haiku-latest',
        ...prompt,
      }),
    ]);

    expect(openai.content).toContain('4');
    expect(anthropic.content).toContain('4');

    const score = await semanticSimilarity(openai.content, anthropic.content);
    expect(score).toBeGreaterThan(0.7);
  });
});
