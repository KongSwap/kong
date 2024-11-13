import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      pages: "dist",
      assets: "dist",
      fallback: undefined,
      precompress: true,
      strict: true,
    }),
    files: {
      assets: "static",
    },
    alias: {
      $lib: 'src/lib',
      "$lib/*": 'src/lib/*',
    },
  },
  preprocess: vitePreprocess({
    typescript: true,
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  }),
  onwarn: (warning, handler) => {    
    if (warning.code.startsWith('a11y_')) {
      return;
    }
    handler(warning);
  },
};

export default config;