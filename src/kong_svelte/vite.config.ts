// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv, type ConfigEnv } from 'vite';
import environment from 'vite-plugin-environment';
import * as dotenv from 'dotenv';
import * as path from "path";
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import viteCompression from 'vite-plugin-compression';
import type { UserConfig } from 'vite';
import { execSync } from 'child_process';

// Load base env first
const baseEnv = dotenv.config({ 
  path: path.resolve(__dirname, "../../.env"),
  override: true 
}).parsed || {};

// Load and merge Doppler env
const dopplerEnv = dotenv.config({ 
  path: path.resolve(__dirname, ".secrets"),
  override: true 
}).parsed || {};

// Combine environments with Doppler taking precedence
const combinedEnv = { ...baseEnv, ...dopplerEnv };

// Get git commit hash
const getGitHash = () => {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch (error) {
    return 'development';
  }
};

export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  const env = loadEnv(mode, process.cwd());
  const gitHash = getGitHash();
  
  // Merge our combined env with Vite's env
  const fullEnv = { ...env, ...combinedEnv };

  // Create base plugins array
  const basePlugins = [
    sveltekit(),
    environment("all", { prefix: "CANISTER_" }),
    environment("all", { prefix: "DFX_" }),
    SvelteKitPWA({
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
                maxAgeSeconds: 60 * 60 * 24 * 1 // 1 day
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
    sourcemap: process.env.DFX_NETWORK === "local",
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
    modulePreload: {
      polyfill: true
    },
    commonjsOptions: {
      include: [/node_modules/],
      requireReturnsDefault: "namespace" as const,
      transformMixedEsModules: true
    }
  };

  // Add compression plugins and terser for non-local environments
  if (process.env.DFX_NETWORK !== "local") {
    basePlugins.push(
      viteCompression({
        verbose: true,
        disable: false,
        threshold: 5200,
        algorithm: 'gzip',
        ext: '.gz',
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
      include: ['comlink', '@dfinity/agent'],
      exclude: ['@sveltejs/kit', '$lib/utils/browser', '@dfinity/candid', '@dfinity/principal']
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:4943",
          changeOrigin: true,
        },
      },
      fs: {
        // Allow serving files from one level up to the project root
        allow: ['..']
      },
      watch: {
        usePolling: true
      }
    },
    plugins: basePlugins as any[],
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
      'process.env': JSON.stringify({
        ...fullEnv,
        VITE_RELEASE: gitHash
      }),
      'import.meta.env': JSON.stringify({
        ...fullEnv,
        MODE: mode,
        VITE_RELEASE: gitHash
      })
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./test/setup.ts'],
    }
  } as UserConfig;
});