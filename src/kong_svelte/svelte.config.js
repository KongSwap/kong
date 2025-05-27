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
      strict: true,
    }),
    files: {
      assets: "static",
    },
    alias: {
      $lib: "src/lib",
      "$lib/*": "src/lib/*",
    },
    prerender: {
      origin: 'https://dev.kongswap.io',
      entries: [
        '*',
        // Add specific dynamic routes here if you want them prerendered
        // '/predict/some-specific-id',
        // '/stats/some-specific-id',
        // '/wallets/some-principal-id',
      ],
      handleHttpError: ({ path, referrer, message }) => {
        // Ignore specific paths that require client-side rendering
        if (
          path === "/" ||
          path === "/swap" ||
          path === "/pools" ||
          path === "/stats" ||
          path === "/predict" ||
          path.startsWith("/predict/") ||
          path === "/settings" ||
          path.startsWith("/stats/") ||
          path.startsWith("/wallets/")
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