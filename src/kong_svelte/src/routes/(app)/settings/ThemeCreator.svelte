<!-- ThemeCreator.svelte - A component for creating custom themes -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ThemeDefinition } from '$lib/themes/baseTheme';
  import { baseTheme } from '$lib/themes/baseTheme';
  import { themeStore, type ThemeId } from '$lib/stores/themeStore';
  import { getAllThemes } from '$lib/themes/themeRegistry';
  import Slider from '$lib/components/common/Slider.svelte';
  import ColorInput from '$lib/components/common/ColorInput.svelte';

  // Theme ID for the new theme
  let themeId = '';
  let themeName = '';
  let baseThemeId = 'dark';
  
  // Initialize with default values to prevent undefined errors
  let editingTheme: ThemeDefinition = JSON.parse(JSON.stringify(baseTheme));
  themeId = `custom-${Math.floor(Math.random() * 10000)}`;
  themeName = `Custom Theme`;
  editingTheme.id = themeId;
  editingTheme.name = themeName;
  
  let availableThemes: ThemeDefinition[] = [baseTheme];
  let isLoading = true;
  let errorMessage = '';
  let mounted = false;

  onMount(() => {
    try {
      availableThemes = getAllThemes();
      resetThemeEditor();
      isLoading = false;
      mounted = true;
    } catch (error) {
      console.error('Error initializing ThemeCreator:', error);
      errorMessage = 'Failed to initialize theme editor. Please try again.';
      isLoading = false;
    }
  });

  // Function to reset the theme editor with a specific base theme
  function resetThemeEditor() {
    try {
      // Find the selected base theme, defaulting to baseTheme if not found
      const selectedBase = availableThemes.find(t => t.id === baseThemeId) || baseTheme;
      
      // Create a deep copy of the theme to avoid modifying the original
      editingTheme = JSON.parse(JSON.stringify(selectedBase));
      
      // Change the ID and name for the new theme
      themeId = `custom-${Math.floor(Math.random() * 10000)}`;
      themeName = `Custom Theme`;
      
      editingTheme.id = themeId;
      editingTheme.name = themeName;
    } catch (error) {
      console.error('Error resetting theme editor:', error);
      errorMessage = 'Failed to reset theme editor. Please try again.';
    }
  }

  // Handle theme creation
  function createTheme() {
    errorMessage = '';
    
    // Validate the theme ID
    if (!themeId || themeId.trim() === '') {
      errorMessage = 'Theme ID is required';
      return;
    }
    
    // Clean the theme ID (remove spaces, special chars)
    const cleanId = themeId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    editingTheme.id = cleanId;
    
    // Validate the theme name
    if (!themeName || themeName.trim() === '') {
      errorMessage = 'Theme name is required';
      return;
    }
    
    editingTheme.name = themeName;
    
    // Register and apply the new theme
    themeStore.setTheme(editingTheme.id as ThemeId);
    
    // Reset the editor with the newly created theme as the base
    baseThemeId = cleanId;
    resetThemeEditor();
  }
  
  // Handle color input changes for simple color fields
  function updateColor(field: string, value: string) {
    // Navigate the nested property path
    const props = field.split('.');
    let target = editingTheme;
    
    // Navigate to the right property
    for (let i = 0; i < props.length - 1; i++) {
      target = target[props[i]];
    }
    
    // Update the value
    const lastProp = props[props.length - 1];
    target[lastProp] = value;
  }
  
  // Type-safe event handlers
  function handleColorInput(field: string, event: Event) {
    const input = event.target as HTMLInputElement;
    updateColor(field, input.value);
  }
</script>

{#if isLoading}
  <div class="p-4 bg-kong-bg-secondary rounded border border-kong-border">
    <p class="text-kong-text-primary">Loading theme editor...</p>
  </div>
{:else if errorMessage}
  <div class="p-4 bg-kong-bg-secondary rounded border border-kong-border">
    <p class="text-kong-error">{errorMessage}</p>
    <button 
      class="mt-2 px-3 py-1 bg-kong-bg-secondary text-kong-text-primary rounded hover:bg-kong-bg-secondary"
      onclick={() => {
        errorMessage = '';
        resetThemeEditor();
      }}
    >
      Try Again
    </button>
  </div>
{:else}
  <div class="theme-creator p-4">    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <!-- Theme metadata -->
      <div class="space-y-4">
        <div>
          <label for="theme-id" class="block text-sm text-kong-text-secondary mb-1">Theme ID</label>
          <input 
            id="theme-id" 
            bind:value={themeId} 
            placeholder="my-custom-theme" 
            class="w-full px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
          />
        </div>
        
        <div>
          <label for="theme-name" class="block text-sm text-kong-text-secondary mb-1">Theme Name</label>
          <input 
            id="theme-name" 
            bind:value={themeName} 
            placeholder="My Custom Theme" 
            class="w-full px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
          />
        </div>
        
        <div>
          <label for="base-theme" class="block text-sm text-kong-text-secondary mb-1">Base Theme</label>
          <select 
            id="base-theme" 
            bind:value={baseThemeId} 
            onchange={resetThemeEditor}
            class="w-full px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
          >
            {#each availableThemes as theme}
              <option value={theme.id}>{theme.name}</option>
            {/each}
          </select>
        </div>
        
        <div>
          <label for="logo-path" class="block text-sm text-kong-text-secondary mb-1">Custom Logo Path</label>
          <input 
            id="logo-path" 
            type="text" 
            placeholder="/themes/custom-logo.png" 
            bind:value={editingTheme.colors.logoPath} 
            class="w-full px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
          />
          <p class="text-xs text-kong-text-secondary mt-1">Leave empty to use the default logo</p>
        </div>
        
        <!-- Logo appearance customization -->
        <div>
          <label class="block text-sm text-kong-text-secondary mb-1">Logo Inversion</label>
          <select 
            bind:value={editingTheme.colors.logoInvert} 
            class="w-full px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
          >
            <option value={0}>No Inversion</option>
            <option value={1}>Invert Colors</option>
          </select>
          <p class="text-xs text-kong-text-secondary mt-1">Controls whether the logo is color-inverted</p>
        </div>
        
        <div>
          <label class="block text-sm text-kong-text-secondary mb-1">Logo Brightness</label>
          <div class="flex gap-2 items-center">
            <Slider 
              bind:value={editingTheme.colors.logoBrightness} 
              min={0.1} 
              max={1.5} 
              step={0.05} 
              color={editingTheme.colors.primary}
              showInput={true}
            />
          </div>
        </div>
      </div>
      
      <!-- Primary colors -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-kong-text-primary">Primary Colors</h3>
        
        <div class="space-y-6">
          <ColorInput
            label="Primary Background"
            value={editingTheme.colors.bgPrimary}
            on:input={(e) => handleColorInput('colors.bgPrimary', e)}
          >
            <input
              type="text"
              placeholder="#090c17"
              value={editingTheme.colors.bgPrimary}
              oninput={(e) => handleColorInput('colors.bgPrimary', e)}
              class="w-32 px-3 py-2 bg-kong-bg-secondary/50 border border-kong-border rounded-lg text-kong-text-primary placeholder-kong-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-kong-primary focus:border-transparent"
            />
          </ColorInput>
          
          <ColorInput
            label="Secondary Background"
            value={editingTheme.colors.bgSecondary}
            on:input={(e) => handleColorInput('colors.bgSecondary', e)}
          >
            <input
              type="text"
              placeholder="#1a2032"
              value={editingTheme.colors.bgSecondary}
              oninput={(e) => handleColorInput('colors.bgSecondary', e)}
              class="w-32 px-3 py-2 bg-kong-bg-secondary/50 border border-kong-border rounded-lg text-kong-text-primary placeholder-kong-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-kong-primary focus:border-transparent"
            />
          </ColorInput>
          
          <div>
            <label for="primary" class="block text-sm text-kong-text-secondary mb-1">Primary</label>
            <div class="flex">
              <input 
                id="primary" 
                type="color" 
                value={editingTheme.colors.primary} 
                oninput={(e) => handleColorInput('colors.primary', e)}
                class="w-10 h-10 rounded mr-2 p-0 border-0"
              />
              <input 
                type="text" 
                value={editingTheme.colors.primary}
                oninput={(e) => handleColorInput('colors.primary', e)}
                class="flex-1 px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
              />
            </div>
          </div>
          
          <div>
            <label for="text-primary" class="block text-sm text-kong-text-secondary mb-1">Text Primary</label>
            <div class="flex">
              <input 
                id="text-primary" 
                type="color" 
                value={editingTheme.colors.textPrimary} 
                oninput={(e) => handleColorInput('colors.textPrimary', e)}
                class="w-10 h-10 rounded mr-2 p-0 border-0"
              />
              <input 
                type="text" 
                value={editingTheme.colors.textPrimary}
                oninput={(e) => handleColorInput('colors.textPrimary', e)}
                class="flex-1 px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Token Selector Dropdown Colors -->
    <div class="mt-6">
      <h3 class="text-lg font-semibold text-kong-text-primary mb-3">Token Selector Dropdown</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">      
        <div>
          <label for="token-selector-roundness" class="block text-sm text-kong-text-secondary mb-1">Roundness</label>
          <select 
            id="token-selector-roundness" 
            bind:value={editingTheme.colors.panelRoundness} 
            class="w-full px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
          >
            <option value="rounded-none">None</option>
            <option value="rounded-sm">Small</option>
            <option value="rounded">Normal</option>
            <option value="rounded-md">Medium</option>
            <option value="rounded-lg">Large</option>
            <option value="rounded-xl">Extra Large</option>
            <option value="rounded-2xl">2XL</option>
            <option value="rounded-3xl">3XL</option>
            <option value="rounded-full">Full</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Token Ticker Styling -->
    <div class="mt-6">
      <h3 class="text-lg font-semibold text-kong-text-primary mb-3">Token Ticker Styling</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="token-ticker-bg" class="block text-sm text-kong-text-secondary mb-1">Background</label>
          <div class="flex">
            <input 
              id="token-ticker-bg" 
              type="color" 
              value={editingTheme.colors.tokenTickerBg || '#111523'} 
              oninput={(e) => handleColorInput('colors.tokenTickerBg', e)}
              class="w-10 h-10 rounded mr-2 p-0 border-0"
            />
            <input 
              type="text" 
              value={editingTheme.colors.tokenTickerBg || '#111523'}
              oninput={(e) => handleColorInput('colors.tokenTickerBg', e)}
              class="flex-1 px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
            />
          </div>
        </div>
        
        <div>
          <label for="token-ticker-text" class="block text-sm text-kong-text-secondary mb-1">Text Color</label>
          <div class="flex">
            <input 
              id="token-ticker-text" 
              type="color" 
              value={editingTheme.colors.tokenTickerText || '#FFFFFF'} 
              oninput={(e) => handleColorInput('colors.tokenTickerText', e)}
              class="w-10 h-10 rounded mr-2 p-0 border-0"
            />
            <input 
              type="text" 
              value={editingTheme.colors.tokenTickerText || '#FFFFFF'}
              oninput={(e) => handleColorInput('colors.tokenTickerText', e)}
              class="flex-1 px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
            />
          </div>
        </div>
        
        <div>
          <label for="token-ticker-up-color" class="block text-sm text-kong-text-secondary mb-1">Up Color</label>
          <div class="flex">
            <input 
              id="token-ticker-up-color" 
              type="color" 
              value={editingTheme.colors.tokenTickerUpColor || '#05EC86'} 
              oninput={(e) => handleColorInput('colors.tokenTickerUpColor', e)}
              class="w-10 h-10 rounded mr-2 p-0 border-0"
            />
            <input 
              type="text" 
              value={editingTheme.colors.tokenTickerUpColor || '#05EC86'}
              oninput={(e) => handleColorInput('colors.tokenTickerUpColor', e)}
              class="flex-1 px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
            />
          </div>
        </div>
        
        <div>
          <label for="token-ticker-down-color" class="block text-sm text-kong-text-secondary mb-1">Down Color</label>
          <div class="flex">
            <input 
              id="token-ticker-down-color" 
              type="color" 
              value={editingTheme.colors.tokenTickerDownColor || '#FF4545'} 
              oninput={(e) => handleColorInput('colors.tokenTickerDownColor', e)}
              class="w-10 h-10 rounded mr-2 p-0 border-0"
            />
            <input 
              type="text" 
              value={editingTheme.colors.tokenTickerDownColor || '#FF4545'}
              oninput={(e) => handleColorInput('colors.tokenTickerDownColor', e)}
              class="flex-1 px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
            />
          </div>
        </div>
        
        <div>
          <label for="token-ticker-border" class="block text-sm text-kong-text-secondary mb-1">Border</label>
          <input 
            id="token-ticker-border" 
            type="text" 
            value={editingTheme.colors.tokenTickerBorder || '1px solid rgba(255, 255, 255, 0.1)'} 
            oninput={(e) => handleColorInput('colors.tokenTickerBorder', e)}
            class="w-full px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
          />
        </div>
        
        <div>
          <label for="token-ticker-border-style" class="block text-sm text-kong-text-secondary mb-1">Border Style</label>
          <select 
            id="token-ticker-border-style" 
            bind:value={editingTheme.colors.tokenTickerBorderStyle} 
            class="w-full px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
          >
            <option value="default">Default</option>
            <option value="win95">Windows 95</option>
            <option value="none">None</option>
          </select>
          <p class="text-xs text-kong-text-secondary mt-1">Windows 95 style gives that classic 3D button look</p>
        </div>
        
        <div>
          <label for="token-ticker-hover-bg" class="block text-sm text-kong-text-secondary mb-1">Hover Background</label>
          <div class="flex">
            <input 
              id="token-ticker-hover-bg" 
              type="color" 
              value={editingTheme.colors.tokenTickerHoverBg || '#232735'} 
              oninput={(e) => handleColorInput('colors.tokenTickerHoverBg', e)}
              class="w-10 h-10 rounded mr-2 p-0 border-0"
            />
            <input 
              type="text" 
              value={editingTheme.colors.tokenTickerHoverBg || '#232735'}
              oninput={(e) => handleColorInput('colors.tokenTickerHoverBg', e)}
              class="flex-1 px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
            />
          </div>
        </div>
        
        <div>
          <label for="token-ticker-roundness" class="block text-sm text-kong-text-secondary mb-1">Roundness</label>
          <select 
            id="token-ticker-roundness" 
            bind:value={editingTheme.colors.tokenTickerRoundness} 
            class="w-full px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:border-kong-primary"
          >
            <option value="rounded-none">None</option>
            <option value="rounded-sm">Small</option>
            <option value="rounded">Normal</option>
            <option value="rounded-md">Medium</option>
            <option value="rounded-lg">Large</option>
            <option value="rounded-xl">Extra Large</option>
            <option value="rounded-2xl">2XL</option>
            <option value="rounded-3xl">3XL</option>
            <option value="rounded-full">Full</option>
          </select>
        </div>
        
        <div>
          <label for="token-ticker-bg-opacity" class="block text-sm text-kong-text-secondary mb-1">Background Opacity (%)</label>
          <div class="flex gap-2 items-center">
            <Slider 
              bind:value={editingTheme.colors.tokenTickerBgOpacity} 
              min={0} 
              max={100} 
              step={5} 
              color={editingTheme.colors.primary}
              showInput={true}
            />
          </div>
          <p class="text-xs text-kong-text-secondary mt-1">Set to 100% for a solid background</p>
        </div>
      </div>
    </div>

    <div class="flex justify-between mt-6">
      <button 
        onclick={resetThemeEditor} 
        class="px-4 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded hover:bg-kong-bg-secondary transition-colors"
      >
        Reset
      </button>
      
      <button 
        onclick={createTheme} 
        class="px-4 py-2 bg-kong-primary text-white rounded hover:bg-kong-primary-hover transition-colors"
      >
        Create & Apply Theme
      </button>
    </div>
  </div>
{/if}

<style>
  input[type="color"] {
    -webkit-appearance: none;
    padding: 0;
    border: none;
    border-radius: 4px;
    width: 40px;
    height: 40px;
  }
  
  input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  
  input[type="color"]::-webkit-color-swatch {
    border: none;
    border-radius: 4px;
  }
</style> 