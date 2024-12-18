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
          // Main background colors
          "bg-dark": "#0B0E17", // Dark background
          "bg-card": "#151926", // Card/container background

          // Primary colors
          primary: "#3B82F6", // Primary button color
          "primary-hover": "#3D5BF9",

          // Accent colors
          "accent-blue": "#00A1FA", // Light blue accents
          "accent-red": "#FF4B4B",  // Added red accent
          "accent-green": "#00d3a5", // Token color (KONG)

          // Text colors
          "text-primary": "#FFFFFF",
          "text-secondary": "#9BA1B0",
          "text-disabled": "#6B7280",

          // Border colors
          border: "#2A2F3D",
          "border-light": "#374151",

          // Status colors
          success: "#1FC7A4",
          error: "#EF4444",
          warning: "#F59E0B",
        },
      },
      scale: {
        80: "0.8", // Define a custom scale value
      },
      keyframes: {
        'price-flash-green': {
          '0%': { color: '#FFFFFF' },
          '30%': { color: '#00d3a5' },
          '100%': { color: '#FFFFFF' },
        },
        'price-flash-red': {
          '0%': { color: '#FFFFFF' },
          '30%': { color: '#FF4B4B' },
          '100%': { color: '#FFFFFF' },
        },
        'number-up': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '50%': { transform: 'translateY(-20px)', opacity: '0' },
          '51%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'number-down': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '50%': { transform: 'translateY(20px)', opacity: '0' },
          '51%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
      animation: {
        'price-flash-green': 'price-flash-green 1s ease-out forwards',
        'price-flash-red': 'price-flash-red 1s ease-out forwards',
        'number-up': 'number-up 0.4s ease-in-out',
        'number-down': 'number-down 0.4s ease-in-out'
      },
    },
  },
  plugins: [
    typography,
    /** @param {{ addUtilities: (utilities: Record<string, any>, config: object) => void }} param0 */
    function ({ addUtilities }) {
      /** @type {Record<string, { 'text-shadow': string }>} */
      const newUtilities = {};
      
      const outlineThicknesses = [1, 2, 3, 4, 5];
      outlineThicknesses.forEach(thickness => {
        newUtilities[`.text-outline-${thickness}`] = {
          "text-shadow": `
            -${thickness}px -${thickness}px 0 #000,  
             ${thickness}px -${thickness}px 0 #000,
            -${thickness}px  ${thickness}px 0 #000,
             ${thickness}px  ${thickness}px 0 #000
          `,
        };
      });
      
      addUtilities(newUtilities, {
        respectPrefix: true,
        respectImportant: true,
      });
    },
    /** @param {{ addComponents: (components: Record<string, any>) => void }} param0 */
    function ({ addComponents }) {
      addComponents({
        ".primary-button": {
          "@apply px-3 sm:px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:bg-blue-600 w-full sm:w-auto":
            {},
        },
      });
    },
  ],
};
