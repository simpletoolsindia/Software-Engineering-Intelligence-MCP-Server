import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    alias: [
      // Resolve .js imports to .ts source files (TypeScript NodeNext style)
      { find: /^(\.{1,2}\/.+)\.js$/, replacement: '$1' }
    ]
  }
});
