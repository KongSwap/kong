import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      out: 'dist',
      precompress: false,
      envPrefix: '',
      env: {
        host: 'HOST',
        port: 'PORT'
      }
    }),
    files: {
      assets: "static",
    },
    alias: {
      $lib: "src/lib",
      "$lib/*": "src/lib/*",
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