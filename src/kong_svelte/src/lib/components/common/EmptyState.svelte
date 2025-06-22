<script lang="ts">
  import { BarChart3, Package } from 'lucide-svelte';
  
  export let message: string = "No data available";
  export let subMessage: string = "";
  export let icon: typeof BarChart3 | typeof Package = BarChart3;
  export let size: "small" | "medium" | "large" = "medium";
  
  const paddingClass = {
    small: "p-4",
    medium: "p-8",
    large: "p-16"
  };
  
  const iconSizeClass = {
    small: "w-10 h-10",
    medium: "w-16 h-16",
    large: "w-24 h-24"
  };
  
  const textClass = {
    small: "text-base",
    medium: "text-lg",
    large: "text-xl"
  };
  
  const subTextClass = {
    small: "text-xs",
    medium: "text-sm",
    large: "text-base"
  };
</script>

<div class="{paddingClass[size]} text-center text-kong-text-secondary">
  <div class="flex justify-center mb-6">
    <div class="bg-kong-bg-secondary bg-opacity-20 rounded-full p-4 border border-kong-border">
      <svelte:component this={icon} class="{iconSizeClass[size]} opacity-40" />
    </div>
  </div>
  <p class="{textClass[size]} mb-2">{message}</p>
  {#if subMessage}
    <p class="{subTextClass[size]} opacity-70">{subMessage}</p>
  {/if}
</div> 