import { describe, it, expect } from 'vitest';
import { ExportEngine } from './index.js';

describe('ExportEngine', () => {
  it('can be instantiated', () => {
    const engine = new ExportEngine();
    expect(engine).toBeDefined();
  });
});
