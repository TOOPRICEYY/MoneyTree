import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts', 'packages/web/vite.config.ts'],
    onConsoleLog: (_log, type) => {
      // print only console.error
      return type === 'stderr';
    },
  },
});
