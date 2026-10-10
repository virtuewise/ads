import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts'],
    // Enable TypeScript path aliases from root tsconfig
    alias: {
      '@printsync': new URL('./packages', import.meta.url).pathname,
    },
  },
});
