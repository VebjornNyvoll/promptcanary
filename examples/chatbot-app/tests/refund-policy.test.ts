import { describe, it, expect } from 'vitest';
import { testPrompt, assertions } from 'promptcanary';

describe('refund policy prompt', () => {
  it('mentions the 30-day return window', async () => {
    const result = await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a customer support agent for an e-commerce store. Our refund policy allows returns within 30 days of purchase for a full refund.',
        },
        { role: 'user', content: 'What is your refund policy?' },
      ],
    });

    expect(assertions.contains(result.content, '30').passed).toBe(true);
    expect(assertions.notContains(result.content, 'no refunds').passed).toBe(true);
    expect(assertions.maxLength(result.content, 500).passed).toBe(true);
    expect(assertions.matchesRegex(result.content, '\\d+\\s*days?').passed).toBe(true);
  });

  it('passes all assertions in batch', async () => {
    const result = await testPrompt({
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a customer support agent. Refund policy: 30 days, full refund, original payment method.',
        },
        { role: 'user', content: 'How do I get a refund?' },
      ],
    });

    const check = assertions.runAll(result.content, [
      { type: 'contains', value: 'refund' },
      { type: 'max_length', value: 1000 },
      { type: 'min_length', value: 20 },
      { type: 'regex', value: '\\d+' },
    ]);

    expect(check.passed).toBe(true);
    expect(check.results).toHaveLength(4);
  });
});
