// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8', // or 'istanbul'
      enabled: true,
      reporter: ['text', 'lcov'], // 'lcov' is crucial for Coveralls
    },
  },
});