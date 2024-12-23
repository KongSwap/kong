import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@declarations': path.resolve(__dirname, '../declarations'),
      '$lib': path.resolve(__dirname, './src/lib')
    }
  },
  test: {
    include: ['test/**/*.{test,spec}.{js,ts}'],
    setupFiles: ['test/setup.ts'],
    globals: true,
    environment: 'jsdom'
  }
}); 