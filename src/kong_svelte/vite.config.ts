// vite.config.js
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

export default defineConfig(({ mode }: ConfigEnv) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Create base plugins array
  const basePlugins = [
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
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'js-cache',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          }
        ]
      }
    })
  ];

  // Base build options
  const buildOptions = {
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1800,
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
    modulePreload: false,
    commonjsOptions: {
      include: [/node_modules/],
      requireReturnsDefault: "namespace" as const,
      transformMixedEsModules: true
    }
  };

  // Add compression plugins and terser for non-local environments
  console.log("DFX_NETWORK", process.env.DFX_NETWORK)
  if (process.env.DFX_NETWORK !== "local") {
    basePlugins.push(
      viteCompression({
        verbose: true,
        disable: false,
        threshold: 5200,
        algorithm: 'gzip',
        ext: '.gz',
      }),
      viteCompression({
        verbose: true,
        disable: false,
        threshold: 5200,
        algorithm: 'brotliCompress',
        ext: '.br',
      })
    );

    // Add terser options for production
    Object.assign(buildOptions, {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
        },
      },
    });
  }

  return {
    build: buildOptions,
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
      include: ['dexie', 'comlink', 'borc', '@dfinity/agent'],
      exclude: ['@sveltejs/kit', '$lib/utils/browser']
    },
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:4943",
          changeOrigin: true,
        },
      },
    },
    plugins: basePlugins,
    resolve: {
      alias: [
        {
          find: "@declarations",
          replacement: path.resolve(__dirname, "../declarations")
        },
        {
          find: "$lib",
          replacement: path.resolve(__dirname, "./src/lib")
        }
      ],
    },
    worker: {
      plugins: () => [sveltekit()],
      format: "es" as const,
    },
    define: {
      'process.env': JSON.stringify(env),
      'import.meta.env': JSON.stringify({
        ...env,
        MODE: mode,
      })
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./test/setup.ts'],
    }
  };
});
