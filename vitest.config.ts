import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/electron/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    // Every package runs `vitest --root ../..` against this same config, so all
    // instances would otherwise write to one `node_modules/.vitest-cache` and
    // clobber each other (EBUSY) under turbo's parallel test task.
    fsModuleCache: false,
    // Enable TypeScript path aliases from root tsconfig
    alias: {
      '@printsync': new URL('./packages', import.meta.url).pathname,
    },
  },
});
