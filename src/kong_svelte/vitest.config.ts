import { defineConfig } from 'vitest/config';
import path from 'path';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      '@declarations': path.resolve(__dirname, '../declarations'),
      '$lib': path.resolve(__dirname, './src/lib'),
      '$app': path.resolve(__dirname, './.svelte-kit/runtime/app'),
      '$env': path.resolve(__dirname, './.svelte-kit/runtime/env'),
      '$service-worker': path.resolve(__dirname, './.svelte-kit/runtime/service-worker')
    }
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    setupFiles: ['testSetup.ts'],
    globals: true,
    environment: 'jsdom',
    reporters: 'default',
    sequence: {
      shuffle: false
    },
    testTimeout: 20000
  }
}); 