import { describe, it, expect } from 'vitest';
import { ScriptEngine } from './index.js';

describe('ScriptEngine', () => {
  it('can be instantiated', () => {
    const engine = new ScriptEngine();
    expect(engine).toBeDefined();
  });
});
