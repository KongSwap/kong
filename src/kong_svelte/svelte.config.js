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
    // suppress warnings on `vite dev` and `vite build`
    if (warning.code === "a11y-click-events-have-key-events") return;
    if (warning.code === "a11y-no-static-element-interactions") return;
    if (warning.code === "a11y-missing-attribute") return;
    if (warning.code === "a11y-no-noninteractive-element-interactions") return;
    if (warning.code === "a11y-no-noninteractive-element-to-interactive-role") return;
    if (warning.code === "a11y-consider-explicit-label") return;

    handler(warning);
  },
};

export default config;