// vite.config.js
import { fileURLToPath, URL } from 'url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv, type ConfigEnv } from 'vite';
import environment from 'vite-plugin-environment';
import dotenv from 'dotenv';
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';
import viteCompression from 'vite-plugin-compression';

dotenv.config({ 
  path: path.resolve(__dirname, "../../.env"),
  override: true 
});

const ENV = process.env.DFX_NETWORK || 'local';

export default defineConfig(({ mode }: ConfigEnv) => {
  const env = loadEnv(mode, process.cwd(), '');
  const icHost = "https://icp-api.io";

  return {
    build: {
      emptyOutDir: true,
      sourcemap: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules/svelte')) {
              return 'vendor';
            }
            if (id.includes('charting_library')) {
              return 'charting';
            }
          },
        },
        external: [
          '@sveltejs/kit',
          '@sveltejs/kit/vite',
          'sveltekit/environment'
        ]
      },
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
        },
      },
      modulePreload: false 
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
      exclude: ['@sveltejs/kit']
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
      environment("all", { prefix: "CANISTER_" }),
      environment("all", { prefix: "DFX_" }),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'KongSwap',
          short_name: 'KongSwap',
          description: 'KongSwap is a decentralized exchange for the Internet Computer',
          theme_color: '#0E111B',
          icons: [
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.js$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'js-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 30 * 24 * 60 * 60
                }
              }
            }
          ]
        }
      }),
      // viteCompression({
      //   verbose: true,
      //   disable: false,
      //   threshold: 5200,
      //   algorithm: 'gzip',
      //   ext: '.gz',
      // }),
      // viteCompression({
      //   verbose: true,
      //   disable: false,
      //   threshold: 5200,
      //   algorithm: 'brotliCompress',
      //   ext: '.br',
      // }),
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
            new URL("./src/lib", import.meta.url)
          ),
        },
      ],
    },
    worker: {
      plugins: () => [sveltekit()],
      format: 'es',
    },
    define: {
      'process.env.CANISTER_ID_KONG_BACKEND': JSON.stringify(env.CANISTER_ID_KONG_BACKEND),
      'process.env.CANISTER_ID_ICP_LEDGER': JSON.stringify(env.CANISTER_ID_ICP_LEDGER),
      'process.env.DFX_NETWORK': JSON.stringify(env.DFX_NETWORK),
      'process.env.IC_HOST': JSON.stringify(env.IC_HOST),
    },
  };
});
