/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        'text-green': 'var(--text-green)',
        'bg-dark': 'var(--bg-dark)',
        'card-bg': 'var(--card-bg)',
        'primary-green': 'var(--primary-green)',
        'secondary-green': 'var(--secondary-green)',
        'error-color': 'var(--error-color)',
        'warning-color': 'var(--warning-color)',
        'info-color': 'var(--info-color)',
        'success-color': 'var(--success-color)'
      }
    },
  },
  plugins: [],
}

