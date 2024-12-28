/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';
import plugin from 'tailwindcss/plugin';

export default {
  content: [
    "./src/**/*.{html,js,svelte,ts}",
    "./node_modules/layerchart/**/*.{svelte,js}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        alumni: ["Space Grotesk", "sans-serif"],
        play: ["Press Start 2P", "monospace"],
      },
      colors: {
        "k-light-blue": "#00A1FA",
        "primary-blue": "#3B82F6",
        kong: {
          "bg-dark": "rgb(var(--bg-dark) / <alpha-value>)",
          primary: "rgb(var(--primary) / <alpha-value>)",
          "primary-hover": "rgb(var(--primary-hover) / <alpha-value>)",
          secondary: "rgb(var(--secondary) / <alpha-value>)",
          "secondary-hover": "rgb(var(--secondary-hover) / <alpha-value>)",
          "accent-blue": "rgb(var(--accent-blue) / <alpha-value>)",
          "accent-red": "rgb(var(--accent-red) / <alpha-value>)",
          "accent-green": "rgb(var(--accent-green) / <alpha-value>)",
          "accent-green-hover": "rgb(var(--accent-green-hover) / <alpha-value>)",
          "accent-blue-hover": "rgb(var(--accent-blue-hover) / <alpha-value>)",
          "accent-red-hover": "rgb(var(--accent-red-hover) / <alpha-value>)",
          "text-primary": "rgb(var(--text-primary) / <alpha-value>)",
          "text-secondary": "rgb(var(--text-secondary) / <alpha-value>)",
          "text-disabled": "rgb(var(--text-disabled) / <alpha-value>)",
          "text-accent-green": "#00d3a5",
          "text-accent-blue": "#00A1FA",
          "text-accent-red": "#FF4B4B",
          border: "rgb(var(--border) / <alpha-value>)",
          "border-light": "rgb(var(--border-light) / <alpha-value>)",
          success: "#1FC7A4",
          error: "#EF4444",
          warning: "#F59E0B",
          sky: {
            light: "#B3D9FF",
            lighter: "#F0F8FF",
          },
          text: {
            primary: "rgb(var(--text-primary) / <alpha-value>)",
            secondary: "rgb(var(--text-secondary) / <alpha-value>)",
            disabled: "rgb(var(--text-disabled) / <alpha-value>)",
          },
        },
      },
    },
  },
  plugins: [
    typography,
    plugin(({ addVariant }) => {
      addVariant('light', ':root:not(.dark) &')
    })
  ]
};
