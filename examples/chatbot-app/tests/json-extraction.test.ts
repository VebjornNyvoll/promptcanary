import { describe, it, expect } from 'vitest';
import { testPrompt, assertions } from 'promptcanary';

describe('JSON extraction prompt', () => {
  it('returns valid JSON', async () => {
    const result = await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Extract product info as JSON. Return ONLY a JSON object with keys: name, price, category.',
        },
        {
          role: 'user',
          content: 'The Nike Air Max 90 running shoes cost $120 and are in the footwear category.',
        },
      ],
    });

    expect(assertions.isJson(result.content).passed).toBe(true);
  });

  it('matches expected JSON schema', async () => {
    const result = await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Extract product info as JSON. Return ONLY a JSON object with keys: name (string), price (number), category (string).',
        },
        {
          role: 'user',
          content: 'The Sony WH-1000XM5 headphones retail for $350 in the electronics department.',
        },
      ],
    });

    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        price: { type: 'number' },
        category: { type: 'string' },
      },
      required: ['name', 'price', 'category'],
    };

    expect(assertions.matchesJsonSchema(result.content, schema).passed).toBe(true);
  });
});
