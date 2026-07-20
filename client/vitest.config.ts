import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./app/__tests__/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['lib/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
      exclude: [
        '**/node_modules/**',
        '**/.next/**',
        '**/*.config.*',
        '**/app/**',
        '**/__tests__/**',
        '**/index.ts',
        '**/types.ts',
        '**/components/adventure/**',
        '**/components/character-sheet/**',
        '**/components/dashboard/**',
        'lib/breadcrumb.tsx',
        'lib/formula-builder.tsx',
        'lib/mythrion-popover.tsx',
        'lib/navigation-context.tsx',
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
