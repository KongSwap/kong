/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      fontFamily: {
        alumni: ['Alumni Sans', "sans-serif"],
      },
      colors: {
        kong: {
          green: '#10B981',
          yellow: '#FCD34D',
          red: '#EF4444',
          black: '#000000',
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms')
  ]
};
