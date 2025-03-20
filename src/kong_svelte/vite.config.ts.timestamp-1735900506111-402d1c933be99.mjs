// vite.config.ts
import { sveltekit } from "file:///Users/gorazd/Documents/Projects/kong_swap/kong/src/kong_svelte/node_modules/@sveltejs/kit/src/exports/vite/index.js";
import { defineConfig, loadEnv } from "file:///Users/gorazd/Documents/Projects/kong_swap/kong/src/kong_svelte/node_modules/vite/dist/node/index.js";
import environment from "file:///Users/gorazd/Documents/Projects/kong_swap/kong/node_modules/vite-plugin-environment/dist/index.js";
import dotenv from "file:///Users/gorazd/Documents/Projects/kong_swap/kong/node_modules/dotenv/lib/main.js";
import path from "path";
import { VitePWA } from "file:///Users/gorazd/Documents/Projects/kong_swap/kong/node_modules/vite-plugin-pwa/dist/index.js";
import viteCompression from "file:///Users/gorazd/Documents/Projects/kong_swap/kong/node_modules/vite-plugin-compression/dist/index.mjs";
var __vite_injected_original_dirname = "/Users/gorazd/Documents/Projects/kong_swap/kong/src/kong_svelte";
dotenv.config({
  path: path.resolve(__vite_injected_original_dirname, "../../.env"),
  override: true
});
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const basePlugins = [
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
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // 5MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "js-cache",
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 7
                // 7 days
              }
            }
          }
        ]
      }
    })
  ];
  const buildOptions = {
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1800,
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
    modulePreload: false,
    commonjsOptions: {
      include: [/node_modules/],
      requireReturnsDefault: "namespace",
      transformMixedEsModules: true
    }
  };
  console.log("DFX_NETWORK", process.env.DFX_NETWORK);
  if (process.env.DFX_NETWORK !== "local") {
    basePlugins.push(
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
    );
    Object.assign(buildOptions, {
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: false
        }
      }
    });
  }
  return {
    build: buildOptions,
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis"
        }
      },
      include: ["dexie", "comlink", "borc", "@dfinity/agent"],
      exclude: ["@sveltejs/kit", "$lib/utils/browser"]
    },
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:4943",
          changeOrigin: true
        }
      }
    },
    plugins: basePlugins,
    resolve: {
      alias: [
        {
          find: "@declarations",
          replacement: path.resolve(__vite_injected_original_dirname, "../declarations")
        },
        {
          find: "$lib",
          replacement: path.resolve(__vite_injected_original_dirname, "./src/lib")
        }
      ]
    },
    worker: {
      plugins: () => [sveltekit()],
      format: "es"
    },
    define: {
      "process.env": JSON.stringify(env),
      "import.meta.env": JSON.stringify({
        ...env,
        MODE: mode
      })
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvZ29yYXpkL0RvY3VtZW50cy9Qcm9qZWN0cy9rb25nX3N3YXAva29uZy9zcmMva29uZ19zdmVsdGVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9nb3JhemQvRG9jdW1lbnRzL1Byb2plY3RzL2tvbmdfc3dhcC9rb25nL3NyYy9rb25nX3N2ZWx0ZS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvZ29yYXpkL0RvY3VtZW50cy9Qcm9qZWN0cy9rb25nX3N3YXAva29uZy9zcmMva29uZ19zdmVsdGUvdml0ZS5jb25maWcudHNcIjsvLyB2aXRlLmNvbmZpZy5qc1xuaW1wb3J0IHsgc3ZlbHRla2l0IH0gZnJvbSAnQHN2ZWx0ZWpzL2tpdC92aXRlJztcbmltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiwgdHlwZSBDb25maWdFbnYgfSBmcm9tICd2aXRlJztcbmltcG9ydCBlbnZpcm9ubWVudCBmcm9tICd2aXRlLXBsdWdpbi1lbnZpcm9ubWVudCc7XG5pbXBvcnQgZG90ZW52IGZyb20gJ2RvdGVudic7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5pbXBvcnQgdml0ZUNvbXByZXNzaW9uIGZyb20gJ3ZpdGUtcGx1Z2luLWNvbXByZXNzaW9uJztcblxuZG90ZW52LmNvbmZpZyh7IFxuICBwYXRoOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uLy4uLy5lbnZcIiksXG4gIG92ZXJyaWRlOiB0cnVlIFxufSk7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH06IENvbmZpZ0VudikgPT4ge1xuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKTtcblxuICAvLyBDcmVhdGUgYmFzZSBwbHVnaW5zIGFycmF5XG4gIGNvbnN0IGJhc2VQbHVnaW5zID0gW1xuICAgIHN2ZWx0ZWtpdCgpLFxuICAgIGVudmlyb25tZW50KFwiYWxsXCIsIHsgcHJlZml4OiBcIkNBTklTVEVSX1wiIH0pLFxuICAgIGVudmlyb25tZW50KFwiYWxsXCIsIHsgcHJlZml4OiBcIkRGWF9cIiB9KSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxuICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgbmFtZTogJ0tvbmdTd2FwJyxcbiAgICAgICAgc2hvcnRfbmFtZTogJ0tvbmdTd2FwJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdLb25nU3dhcCBpcyBhIGRlY2VudHJhbGl6ZWQgZXhjaGFuZ2UgZm9yIHRoZSBJbnRlcm5ldCBDb21wdXRlcicsXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzBFMTExQicsXG4gICAgICAgIGljb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAnL2ljb25zL2ljb24tMTkyeDE5Mi5wbmcnLFxuICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAnL2ljb25zL2ljb24tNTEyeDUxMi5wbmcnLFxuICAgICAgICAgICAgc2l6ZXM6ICc1MTJ4NTEyJyxcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAgd29ya2JveDoge1xuICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogNSAqIDEwMjQgKiAxMDI0LCAvLyA1TUJcbiAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLy4qXFwuanMkLyxcbiAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnanMtY2FjaGUnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogNyAvLyA3IGRheXNcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfVxuICAgIH0pXG4gIF07XG5cbiAgLy8gQmFzZSBidWlsZCBvcHRpb25zXG4gIGNvbnN0IGJ1aWxkT3B0aW9ucyA9IHtcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxODAwLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBtYW51YWxDaHVua3M6IChpZCkgPT4ge1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3N2ZWx0ZScpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3ZlbmRvcic7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnY2hhcnRpbmdfbGlicmFyeScpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2NoYXJ0aW5nJztcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgZXh0ZXJuYWw6IFtcbiAgICAgICAgJ0BzdmVsdGVqcy9raXQnLFxuICAgICAgICAnQHN2ZWx0ZWpzL2tpdC92aXRlJyxcbiAgICAgICAgJ3N2ZWx0ZWtpdC9lbnZpcm9ubWVudCdcbiAgICAgIF1cbiAgICB9LFxuICAgIG1vZHVsZVByZWxvYWQ6IGZhbHNlLFxuICAgIGNvbW1vbmpzT3B0aW9uczoge1xuICAgICAgaW5jbHVkZTogWy9ub2RlX21vZHVsZXMvXSxcbiAgICAgIHJlcXVpcmVSZXR1cm5zRGVmYXVsdDogXCJuYW1lc3BhY2VcIiBhcyBjb25zdCxcbiAgICAgIHRyYW5zZm9ybU1peGVkRXNNb2R1bGVzOiB0cnVlXG4gICAgfVxuICB9O1xuXG4gIC8vIEFkZCBjb21wcmVzc2lvbiBwbHVnaW5zIGFuZCB0ZXJzZXIgZm9yIG5vbi1sb2NhbCBlbnZpcm9ubWVudHNcbiAgY29uc29sZS5sb2coXCJERlhfTkVUV09SS1wiLCBwcm9jZXNzLmVudi5ERlhfTkVUV09SSylcbiAgaWYgKHByb2Nlc3MuZW52LkRGWF9ORVRXT1JLICE9PSBcImxvY2FsXCIpIHtcbiAgICBiYXNlUGx1Z2lucy5wdXNoKFxuICAgICAgdml0ZUNvbXByZXNzaW9uKHtcbiAgICAgICAgdmVyYm9zZTogdHJ1ZSxcbiAgICAgICAgZGlzYWJsZTogZmFsc2UsXG4gICAgICAgIHRocmVzaG9sZDogNTIwMCxcbiAgICAgICAgYWxnb3JpdGhtOiAnZ3ppcCcsXG4gICAgICAgIGV4dDogJy5neicsXG4gICAgICB9KSxcbiAgICAgIHZpdGVDb21wcmVzc2lvbih7XG4gICAgICAgIHZlcmJvc2U6IHRydWUsXG4gICAgICAgIGRpc2FibGU6IGZhbHNlLFxuICAgICAgICB0aHJlc2hvbGQ6IDUyMDAsXG4gICAgICAgIGFsZ29yaXRobTogJ2Jyb3RsaUNvbXByZXNzJyxcbiAgICAgICAgZXh0OiAnLmJyJyxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEFkZCB0ZXJzZXIgb3B0aW9ucyBmb3IgcHJvZHVjdGlvblxuICAgIE9iamVjdC5hc3NpZ24oYnVpbGRPcHRpb25zLCB7XG4gICAgICBtaW5pZnk6ICd0ZXJzZXInLFxuICAgICAgdGVyc2VyT3B0aW9uczoge1xuICAgICAgICBjb21wcmVzczoge1xuICAgICAgICAgIGRyb3BfY29uc29sZTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBidWlsZDogYnVpbGRPcHRpb25zLFxuICAgIG9wdGltaXplRGVwczoge1xuICAgICAgZXNidWlsZE9wdGlvbnM6IHtcbiAgICAgICAgZGVmaW5lOiB7XG4gICAgICAgICAgZ2xvYmFsOiBcImdsb2JhbFRoaXNcIixcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBpbmNsdWRlOiBbJ2RleGllJywgJ2NvbWxpbmsnLCAnYm9yYycsICdAZGZpbml0eS9hZ2VudCddLFxuICAgICAgZXhjbHVkZTogWydAc3ZlbHRlanMva2l0JywgJyRsaWIvdXRpbHMvYnJvd3NlciddXG4gICAgfSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHByb3h5OiB7XG4gICAgICAgIFwiL2FwaVwiOiB7XG4gICAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly8xMjcuMC4wLjE6NDk0M1wiLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBiYXNlUGx1Z2lucyxcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczogW1xuICAgICAgICB7XG4gICAgICAgICAgZmluZDogXCJAZGVjbGFyYXRpb25zXCIsXG4gICAgICAgICAgcmVwbGFjZW1lbnQ6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi4vZGVjbGFyYXRpb25zXCIpXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBmaW5kOiBcIiRsaWJcIixcbiAgICAgICAgICByZXBsYWNlbWVudDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyYy9saWJcIilcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICB9LFxuICAgIHdvcmtlcjoge1xuICAgICAgcGx1Z2luczogKCkgPT4gW3N2ZWx0ZWtpdCgpXSxcbiAgICAgIGZvcm1hdDogXCJlc1wiIGFzIGNvbnN0LFxuICAgIH0sXG4gICAgZGVmaW5lOiB7XG4gICAgICAncHJvY2Vzcy5lbnYnOiBKU09OLnN0cmluZ2lmeShlbnYpLFxuICAgICAgJ2ltcG9ydC5tZXRhLmVudic6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgLi4uZW52LFxuICAgICAgICBNT0RFOiBtb2RlLFxuICAgICAgfSlcbiAgICB9LFxuICAgIHRlc3Q6IHtcbiAgICAgIGVudmlyb25tZW50OiAnanNkb20nLFxuICAgICAgZ2xvYmFsczogdHJ1ZSxcbiAgICAgIHNldHVwRmlsZXM6IFsnLi90ZXN0L3NldHVwLnRzJ10sXG4gICAgfVxuICB9O1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQ0EsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxjQUFjLGVBQStCO0FBQ3RELE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sWUFBWTtBQUNuQixPQUFPLFVBQVU7QUFDakIsU0FBUyxlQUFlO0FBQ3hCLE9BQU8scUJBQXFCO0FBUDVCLElBQU0sbUNBQW1DO0FBU3pDLE9BQU8sT0FBTztBQUFBLEVBQ1osTUFBTSxLQUFLLFFBQVEsa0NBQVcsWUFBWTtBQUFBLEVBQzFDLFVBQVU7QUFDWixDQUFDO0FBRUQsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQWlCO0FBQ25ELFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUczQyxRQUFNLGNBQWM7QUFBQSxJQUNsQixVQUFVO0FBQUEsSUFDVixZQUFZLE9BQU8sRUFBRSxRQUFRLFlBQVksQ0FBQztBQUFBLElBQzFDLFlBQVksT0FBTyxFQUFFLFFBQVEsT0FBTyxDQUFDO0FBQUEsSUFDckMsUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsVUFBVTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2IsT0FBTztBQUFBLFVBQ0w7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1B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
