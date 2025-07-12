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
      ringColor: {
        DEFAULT: 'rgb(var(--ui-focus) / 0.2)',
      },
      ringOffsetColor: {
        DEFAULT: 'rgb(var(--bg-primary))',
      },
      ringWidth: {
        DEFAULT: '2px',
      },
      ringOpacity: {
        DEFAULT: '0.2',
      },
      ring: {
        DEFAULT: '2px rgb(var(--ui-focus) / 0.2)',
      },
      colors: {
        "k-light-blue": "#0095EB",
        "primary-blue": "#3B82F6",
        kong: {
          // Background colors
          "bg-primary": "rgb(var(--bg-primary) / <alpha-value>)",
          "bg-secondary": "rgb(var(--bg-secondary) / <alpha-value>)",
          "bg-tertiary": "rgb(var(--bg-tertiary) / <alpha-value>)",
          
          // Text colors
          "text-primary": "rgb(var(--text-primary) / <alpha-value>)",
          "text-secondary": "rgb(var(--text-secondary) / <alpha-value>)",
          "text-success": "rgb(var(--text-success) / <alpha-value>)",
          "text-error": "rgb(var(--text-error) / <alpha-value>)",
          "text-warning": "rgb(var(--text-warning) / <alpha-value>)",
          "text-info": "rgb(var(--text-info) / <alpha-value>)",
          "text-muted": "rgb(var(--text-muted) / <alpha-value>)",
          "text-disabled": "rgb(var(--text-disabled) / <alpha-value>)",
          "text-inverse": "rgb(var(--text-inverse) / <alpha-value>)",
          "text-on-primary": "rgb(var(--text-on-primary) / <alpha-value>)",
          
          // Brand colors
          primary: "rgb(var(--brand-primary) / <alpha-value>)",
          secondary: "rgb(var(--brand-secondary) / <alpha-value>)",
          
          // Semantic colors
          success: "rgb(var(--semantic-success) / <alpha-value>)",
          error: "rgb(var(--semantic-error) / <alpha-value>)",
          warning: "rgb(var(--semantic-warning) / <alpha-value>)",
          info: "rgb(var(--semantic-info) / <alpha-value>)",
          
          // Semantic color hover variants
          "success-hover": "rgb(var(--semantic-success-hover) / <alpha-value>)",
          "error-hover": "rgb(var(--semantic-error-hover) / <alpha-value>)",
          "warning-hover": "rgb(var(--semantic-warning-hover) / <alpha-value>)",
          "info-hover": "rgb(var(--semantic-info-hover) / <alpha-value>)",
          
          // UI colors
          border: "rgb(var(--ui-border) / <alpha-value>)",
          "border-light": "rgb(var(--ui-border-light) / <alpha-value>)",
          focus: "rgb(var(--ui-focus) / <alpha-value>)",
          hover: "rgb(var(--ui-hover) / <alpha-value>)",
          
          // Legacy aliases for backwards compatibility
          "bg-dark": "rgb(var(--bg-primary) / <alpha-value>)",
          "bg-light": "rgb(var(--bg-secondary) / <alpha-value>)",
          "primary-hover": "rgb(var(--brand-primary) / <alpha-value>)",
          "secondary-hover": "rgb(var(--brand-secondary) / <alpha-value>)",
          "accent-blue": "rgb(var(--semantic-info) / <alpha-value>)",
          "accent-red": "rgb(var(--semantic-error) / <alpha-value>)",
          "accent-green": "rgb(var(--semantic-success) / <alpha-value>)",
          "accent-yellow": "rgb(var(--semantic-warning) / <alpha-value>)",

          
          // Legacy hover aliases for backwards compatibility
          "accent-green-hover": "rgb(var(--semantic-success-hover) / <alpha-value>)",
          "accent-red-hover": "rgb(var(--semantic-error-hover) / <alpha-value>)",
          "accent-blue-hover": "rgb(var(--semantic-info-hover) / <alpha-value>)",
          "accent-yellow-hover": "rgb(var(--semantic-warning-hover) / <alpha-value>)",

          // Toast notification colors
          "toast-bg": "var(--toast-bg)",
          "toast-success-border": "var(--toast-success-border)",
          "toast-error-border": "var(--toast-error-border)",
          "toast-warning-border": "var(--toast-warning-border)",
          "toast-info-border": "var(--toast-info-border)",
          "toast-success-gradient": "var(--toast-success-gradient)",
          "toast-error-gradient": "var(--toast-error-gradient)",
          "toast-warning-gradient": "var(--toast-warning-gradient)",
          "toast-info-gradient": "var(--toast-info-gradient)",
          "toast-shadow": "var(--toast-shadow)",
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
        "in": "in 0.2s ease-out",
        "out": "out 0.2s ease-in",
        "fade-in": "fade-in 200ms ease-out",
        "fade-out": "fade-out 200ms ease-in",
        "slide-in-from-top": "slide-in-from-top 200ms ease-out",
        "slide-out-to-top": "slide-out-to-top 200ms ease-in",
        "zoom-in": "zoom-in 200ms ease-out",
        "zoom-out": "zoom-out 200ms ease-in",
        'shine': 'shine 2s infinite linear',
        'glow': 'glow 2s ease-in-out infinite',
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
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "slide-in-from-top": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-out-to-top": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-100%)" },
        },
        "zoom-in": {
          "0%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)" },
        },
        "zoom-out": {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(0.95)" },
        },
        shine: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(50%)' }
        },
        glow: {
          '0%': { 
            filter: 'drop-shadow(0 0 2px rgb(var(--brand-primary) / 0.5)) brightness(0.95)', 
            opacity: '0.8',
            transform: 'scale(0.98)'
          },
          '50%': { 
            filter: 'drop-shadow(0 0 5px rgb(var(--brand-primary) / 0.9)) brightness(1.1)', 
            opacity: '1',
            transform: 'scale(1.02)'
          },
          '100%': { 
            filter: 'drop-shadow(0 0 2px rgb(var(--brand-primary) / 0.5)) brightness(0.95)', 
            opacity: '0.8',
            transform: 'scale(0.98)'
          }
        },
      },
      borderRadius: {
        DEFAULT: '4px',
        'swap-button-roundness': 'var(--swap-button-roundness, 90rem)',
        'kong-roundness': 'var(--panel-roundness, 0.5rem)',
      },
    },
  },
  plugins: [
    typography,
    plugin(({ addVariant }) => {
      addVariant('light', ':root:not(.dark):not(.plain-black) &')
    }),
    plugin(({ addVariant }) => {
      addVariant('plain-black', ':root.plain-black &')
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
