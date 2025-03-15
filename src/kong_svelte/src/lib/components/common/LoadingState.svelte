<script lang="ts">
  export let message: string = "Loading...";
  export let size: "small" | "medium" | "large" = "medium";
  export let centerVertically: boolean = false;
  
  // Size mappings for dot size and spacing
  const dotSizeClass = {
    small: "w-2 h-2",
    medium: "w-3 h-3",
    large: "w-4 h-4"
  };
  
  const spacingClass = {
    small: "space-x-2",
    medium: "space-x-3",
    large: "space-x-4"
  };
  
  const paddingClass = {
    small: "p-4",
    medium: "p-8",
    large: "p-16"
  };
  
  const textClass = {
    small: "text-xs",
    medium: "text-sm",
    large: "text-base"
  };
</script>

<div class="{paddingClass[size]} flex flex-col justify-center items-center {centerVertically ? 'h-full' : ''}">
  <div class="animate-pulse flex {spacingClass[size]}">
    <div class="{dotSizeClass[size]} bg-kong-primary rounded-full"></div>
    <div class="{dotSizeClass[size]} bg-kong-primary rounded-full animation-delay-200"></div>
    <div class="{dotSizeClass[size]} bg-kong-primary rounded-full animation-delay-500"></div>
  </div>
  {#if message}
    <p class="text-kong-text-secondary mt-4 {textClass[size]}">{message}</p>
  {/if}
</div>

<style>
  .animation-delay-200 {
    animation-delay: 200ms;
  }
  
  .animation-delay-500 {
    animation-delay: 500ms;
  }
</style> 