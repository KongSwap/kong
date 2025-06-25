<script lang="ts">
  import { MoreVertical, Star, Coins } from "lucide-svelte";
  import { tick } from "svelte";
  import Portal from "svelte-portal";

  let {
    isOpen,
    onToggle,
    onSetFeatured,
    onResolve,
    onVoid,
    isFeatured = false,
  } = $props<{
    isOpen: boolean;
    onToggle: (e: MouseEvent) => void;
    onSetFeatured: () => void;
    onResolve: () => void;
    onVoid: () => void;
    isFeatured?: boolean;
  }>();

  let buttonRef: HTMLButtonElement;
  let dropdownPosition = $state({ top: 0, left: 0 });

  // Calculate dropdown position when opened
  $effect(() => {
    if (isOpen && buttonRef) {
      tick().then(() => {
        const rect = buttonRef.getBoundingClientRect();
        dropdownPosition = {
          top: rect.bottom + 8,
          left: rect.right - 192 // 192px is the width of dropdown (w-48)
        };
      });
    }
  });
</script>

<div class="relative">
  <button
    bind:this={buttonRef}
    class="p-1.5 text-right rounded-full hover:bg-kong-bg-primary/50 transition-colors"
    onclick={(e) => {
      e.stopPropagation();
      onToggle(e);
    }}
  >
    <MoreVertical class="w-4 h-4 text-kong-text-secondary" />
  </button>
</div>

<!-- Render dropdown in portal to avoid overflow issues -->
{#if isOpen}
  <Portal>
    <div 
      class="fixed w-48 bg-kong-bg-primary border border-kong-border rounded-md shadow-lg z-[9999]"
      style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px;"
    >
      <div class="py-1">
        <button
          class="w-full px-4 py-2.5 text-left text-sm text-kong-text-primary hover:bg-kong-accent-blue/10 hover:text-kong-accent-blue flex items-center gap-2 transition-all duration-200 group"
          onclick={(e) => {
            e.stopPropagation();
            onSetFeatured();
          }}
        >
          <Star class="w-4 h-4 group-hover:scale-110 transition-transform duration-200 {isFeatured ? 'fill-kong-accent-yellow text-kong-accent-yellow' : ''}" />
          {isFeatured ? 'Remove Featured' : 'Set as Featured'}
        </button>
        <button
          class="w-full px-4 py-2.5 text-left text-sm text-kong-text-primary hover:bg-kong-success/10 hover:text-kong-success flex items-center gap-2 transition-all duration-200 group"
          onclick={(e) => {
            e.stopPropagation();
            onResolve();
          }}
        >
          <Coins class="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
          Resolve Market
        </button>
        <div class="mx-2 my-1 border-t border-kong-text-primary/10"></div>
        <button
          class="w-full px-4 py-2.5 text-left text-sm text-kong-text-secondary hover:bg-kong-error/10 hover:text-kong-error flex items-center gap-2 transition-all duration-200 group"
          onclick={(e) => {
            e.stopPropagation();
            onVoid();
          }}
        >
          <svg class="w-4 h-4 group-hover:scale-110 transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
          Void Market
        </button>
      </div>
    </div>
  </Portal>
{/if} 