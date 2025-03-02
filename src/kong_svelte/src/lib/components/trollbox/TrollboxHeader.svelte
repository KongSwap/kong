<script lang="ts">
  import { MessagesSquare, X, HelpCircle } from 'lucide-svelte';
  
  export let isUserAdmin = false;
  export let isLoading = false;
  export let onRefresh: () => void;
  export let onToggleInstructions: () => void;
  export let onClose: () => void;
</script>

<div class="flex items-center justify-between p-2.5 border-b border-kong-pm-border bg-kong-surface-dark">
  <div class="flex items-center gap-2">
    <MessagesSquare class="w-5 h-5 text-kong-accent-purple" />
    <h3 class="text-base font-medium text-kong-text-primary">TrollBox</h3>
    {#if isUserAdmin}
      <span class="bg-kong-accent-purple px-1.5 py-0.5 text-white text-xs rounded-sm">Admin</span>
    {/if}
  </div>
  <div class="flex items-center gap-1.5">
    <!-- Refresh button -->
    <button 
      on:click={onRefresh}
      class="text-kong-pm-text-secondary hover:text-kong-text-primary transition-colors p-1.5 rounded-full relative"
      title="Refresh messages"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={isLoading ? 'animate-spin' : ''}>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
        <path d="M21 3v5h-5"></path>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
        <path d="M8 16H3v5"></path>
      </svg>
      {#if isLoading}
        <span class="absolute -top-1 -right-1 w-2 h-2 bg-kong-accent-purple rounded-full"></span>
      {/if}
    </button>
    <button 
      on:click={onToggleInstructions}
      class="text-kong-pm-text-secondary hover:text-kong-text-primary transition-colors p-1.5 rounded-full"
      title="Help & Tips"
    >
      <HelpCircle class="w-4.5 h-4.5" />
    </button>
    <button 
      on:click={onClose}
      class="text-kong-pm-text-secondary hover:text-kong-text-primary transition-colors p-1.5 rounded-full"
    >
      <X class="w-4.5 h-4.5" />
    </button>
  </div>
</div> 