import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./app/__tests__/setup.ts'],
    globals: true,
    // Heavy suite: 87 jsdom files + coverage instrumentation running in parallel
    // pushes legitimate ~700ms tests past vitest's 5000ms default. Keep headroom
    // so slow-but-correct tests don't flake; real failures still throw immediately.
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'lib/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'app/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'i18n/**/*.{ts,tsx}',
        'proxy.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/.next/**',
        '**/*.config.*',
        '**/__tests__/**',
        '**/types.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
