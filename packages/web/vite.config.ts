import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Same React Compiler setup as Actual's desktop-client: compile workspace
// sources, never node_modules.
const reactCompilerInclude =
  /[\\/]packages[\\/][^\\/]+[\\/]src[\\/].*\.[jt]sx?(?:$|\?)/;

export default defineConfig({
  plugins: [
    react(),
    babel({
      include: [reactCompilerInclude],
      presets: [reactCompilerPreset()],
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:5007' },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
