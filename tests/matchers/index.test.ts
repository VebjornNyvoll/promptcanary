import { beforeAll, describe, expect, it } from 'vitest';
import { extendExpect, type PromptCanaryMatchers } from '../../src/matchers/index.js';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T> extends PromptCanaryMatchers<T> {}
}

beforeAll(() => {
  extendExpect(expect as unknown as Parameters<typeof extendExpect>[0]);
});

describe('expect.extend matchers', () => {
  describe('toContainPrompt', () => {
    it('passes when content contains substring', () => {
      expect('Your refund will arrive in 30 days').toContainPrompt('refund');
    });

    it('fails when content does not contain substring', () => {
      expect(() => {
        expect('Hello world').toContainPrompt('refund');
      }).toThrow();
    });

    it('is case-insensitive', () => {
      expect('REFUND policy').toContainPrompt('refund');
    });
  });

  describe('toNotContainPrompt', () => {
    it('passes when content does not contain substring', () => {
      expect('Hello world').toNotContainPrompt('refund');
    });

    it('fails when content contains substring', () => {
      expect(() => {
        expect('Refund policy').toNotContainPrompt('refund');
      }).toThrow();
    });
  });

  describe('toStartWithPrompt', () => {
    it('passes when content starts with prefix', () => {
      expect('Hello World').toStartWithPrompt('Hello');
    });

    it('fails when content does not start with prefix', () => {
      expect(() => {
        expect('World Hello').toStartWithPrompt('Hello');
      }).toThrow();
    });
  });

  describe('toEndWithPrompt', () => {
    it('passes when content ends with suffix', () => {
      expect('Hello World').toEndWithPrompt('World');
    });

    it('fails when content does not end with suffix', () => {
      expect(() => {
        expect('World Hello').toEndWithPrompt('World');
      }).toThrow();
    });
  });

  describe('toContainAllPrompt', () => {
    it('passes when all substrings found', () => {
      expect('Hello World Test').toContainAllPrompt(['Hello', 'World']);
    });

    it('fails when some substrings missing', () => {
      expect(() => {
        expect('Hello World').toContainAllPrompt(['Hello', 'Missing']);
      }).toThrow();
    });
  });

  describe('toContainAnyPrompt', () => {
    it('passes when at least one substring found', () => {
      expect('Hello World').toContainAnyPrompt(['Missing', 'World']);
    });

    it('fails when no substrings found', () => {
      expect(() => {
        expect('Hello World').toContainAnyPrompt(['Missing', 'NotHere']);
      }).toThrow();
    });
  });

  describe('toMatchMaxLength', () => {
    it('passes when within limit', () => {
      expect('Hello').toMatchMaxLength(10);
    });

    it('fails when exceeds limit', () => {
      expect(() => {
        expect('Hello World').toMatchMaxLength(5);
      }).toThrow();
    });
  });

  describe('toMatchMinLength', () => {
    it('passes when meets minimum', () => {
      expect('Hello World').toMatchMinLength(5);
    });

    it('fails when too short', () => {
      expect(() => {
        expect('Hi').toMatchMinLength(5);
      }).toThrow();
    });
  });

  describe('toMatchWordCount', () => {
    it('passes when within range', () => {
      expect('one two three').toMatchWordCount({ min: 2, max: 5 });
    });

    it('fails when out of range', () => {
      expect(() => {
        expect('one').toMatchWordCount({ min: 3 });
      }).toThrow();
    });
  });

  describe('toMatchPromptRegex', () => {
    it('passes when pattern matches', () => {
      expect('Error code: 404').toMatchPromptRegex(/\d{3}/);
    });

    it('fails when pattern does not match', () => {
      expect(() => {
        expect('No numbers here').toMatchPromptRegex(/\d+/);
      }).toThrow();
    });
  });

  describe('toBeValidJson', () => {
    it('passes for valid JSON', () => {
      expect('{"key":"value"}').toBeValidJson();
    });

    it('fails for invalid JSON', () => {
      expect(() => {
        expect('not json').toBeValidJson();
      }).toThrow();
    });
  });

  describe('toMatchJsonSchema', () => {
    it('passes when schema matches', () => {
      expect('{"name":"test","age":25}').toMatchJsonSchema({ name: 'string', age: 'number' });
    });

    it('fails when schema does not match', () => {
      expect(() => {
        expect('{"name":"test"}').toMatchJsonSchema({ name: 'string', age: 'number' });
      }).toThrow();
    });
  });

  describe('toMatchLevenshtein', () => {
    it('passes when score meets threshold', () => {
      expect('hello world').toMatchLevenshtein('hello world', 0.9);
    });

    it('fails when score below threshold', () => {
      expect(() => {
        expect('abc').toMatchLevenshtein('xyz', 0.5);
      }).toThrow();
    });
  });

  describe('toMatchRouge1', () => {
    it('passes when score meets threshold', () => {
      expect('the cat sat on the mat').toMatchRouge1('the cat sat', 0.5);
    });

    it('fails when score below threshold', () => {
      expect(() => {
        expect('completely different').toMatchRouge1('the cat sat on the mat', 0.8);
      }).toThrow();
    });
  });

  describe('toMatchBleu', () => {
    it('passes when score meets threshold', () => {
      expect('the cat sat on the mat').toMatchBleu('the cat sat on the mat', 0.8);
    });

    it('fails when score below threshold', () => {
      expect(() => {
        expect('completely different text here').toMatchBleu('the cat sat on the mat', 0.8);
      }).toThrow();
    });
  });

  describe('.not support', () => {
    it('supports .not for negation', () => {
      expect('Hello world').not.toContainPrompt('refund');
    });

    it('negation fails when match found', () => {
      expect(() => {
        expect('Hello world').not.toContainPrompt('Hello');
      }).toThrow();
    });
  });
});
