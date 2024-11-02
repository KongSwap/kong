import { fileURLToPath, URL } from 'url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import environment from 'vite-plugin-environment';
import dotenv from 'dotenv';
import path from "path";

dotenv.config({ 
  path: path.resolve(__dirname, "../../.env"),
  override: true 
});

const canisterIds = {
  local: {
    KONG_BACKEND: "l4lgk-raaaa-aaaar-qahpq-cai",
  },
  staging: {
    KONG_BACKEND: "2ipq2-uqaaa-aaaar-qailq-cai",
  }
};

const ENV = process.env.DFX_NETWORK || 'local';

Object.entries(canisterIds[ENV]).forEach(([key, value]) => {
  process.env[`CANISTER_ID_${key}`] = value;
});

export default defineConfig({
  build: {
    emptyOutDir: true,
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4943",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    sveltekit(),
    // Ensure the prefixes match your .env variables
    environment("all", { prefix: "CANISTER_" }),
    environment("all", { prefix: "DFX_" }),
  ],
  resolve: {
    alias: [
      {
        find: "@declarations",
        replacement: fileURLToPath(
          new URL("../declarations", import.meta.url)
        ),
      },
      {
        find: "$lib",
        replacement: fileURLToPath(
          new URL("../src/lib", import.meta.url)
        ),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
  define: {
    'process.env.DFX_NETWORK': JSON.stringify(ENV),
    // Add any other environment variables you need
  }
});
