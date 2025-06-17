<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';
  
  export let message: string = "An error occurred";
  export let retryHandler: (() => void) | null = null;
  export let size: "small" | "medium" | "large" = "medium";
  
  const paddingClass = {
    small: "p-4",
    medium: "p-8",
    large: "p-16"
  };
  
  const iconSizeClass = {
    small: "h-6 w-6",
    medium: "h-10 w-10",
    large: "h-12 w-12"
  };
  
  const textClass = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg"
  };
</script>

<div class="{paddingClass[size]} text-center">
  <div class="flex justify-center mb-4">
    <div class="relative">
      <AlertTriangle class="text-kong-error {iconSizeClass[size]}" />
      <div class="absolute inset-0 text-kong-error {iconSizeClass[size]} animate-ping opacity-30"></div>
    </div>
  </div>
  
  <p class="text-kong-error mb-4 font-medium {textClass[size]}">{message}</p>
  
  {#if retryHandler}
    <button 
      class="mt-4 px-6 py-2 bg-kong-primary hover:bg-kong-primary-hover rounded-md text-white text-sm font-medium transition-colors shadow-md hover:shadow-lg flex items-center mx-auto"
      onclick={retryHandler}
    >
      <span class="mr-2">Try Again</span>
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 12L5 15M2 12L5 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  {/if}
</div> 