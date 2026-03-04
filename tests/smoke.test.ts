import { describe, expect, it } from 'vitest';

import { VERSION } from '../src/index.js';

describe('smoke', () => {
  it('exports the expected version', () => {
    expect(VERSION).toBe('1.0.0');
  });
});
