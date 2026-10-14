import { describe, expect, it } from 'vitest';
import { ScriptEngine } from './index.js';

describe('ScriptEngine', () => {
  it('can be instantiated', () => {
    const engine = new ScriptEngine();
    expect(engine).toBeDefined();
  });
});
