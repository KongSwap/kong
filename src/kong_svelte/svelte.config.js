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
      fallback: "404.html",
      precompress: false,
      strict: false,
    }),
    files: {
      assets: "static",
    },
    alias: {
      $lib: "src/lib",
      "$lib/*": "src/lib/*",
    },
    prerender: {
      handleHttpError: ({ path, referrer, message }) => {
        // Ignore specific paths that require client-side rendering
        if (
          path === "/" ||
          path === "/swap" ||
          path === "/pools" ||
          path.startsWith("/pools/") ||
          path === "/stats" ||
          path === "/predict" ||
          path.startsWith("/wallets/") ||
          path.includes("[") // Ignore all dynamic routes
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