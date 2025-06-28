<script lang="ts">
  import { Search, X } from "lucide-svelte";
  import { fade } from "svelte/transition";

  // Props
  type Props = {
    value: string;
    onInput: (value: string) => void;
    onKeyDown?: (event: KeyboardEvent) => void;
    onClear?: () => void;
    placeholder?: string;
    autoFocus?: boolean;
  };

  let {
    value = "",
    onInput,
    onKeyDown,
    onClear,
    placeholder = "Search wallets...",
    autoFocus = false
  }: Props = $props();

  let inputRef = $state<HTMLInputElement | null>(null);

  // Export focus method
  export function focus() {
    inputRef?.focus();
  }

  // Auto-focus on mount if requested
  $effect(() => {
    if (autoFocus && inputRef) {
      setTimeout(() => inputRef?.focus(), 100);
    }
  });

  function handleClear() {
    onInput("");
    onClear?.();
    inputRef?.focus();
  }
</script>

<div class="search-container" transition:fade={{ duration: 200 }}>
  <div class="relative">
    <div class="search-icon">
      <Search size={16} />
    </div>
    
    <input
      bind:this={inputRef}
      {value}
      oninput={(e) => onInput(e.currentTarget.value)}
      onkeydown={onKeyDown}
      type="text"
      class="search-input"
      {placeholder}
    />
    
    {#if value}
      <button
        class="clear-button"
        onclick={handleClear}
        aria-label="Clear search"
      >
        <X size={14} />
      </button>
    {/if}
    
    <div class="search-hint">
      <kbd class="font-mono">/</kbd>
    </div>
  </div>
</div>

<style lang="postcss">
  .search-container {
    @apply mb-5 px-2 sm:px-0;
  }

  .search-icon {
    @apply absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-kong-text-secondary;
  }

  .search-input {
    @apply w-full py-2.5 pl-10 pr-4 bg-kong-bg-primary/70 border border-kong-border rounded-xl;
    @apply shadow-inner text-sm text-kong-text-primary;
    @apply focus:outline-none focus:ring-2 focus:ring-kong-primary/50 focus:border-kong-primary;
    @apply transition-all duration-200;
  }

  .clear-button {
    @apply absolute inset-y-0 right-0 flex items-center pr-3;
    @apply text-kong-text-secondary hover:text-kong-text-primary;
  }

  .search-hint {
    @apply absolute right-3 top-2.5 opacity-60 text-xs;
    @apply bg-kong-bg-primary/50 px-1.5 py-0.5 rounded;
    @apply text-kong-text-secondary border border-kong-border-light/30;
  }
</style>