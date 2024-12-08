/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}', './node_modules/layerchart/**/*.{svelte,js}'],
  theme: {
    extend: {
      fontFamily: {
        alumni: ['Space Grotesk', "sans-serif"],
        play: ["Press Start 2P", "monospace"]
      },
      colors: {
        "k-light-blue": "#00A1FA",
      },
      scale: {
        '80': '0.8', // Define a custom scale value
      },
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
    function({ addUtilities }) {
      const outlineThicknesses = [1, 2, 3, 4, 5]; // Define the thicknesses you want
      const newUtilities = outlineThicknesses.reduce((acc, thickness) => {
        acc[`.text-outline-${thickness}`] = {
          'text-shadow': `
            -${thickness}px -${thickness}px 0 #000,  
             ${thickness}px -${thickness}px 0 #000,
            -${thickness}px  ${thickness}px 0 #000,
             ${thickness}px  ${thickness}px 0 #000
          `,
        };
        return acc;
      }, {});
      addUtilities(newUtilities, ['responsive', 'hover']);
    },
    function({ addComponents }) {
      addComponents({
        '.primary-button': {
          '@apply px-3 sm:px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:bg-blue-600 w-full sm:w-auto': {}
        }
      });
    }
  ]
};
