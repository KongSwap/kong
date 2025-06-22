<!-- ColorInput.svelte - A reusable color input component -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let label: string;
  export let value: string = '#000000';
  export let id: string = `color-input-${Math.random().toString(36).substr(2, 9)}`;
  
  const dispatch = createEventDispatcher();
  
  function handleColorChange(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    dispatch('input', event);
    dispatch('change', { value: target.value });
  }
  
  function handleTextChange(event: Event) {
    const target = event.target as HTMLInputElement;
    let newValue = target.value;
    
    // Ensure the value starts with # if it's a hex color
    if (newValue && !newValue.startsWith('#')) {
      newValue = '#' + newValue;
    }
    
    // Validate hex color format
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue) || newValue === '#' || newValue === '') {
      value = newValue;
      dispatch('input', event);
      dispatch('change', { value: newValue });
    }
  }
</script>

<div class="color-input-wrapper">
  <label for={id} class="block text-sm text-kong-text-secondary mb-1">{label}</label>
  <div class="flex gap-2">
    <input 
      {id}
      type="color" 
      {value}
      on:input={handleColorChange}
      on:change={handleColorChange}
      class="w-10 h-10 rounded cursor-pointer border-0 p-0 color-picker"
      aria-label="{label} color picker"
    />
    {#if $$slots.default}
      <slot />
    {:else}
      <input 
        type="text" 
        {value}
        on:input={handleTextChange}
        on:change={handleTextChange}
        placeholder="#000000"
        class="flex-1 px-3 py-2 bg-kong-bg-secondary text-kong-text-primary border border-kong-border rounded focus:outline-none focus:ring-2 focus:ring-kong-primary focus:border-transparent"
        aria-label="{label} hex value"
      />
    {/if}
  </div>
</div>

<style>
  .color-picker {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background: none;
    cursor: pointer;
  }
  
  .color-picker::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  
  .color-picker::-webkit-color-swatch {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.25rem;
  }
  
  .color-picker::-moz-color-swatch {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.25rem;
  }
</style> 