import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 0,
    rollupOptions: {
      maxParallelFileOps: 2,
      output: {
        format: 'esm',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].[hash].js',
        assetFileNames: '[name].[ext]'
      }
    }
  },
  logLevel: 'info',
  clearScreen: false,
  debug: true,
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis'
      },
      // Enable CommonJS syntax
      format: 'esm'
    },
    include: [
      'borc',
      'buffer',
      'base64-js',
      'ieee754'
    ]
  }
}); 
