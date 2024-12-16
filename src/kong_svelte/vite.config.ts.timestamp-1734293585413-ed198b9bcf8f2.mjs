// vite.config.ts
import { fileURLToPath, URL } from "url";
import { sveltekit } from "file:///Users/nolan/Code/oisykong/node_modules/@sveltejs/kit/src/exports/vite/index.js";
import { defineConfig, loadEnv } from "file:///Users/nolan/Code/oisykong/node_modules/vite/dist/node/index.js";
import environment from "file:///Users/nolan/Code/oisykong/node_modules/vite-plugin-environment/dist/index.js";
import dotenv from "file:///Users/nolan/Code/oisykong/node_modules/dotenv/lib/main.js";
import path from "path";
import { VitePWA } from "file:///Users/nolan/Code/oisykong/node_modules/vite-plugin-pwa/dist/index.js";
import viteCompression from "file:///Users/nolan/Code/oisykong/node_modules/vite-plugin-compression/dist/index.mjs";
var __vite_injected_original_dirname = "/Users/nolan/Code/oisykong/src/kong_svelte";
var __vite_injected_original_import_meta_url = "file:///Users/nolan/Code/oisykong/src/kong_svelte/vite.config.ts";
dotenv.config({
  path: path.resolve(__vite_injected_original_dirname, "../../.env"),
  override: true
});
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    build: {
      emptyOutDir: true,
      sourcemap: true,
      chunkSizeWarningLimit: 1e3,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes("node_modules/svelte")) {
              return "vendor";
            }
            if (id.includes("charting_library")) {
              return "charting";
            }
          }
        },
        external: [
          "@sveltejs/kit",
          "@sveltejs/kit/vite",
          "sveltekit/environment"
        ]
      },
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: false
        }
      },
      modulePreload: false
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis"
        }
      },
      exclude: ["@sveltejs/kit"]
    },
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:4943",
          changeOrigin: true
        }
      }
    },
    plugins: [
      sveltekit(),
      environment("all", { prefix: "CANISTER_" }),
      environment("all", { prefix: "DFX_" }),
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "KongSwap",
          short_name: "KongSwap",
          description: "KongSwap is a decentralized exchange for the Internet Computer",
          theme_color: "#0E111B",
          icons: [
            {
              src: "/icons/icon-192x192.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "/icons/icon-512x512.png",
              sizes: "512x512",
              type: "image/png"
            }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.js$/,
              handler: "CacheFirst",
              options: {
                cacheName: "js-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 30 * 24 * 60 * 60
                }
              }
            }
          ]
        }
      }),
      viteCompression({
        verbose: true,
        disable: false,
        threshold: 5200,
        algorithm: "gzip",
        ext: ".gz"
      }),
      viteCompression({
        verbose: true,
        disable: false,
        threshold: 5200,
        algorithm: "brotliCompress",
        ext: ".br"
      })
    ],
    resolve: {
      alias: [
        {
          find: "@declarations",
          replacement: fileURLToPath(
            new URL("../declarations", __vite_injected_original_import_meta_url)
          )
        },
        {
          find: "$lib",
          replacement: fileURLToPath(
            new URL("./src/lib", __vite_injected_original_import_meta_url)
          )
        }
      ]
    },
    worker: {
      plugins: () => [sveltekit()],
      format: "es"
    },
    define: {
      "process.env.CANISTER_ID_KONG_BACKEND": JSON.stringify(env.CANISTER_ID_KONG_BACKEND),
      "process.env.CANISTER_ID_ICP_LEDGER": JSON.stringify(env.CANISTER_ID_ICP_LEDGER),
      "process.env.DFX_NETWORK": JSON.stringify(env.DFX_NETWORK),
      "process.env.IC_HOST": JSON.stringify(env.IC_HOST)
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./test/setup.ts"]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvbm9sYW4vQ29kZS9vaXN5a29uZy9zcmMva29uZ19zdmVsdGVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9ub2xhbi9Db2RlL29pc3lrb25nL3NyYy9rb25nX3N2ZWx0ZS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvbm9sYW4vQ29kZS9vaXN5a29uZy9zcmMva29uZ19zdmVsdGUvdml0ZS5jb25maWcudHNcIjsvLyB2aXRlLmNvbmZpZy5qc1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSAndXJsJztcbmltcG9ydCB7IHN2ZWx0ZWtpdCB9IGZyb20gJ0BzdmVsdGVqcy9raXQvdml0ZSc7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYsIHR5cGUgQ29uZmlnRW52IH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgZW52aXJvbm1lbnQgZnJvbSAndml0ZS1wbHVnaW4tZW52aXJvbm1lbnQnO1xuaW1wb3J0IGRvdGVudiBmcm9tICdkb3RlbnYnO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnO1xuaW1wb3J0IHZpdGVDb21wcmVzc2lvbiBmcm9tICd2aXRlLXBsdWdpbi1jb21wcmVzc2lvbic7XG5cbmRvdGVudi5jb25maWcoeyBcbiAgcGF0aDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuLi8uLi8uZW52XCIpLFxuICBvdmVycmlkZTogdHJ1ZSBcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9OiBDb25maWdFbnYpID0+IHtcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnJyk7XG5cbiAgcmV0dXJuIHtcbiAgICBidWlsZDoge1xuICAgICAgZW1wdHlPdXREaXI6IHRydWUsXG4gICAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXG4gICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgIG91dHB1dDoge1xuICAgICAgICAgIG1hbnVhbENodW5rczogKGlkKSA9PiB7XG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9zdmVsdGUnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvcic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2NoYXJ0aW5nX2xpYnJhcnknKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ2NoYXJ0aW5nJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBleHRlcm5hbDogW1xuICAgICAgICAgICdAc3ZlbHRlanMva2l0JyxcbiAgICAgICAgICAnQHN2ZWx0ZWpzL2tpdC92aXRlJyxcbiAgICAgICAgICAnc3ZlbHRla2l0L2Vudmlyb25tZW50J1xuICAgICAgICBdXG4gICAgICB9LFxuICAgICAgbWluaWZ5OiAndGVyc2VyJyxcbiAgICAgIHRlcnNlck9wdGlvbnM6IHtcbiAgICAgICAgY29tcHJlc3M6IHtcbiAgICAgICAgICBkcm9wX2NvbnNvbGU6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG1vZHVsZVByZWxvYWQ6IGZhbHNlIFxuICAgIH0sXG4gICAgb3B0aW1pemVEZXBzOiB7XG4gICAgICBlc2J1aWxkT3B0aW9uczoge1xuICAgICAgICBkZWZpbmU6IHtcbiAgICAgICAgICBnbG9iYWw6IFwiZ2xvYmFsVGhpc1wiLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGV4Y2x1ZGU6IFsnQHN2ZWx0ZWpzL2tpdCddXG4gICAgfSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHByb3h5OiB7XG4gICAgICAgIFwiL2FwaVwiOiB7XG4gICAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly8xMjcuMC4wLjE6NDk0M1wiLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBzdmVsdGVraXQoKSxcbiAgICAgIGVudmlyb25tZW50KFwiYWxsXCIsIHsgcHJlZml4OiBcIkNBTklTVEVSX1wiIH0pLFxuICAgICAgZW52aXJvbm1lbnQoXCJhbGxcIiwgeyBwcmVmaXg6IFwiREZYX1wiIH0pLFxuICAgICAgVml0ZVBXQSh7XG4gICAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxuICAgICAgICBtYW5pZmVzdDoge1xuICAgICAgICAgIG5hbWU6ICdLb25nU3dhcCcsXG4gICAgICAgICAgc2hvcnRfbmFtZTogJ0tvbmdTd2FwJyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0tvbmdTd2FwIGlzIGEgZGVjZW50cmFsaXplZCBleGNoYW5nZSBmb3IgdGhlIEludGVybmV0IENvbXB1dGVyJyxcbiAgICAgICAgICB0aGVtZV9jb2xvcjogJyMwRTExMUInLFxuICAgICAgICAgIGljb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHNyYzogJy9pY29ucy9pY29uLTE5MngxOTIucG5nJyxcbiAgICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcbiAgICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzcmM6ICcvaWNvbnMvaWNvbi01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICB3b3JrYm94OiB7XG4gICAgICAgICAgbWF4aW11bUZpbGVTaXplVG9DYWNoZUluQnl0ZXM6IDMgKiAxMDI0ICogMTAyNCxcbiAgICAgICAgICBydW50aW1lQ2FjaGluZzogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLy4qXFwuanMkLyxcbiAgICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxuICAgICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnanMtY2FjaGUnLFxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcbiAgICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDUwLFxuICAgICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogMzAgKiAyNCAqIDYwICogNjBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgdml0ZUNvbXByZXNzaW9uKHtcbiAgICAgICAgdmVyYm9zZTogdHJ1ZSxcbiAgICAgICAgZGlzYWJsZTogZmFsc2UsXG4gICAgICAgIHRocmVzaG9sZDogNTIwMCxcbiAgICAgICAgYWxnb3JpdGhtOiAnZ3ppcCcsXG4gICAgICAgIGV4dDogJy5neicsXG4gICAgICB9KSxcbiAgICAgIHZpdGVDb21wcmVzc2lvbih7XG4gICAgICAgIHZlcmJvc2U6IHRydWUsXG4gICAgICAgIGRpc2FibGU6IGZhbHNlLFxuICAgICAgICB0aHJlc2hvbGQ6IDUyMDAsXG4gICAgICAgIGFsZ29yaXRobTogJ2Jyb3RsaUNvbXByZXNzJyxcbiAgICAgICAgZXh0OiAnLmJyJyxcbiAgICAgIH0pLFxuICAgIF0sXG4gICAgcmVzb2x2ZToge1xuICAgICAgYWxpYXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGZpbmQ6IFwiQGRlY2xhcmF0aW9uc1wiLFxuICAgICAgICAgIHJlcGxhY2VtZW50OiBmaWxlVVJMVG9QYXRoKFxuICAgICAgICAgICAgbmV3IFVSTChcIi4uL2RlY2xhcmF0aW9uc1wiLCBpbXBvcnQubWV0YS51cmwpXG4gICAgICAgICAgKSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGZpbmQ6IFwiJGxpYlwiLFxuICAgICAgICAgIHJlcGxhY2VtZW50OiBmaWxlVVJMVG9QYXRoKFxuICAgICAgICAgICAgbmV3IFVSTChcIi4vc3JjL2xpYlwiLCBpbXBvcnQubWV0YS51cmwpXG4gICAgICAgICAgKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB3b3JrZXI6IHtcbiAgICAgIHBsdWdpbnM6ICgpID0+IFtzdmVsdGVraXQoKV0sXG4gICAgICBmb3JtYXQ6ICdlcycsXG4gICAgfSxcbiAgICBkZWZpbmU6IHtcbiAgICAgICdwcm9jZXNzLmVudi5DQU5JU1RFUl9JRF9LT05HX0JBQ0tFTkQnOiBKU09OLnN0cmluZ2lmeShlbnYuQ0FOSVNURVJfSURfS09OR19CQUNLRU5EKSxcbiAgICAgICdwcm9jZXNzLmVudi5DQU5JU1RFUl9JRF9JQ1BfTEVER0VSJzogSlNPTi5zdHJpbmdpZnkoZW52LkNBTklTVEVSX0lEX0lDUF9MRURHRVIpLFxuICAgICAgJ3Byb2Nlc3MuZW52LkRGWF9ORVRXT1JLJzogSlNPTi5zdHJpbmdpZnkoZW52LkRGWF9ORVRXT1JLKSxcbiAgICAgICdwcm9jZXNzLmVudi5JQ19IT1NUJzogSlNPTi5zdHJpbmdpZnkoZW52LklDX0hPU1QpLFxuICAgIH0sXG4gICAgdGVzdDoge1xuICAgICAgZW52aXJvbm1lbnQ6ICdqc2RvbScsXG4gICAgICBnbG9iYWxzOiB0cnVlLFxuICAgICAgc2V0dXBGaWxlczogWycuL3Rlc3Qvc2V0dXAudHMnXSxcbiAgICB9LFxuICB9O1xufSk7XG4iXSwKICAibWFwcGlu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
