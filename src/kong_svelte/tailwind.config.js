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
        "k-light-blue": "#0095EB",
        "primary-blue": "#3B82F6",
        kong: {
          "bg-dark": "rgb(var(--bg-dark) / <alpha-value>)",
          "bg-light": "rgb(var(--bg-light) / <alpha-value>)",
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
          "text-accent-green": "#00cba0",
          "text-accent-blue": "#0095EB",
          "text-accent-red": "#ff3b3b",
          border: "rgb(var(--border) / <alpha-value>)",
          "border-light": "rgb(var(--border-light) / <alpha-value>)",
          success: "#18b092",
          error: "#f44336",
          warning: "#f59e0b",
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
      scrollbar: {
        thin: {
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#1a1b23',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#60a5fa',
            borderRadius: '4px',
            border: '2px solid #1a1b23',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: '#3b82f6',
          },
          'scrollbar-width': 'thin',
          'scrollbar-color': '#60a5fa #1a1b23',
        },
      },
      backdropBlur: {
        sm: '4px',
        md: '8px',
      },
      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
      },
      boxShadow: {
        'inner-white': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.05)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s infinite',
        'fadeIn': 'fadeIn 150ms ease-out',
        'slideDown': 'slideDown 150ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
      scale: {
        '98': '0.98',
        '102': '1.02',
      },
      keyframes: {
        shimmer: {
          '100%': {
            transform: 'translateX(100%)',
          },
        },
        fadeIn: {
          'from': {
            opacity: '0'
          },
          'to': {
            opacity: '1'
          }
        },
        slideDown: {
          '0%': {
            opacity: '0',
            transform: 'scaleY(0)'
          },
          '100%': {
            opacity: '1',
            transform: 'scaleY(1)'
          }
        }
      },
    },
  },
  plugins: [
    typography,
    plugin(({ addVariant }) => {
      addVariant('light', ':root:not(.dark) &')
    }),
    plugin(({ addUtilities }) => {
      addUtilities({
        '.scrollbar-custom': {
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#1a1b23',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#60a5fa',
            borderRadius: '4px',
            border: '2px solid #1a1b23',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: '#3b82f6',
          },
          'scrollbar-width': 'thin',
          'scrollbar-color': '#60a5fa #1a1b23',
        },
      })
    }),
  ]
};
