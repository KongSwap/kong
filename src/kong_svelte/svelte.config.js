import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      pages: "dist",
      assets: "dist",
      fallback: "index.html",
      precompress: false,
      strict: false,
    }),
    files: {
      assets: "static",
    },
    alias: {
      $lib: "src/lib",
      "$lib/*": "src/lib/*",
      $declarations: "../declarations",
      "$declarations/*": "../declarations/*",
    },
    trailingSlash: 'always',
    prerender: {
      origin: 'https://kongswap.io',
      handleHttpError: ({ path, referrer, message }) => {
        // Ignore specific paths that require client-side rendering
        if (
          path === "/swap" ||
          path === "/pools" ||
          path === "/stats" ||
          path === "/predict" ||
          path === "/launch"
        ) {
          return;
        }

        // Throw error for other paths
        throw new Error(message);
      },
      handleMissingId: ({ id, path, referrers }) => {
        // Ignore missing hash links for specific routes
        if (
          id === "swap" ||
          id === "pools" ||
          id === "stats" ||
          id === "predict" ||
          id === ".well-known" ||
          id === "ic-domains" ||
          id === ".well-known/ic-domains"
        ) {
          return;
        }
        // Otherwise, fail the build
        throw new Error(
          `Missing ID "${id}" for link in ${referrers.join(", ")} pointing to ${path}`,
        );
      },
    },
    csp: {
      directives: {
        'connect-src': [
          'self',
          'blob:',
          'http://localhost:*',
          'https://seashell-app-tva2e.ondigitalocean.app',
          'https://icp0.io',
          'https://*.icp0.io',
          'https://icp-api.io',
          'https://ic0.app',
          'https://kongswap.io',
          'https://www.kongswap.i',
          'https://oisy.com',
          'https://beta.oisy.com',
          'https://api.kongswap.io',
          'https://api.coincap.io',
          'https://o4508554870325248.ingest.us.sentry.io',
          'https://www.google-analytics.com',
          'https://*.google-analytics.com',
          'https://cdn.jsdelivr.net',
          'https://api.floppa.ai',
          'wss://api.floppa.ai',
          'https://ic-api.internetcomputer.org',
          'https://*.internetcomputer.org'
        ],
      }
    }
  },
  preprocess: vitePreprocess({
    typescript: true,
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  }),
  onwarn: (warning, handler) => {
    if (warning.code.includes("a11y")) {
      return;
    }
    handler(warning);
  },
};

export default config;
