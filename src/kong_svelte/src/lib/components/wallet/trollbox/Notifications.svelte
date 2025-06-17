<script lang="ts">
  import { slide } from 'svelte/transition';
  import { AlertCircle } from 'lucide-svelte';
  
  // Props
  export let errorMessage = '';
  export let showRefreshPrompt = false;
  export let onRefresh: () => void;
</script>

<!-- Error message -->
{#if errorMessage}
  <div class="px-3.5 py-2.5 bg-red-900/30 border-t border-kong-border flex items-center gap-2" transition:slide={{ duration: 200 }}>
    <AlertCircle class="w-4 h-4 text-red-400 shrink-0" />
    <p class="text-sm text-red-200">{errorMessage}</p>
  </div>
{/if}

<!-- Refresh prompt - shown after wallet interactions -->
{#if showRefreshPrompt}
  <div class="px-3.5 py-2.5 bg-blue-900/30 border-t border-kong-border flex items-center gap-2 justify-between" transition:slide={{ duration: 200 }}>
    <div class="flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400 shrink-0">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
        <path d="M21 3v5h-5"></path>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
        <path d="M8 16H3v5"></path>
      </svg>
      <p class="text-sm text-blue-200">Don't see your message? Refresh to update.</p>
    </div>
    <button 
      onclick={onRefresh}
      class="text-xs bg-blue-800/50 hover:bg-blue-700/50 px-2.5 py-1 rounded-md text-blue-100 transition-colors"
    >
      Refresh Now
    </button>
  </div>
{/if} 