module.exports = {
  extends: [
    // other configurations
  ],
  plugins: ['svelte3'],
  overrides: [
    {
      files: ['**/*.svelte'],
      processor: 'svelte3/svelte3'
    }
  ],
  settings: {
    'svelte3/ignore-styles': () => true // Ignore style tags
  }
};