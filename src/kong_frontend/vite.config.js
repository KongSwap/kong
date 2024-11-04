import { fileURLToPath, URL } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import environment from 'vite-plugin-environment';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const LOCAL_IDENTITY_URL = 'http://' + process.env.CANISTER_ID_INTERNET_IDENTITY + '.localhost:4943';
const MAINNET_INDENTITY_URL = 'https://identity.ic0.app';

process.env.II_URL =
 process.env.DFX_NETWORK === "local"
   ? LOCAL_IDENTITY_URL
   : MAINNET_INDENTITY_URL;

export default defineConfig({
  build: {
    emptyOutDir: true,
    sourcemap: true,
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
    react(),
    environment(["II_URL"]),
    environment("all", { prefix: "CANISTER_" }),
    environment("all", { prefix: "DFX_" }),
  ],
  resolve: {
    alias: [
      {
        find: "declarations",
        replacement: fileURLToPath(
          new URL("../declarations", import.meta.url)
        ),
      },
    ],
  },
});
