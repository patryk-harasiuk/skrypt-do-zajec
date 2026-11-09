import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    // Core ma działać bez DOM; testy muszą to potwierdzać.
    environment: 'node',
  },
});
