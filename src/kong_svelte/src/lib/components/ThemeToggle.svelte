<script lang="ts">
  import { onMount } from 'svelte';
  import { setTheme, getThemePreference, type ThemeOption } from '$lib/utils/theme';

  // Current theme state
  let currentTheme: ThemeOption = 'auto';
  
  // Theme options with their display names and icons
  const themeOptions: Array<{value: ThemeOption, label: string, icon: string}> = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'plain-black', label: 'Plain Black', icon: '⬛' },
    { value: 'auto', label: 'Auto', icon: '🔄' }
  ];
  
  // Initialize on mount
  onMount(() => {
    currentTheme = getThemePreference();
  });
  
  // Handle theme change
  function handleThemeChange(newTheme: ThemeOption) {
    currentTheme = newTheme;
    setTheme(newTheme);
  }
</script>

<div class="theme-toggle">
  <div class="dropdown">
    <button class="dropdown-toggle">
      {themeOptions.find(t => t.value === currentTheme)?.icon || '🔄'} 
      <span class="sr-only">Toggle theme</span>
    </button>
    <div class="dropdown-menu">
      {#each themeOptions as option}
        <button 
          class="theme-option"
          class:active={currentTheme === option.value}
          on:click={() => handleThemeChange(option.value)}
        >
          <span class="icon">{option.icon}</span>
          <span class="label">{option.label}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style lang="postcss">
  .theme-toggle {
    position: relative;
  }
  
  .dropdown {
    position: relative;
    display: inline-block;
  }
  
  .dropdown-toggle {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    padding: 0.5rem;
    border-radius: 0.25rem;
    transition: background-color 0.2s ease;
  }
  
  .dropdown-toggle:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
  
  :global(:root.dark) .dropdown-toggle:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
  
  .dropdown-menu {
    position: absolute;
    right: 0;
    top: 100%;
    z-index: 50;
    min-width: 10rem;
    padding: 0.5rem;
    margin-top: 0.25rem;
    border-radius: 0.375rem;
    background-color: white;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);
    transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
  }
  
  .dropdown:hover .dropdown-menu,
  .dropdown:focus-within .dropdown-menu {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }
  
  :global(:root.dark) .dropdown-menu {
    background-color: #1e293b;
    color: white;
  }
  
  :global(:root.plain-black) .dropdown-menu {
    background-color: #121212;
    color: white;
  }
  
  .theme-option {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.5rem;
    border: none;
    background: transparent;
    border-radius: 0.25rem;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.2s ease;
  }
  
  .theme-option:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  :global(:root.dark) .theme-option:hover,
  :global(:root.plain-black) .theme-option:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .theme-option.active {
    background-color: rgba(0, 0, 0, 0.1);
  }
  
  :global(:root.dark) .theme-option.active,
  :global(:root.plain-black) .theme-option.active {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .icon {
    margin-right: 0.5rem;
  }
</style> 