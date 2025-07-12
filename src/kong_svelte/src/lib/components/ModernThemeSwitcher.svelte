<script lang="ts">
  import { modernThemeStore } from '../themes/modernThemeRegistry';
  import { onMount } from 'svelte';
  
  let currentTheme = $state('modern-dark');
  let availableThemes = $state<any[]>([]);
  
  onMount(() => {
    // Get available themes
    availableThemes = modernThemeStore.getAllThemes();
    
    // Subscribe to theme changes
    modernThemeStore.subscribe((themeId) => {
      currentTheme = themeId;
    });
  });
  
  async function switchTheme(themeId: string) {
    await modernThemeStore.setTheme(themeId);
  }
  
  async function toggleTheme() {
    await modernThemeStore.toggleTheme();
  }
</script>

<div class="modern-theme-switcher modern-bg-secondary modern-border-default border rounded-lg p-4">
  <h3 class="modern-text-primary font-medium mb-3">Modern Theme Switcher</h3>
  
  <!-- Quick toggle button -->
  <button
    onclick={toggleTheme}
    class="modern-brand-primary hover:opacity-90 px-4 py-2 rounded-md transition-opacity mb-4 w-full"
  >
    Toggle Theme
  </button>
  
  <!-- Theme selection -->
  <div class="space-y-2">
    {#each availableThemes as theme}
      <button
        onclick={() => switchTheme(theme.id)}
        class="w-full text-left p-3 rounded-md transition-colors"
        class:modern-bg-elevated={currentTheme === theme.id}
        class:modern-bg-primary={currentTheme !== theme.id}
        class:modern-border-default={currentTheme === theme.id}
        class:border={currentTheme === theme.id}
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="modern-text-primary font-medium">{theme.name}</div>
            <div class="modern-text-secondary text-sm">{theme.colorScheme} theme</div>
          </div>
          
          <!-- Color preview -->
          <div class="flex space-x-1">
            <div 
              class="w-3 h-3 rounded-full" 
              style="background-color: {theme.colors.brand.primary}"
            ></div>
            <div 
              class="w-3 h-3 rounded-full" 
              style="background-color: {theme.colors.semantic.success}"
            ></div>
            <div 
              class="w-3 h-3 rounded-full" 
              style="background-color: {theme.colors.semantic.error}"
            ></div>
          </div>
        </div>
      </button>
    {/each}
  </div>
  
  <!-- Performance info -->
  <div class="mt-4 pt-4 border-t modern-border-subtle">
    <div class="modern-text-secondary text-xs">
      Modern theme architecture: 15 properties vs 147+ in legacy system
    </div>
  </div>
</div>

<style>
  .modern-theme-switcher {
    max-width: 300px;
  }
</style>