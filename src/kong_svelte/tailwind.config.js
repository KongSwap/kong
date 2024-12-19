/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  content: [
    "./src/**/*.{html,js,svelte,ts}",
    "./node_modules/layerchart/**/*.{svelte,js}",
  ],
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
          "bg-dark": "#0B0E17",
          primary: "#3B82F6",
          "primary-hover": "#3D5BF9",
          secondary: "#22D3EE", // Teal for vibrancy
          "secondary-hover": "#0EA5E9", // Darker teal hover
          "accent-blue": "#00A1FA",
          "accent-red": "#D34545",
          "accent-green": "rgb(0 160 125)",
          "accent-green-hover": "rgb(0 185 145)",
          "accent-blue-hover": "#00A1FA",
          "accent-red-hover": "rgb(175 48 48)",
          "text-primary": "#FFFFFF",
          "text-secondary": "#9BA1B0",
          "text-disabled": "#6B7280",
          "text-accent-green": "#00d3a5",
          "text-accent-blue": "#00A1FA",
          "text-accent-red": "#FF4B4B", 
          border: "#2A2F3D",
          "border-light": "#374151",
          success: "#1FC7A4",
          error: "#EF4444",
          warning: "#F59E0B",
        },
      },
    },
  },
  plugins: [typography],
};
