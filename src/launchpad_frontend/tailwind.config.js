/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,js,svelte,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'kong-bg-dark': '#0A0A0F',
        'kong-border': '#2A2A3F',
        'kong-text': {
          primary: '#E2E8F0',
          secondary: '#94A3B8'
        }
      }
    },
  },
  plugins: [],
}
