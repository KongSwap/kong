<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  
  let {
    onSwap,
    onReverse,
    onMaxAmount,
    isEnabled = true
  } = $props<{
    onSwap?: () => void;
    onReverse?: () => void;
    onMaxAmount?: () => void;
    isEnabled?: boolean;
  }>();
  
  function handleKeyDown(e: KeyboardEvent) {
    if (!isEnabled) return;
    
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    
    // Cmd/Ctrl + Enter to swap
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && onSwap) {
      e.preventDefault();
      onSwap();
    }
    
    // Alt + R to reverse tokens
    if (e.altKey && e.key === 'r' && onReverse) {
      e.preventDefault();
      onReverse();
    }
    
    // Alt + M for max amount
    if (e.altKey && e.key === 'm' && onMaxAmount) {
      e.preventDefault();
      onMaxAmount();
    }
  }
  
  onMount(() => {
    if (browser) {
      window.addEventListener('keydown', handleKeyDown);
    }
  });
  
  onDestroy(() => {
    if (browser) {
      window.removeEventListener('keydown', handleKeyDown);
    }
  });
</script>

<!-- Visual indicator for available shortcuts -->
{#if isEnabled}
  <div class="fixed bottom-4 right-4 hidden lg:block">
    <div class="bg-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-lg p-3 text-xs space-y-1">
      <div class="text-gray-400 font-medium mb-2">Keyboard Shortcuts</div>
      <div class="flex items-center gap-2">
        <kbd class="px-2 py-1 bg-gray-800 rounded text-gray-300 font-mono text-[10px]">⌘</kbd>
        <span class="text-gray-300">+</span>
        <kbd class="px-2 py-1 bg-gray-800 rounded text-gray-300 font-mono text-[10px]">Enter</kbd>
        <span class="text-gray-400 ml-2">Swap</span>
      </div>
      <div class="flex items-center gap-2">
        <kbd class="px-2 py-1 bg-gray-800 rounded text-gray-300 font-mono text-[10px]">Alt</kbd>
        <span class="text-gray-300">+</span>
        <kbd class="px-2 py-1 bg-gray-800 rounded text-gray-300 font-mono text-[10px]">R</kbd>
        <span class="text-gray-400 ml-2">Reverse</span>
      </div>
      <div class="flex items-center gap-2">
        <kbd class="px-2 py-1 bg-gray-800 rounded text-gray-300 font-mono text-[10px]">Alt</kbd>
        <span class="text-gray-300">+</span>
        <kbd class="px-2 py-1 bg-gray-800 rounded text-gray-300 font-mono text-[10px]">M</kbd>
        <span class="text-gray-400 ml-2">Max</span>
      </div>
    </div>
  </div>
{/if} 