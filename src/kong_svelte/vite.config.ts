// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import environment from 'vite-plugin-environment';
import viteCompression from 'vite-plugin-compression';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({
  path: path.resolve(__dirname, '../../.env')
});

export default defineConfig({
  plugins: [
    sveltekit(),
    environment([
      'DFX_NETWORK',
      'CANISTER_ID_KONG_BACKEND',
      'CANISTER_ID_KONG_FRONTEND',
      'CANISTER_ID_KONG_DATA',
      'CANISTER_ID_KONG_SVELTE'
    ]),
    VitePWA(),
    viteCompression()
  ],
  build: {
    rollupOptions: {
      external: ['__sveltekit/environment']
    }
  },
  define: {
    'process.env': Object.fromEntries(
      Object.entries(process.env).filter(([key]) => 
        key.startsWith('VITE_') || 
        key.startsWith('CANISTER_ID_') ||
        key === 'DFX_NETWORK'
      )
    )
  }
});
