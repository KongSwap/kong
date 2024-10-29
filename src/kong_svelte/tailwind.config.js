/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}', './node_modules/layerchart/**/*.{svelte,js}'],
  theme: {
    extend: {
      fontFamily: {
        alumni: ['Alumni Sans', "sans-serif"],
      },
      colors: {
        "k-light-blue": "#00A1FA",
      },
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
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
    }
  ]
};
