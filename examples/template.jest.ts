import { testPrompt, assertions } from 'promptcanary';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => Promise<void>) => void;
declare const expect: (value: unknown) => { toBe: (expected: unknown) => void };

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
