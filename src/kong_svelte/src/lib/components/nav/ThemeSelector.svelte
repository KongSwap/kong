<script lang="ts">
  import { themeStore } from "$lib/stores/themeStore";
  import { browser } from "$app/environment";
  
  let currentTheme = $state('dark');
  
  // Initialize current theme
  $effect(() => {
    if (browser) {
      currentTheme = localStorage.getItem('kongTheme') || 'dark';
    }
  });
  
  // Theme options
  const themes = [
    { id: 'light', name: 'Light Mode', icon: '☀️' },
    { id: 'dark', name: 'Dark Mode', icon: '🌙' },
    { id: 'plain-black', name: 'Plain Black', icon: '⬛' }
  ];
  
  // Handle theme selection
  function selectTheme(themeId) {
    themeStore.setTheme(themeId);
    currentTheme = themeId;
  }
</script>

<div class="theme-selector">
  <div class="dropdown">
    <button class="dropdown-trigger">
      <span class="icon">{themes.find(t => t.id === currentTheme)?.icon || '🌙'}</span>
    </button>
    
    <div class="dropdown-menu">
      <div class="dropdown-content">
        {#each themes as theme}
          <button 
            class="theme-option" 
            class:active={currentTheme === theme.id}
            on:click={() => selectTheme(theme.id)}
          >
            <span class="theme-icon">{theme.icon}</span>
            <span class="theme-name">{theme.name}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  .theme-selector {
    position: relative;
    display: inline-block;
  }
  
  .dropdown {
    position: relative;
  }
  
  .dropdown-trigger {
    @apply p-2 rounded-full hover:bg-opacity-20 transition-colors duration-150;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
  }
  
  :global(:root.dark) .dropdown-trigger:hover,
  :global(:root.plain-black) .dropdown-trigger:hover {
    @apply hover:bg-white hover:bg-opacity-10;
  }
  
  :global(:root:not(.dark):not(.plain-black)) .dropdown-trigger:hover {
    @apply hover:bg-black hover:bg-opacity-10;
  }
  
  .icon {
    font-size: 1.25rem;
  }
  
  .dropdown-menu {
    position: absolute;
    right: 0;
    top: 100%;
    margin-top: 0.5rem;
    min-width: 12rem;
    @apply bg-white dark:bg-gray-800 plain-black:bg-black;
    @apply shadow-lg rounded-lg overflow-hidden;
    @apply border border-gray-200 dark:border-gray-700 plain-black:border-gray-900;
    display: none;
    z-index: 20;
  }
  
  .dropdown:hover .dropdown-menu,
  .dropdown:focus-within .dropdown-menu {
    display: block;
  }
  
  .dropdown-content {
    @apply py-1;
  }
  
  .theme-option {
    @apply flex items-center w-full px-4 py-2 text-left;
    @apply text-gray-800 dark:text-gray-200 plain-black:text-gray-200;
    @apply hover:bg-gray-100 dark:hover:bg-gray-700 plain-black:hover:bg-gray-900;
    @apply transition-colors duration-150;
    background: transparent;
    border: none;
    cursor: pointer;
  }
  
  .theme-option.active {
    @apply bg-gray-100 dark:bg-gray-700 plain-black:bg-gray-900;
  }
  
  .theme-icon {
    @apply mr-3;
  }
  
  .theme-name {
    @apply font-medium;
  }
</style> 