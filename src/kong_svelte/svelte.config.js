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
    // CSP disabled for development to avoid blocking IC canister requests
    // Will be re-enabled with proper configuration for production
    // csp: {
    //   mode: 'hash',
    //   directives: {
    //     'connect-src': ['*'],
    //   }
    // },
    files: {
      assets: "static",
    },
    alias: {
      $lib: "src/lib",
      "$lib/*": "src/lib/*",
    },
    prerender: {
      origin: 'https://kongswap.io',
      handleHttpError: ({ path, referrer, message }) => {
        // Ignore specific paths that require client-side rendering
        if (
          path === "/swap" ||
          path === "/pools" ||
          path === "/stats" ||
          path === "/predict"
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