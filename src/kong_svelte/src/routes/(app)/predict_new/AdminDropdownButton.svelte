<script lang="ts">
  import { MoreVertical, Star, Coins } from "lucide-svelte";

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
</script>

<div class="admin-dropdown justify-end">
  <button
    class="p-1.5 text-right rounded-full hover:bg-kong-bg-primary/50 transition-colors"
    onclick={(e) => {
      e.stopPropagation();
      onToggle(e);
    }}
  >
    <MoreVertical class="w-4 h-4 text-kong-text-secondary" />
  </button>
  {#if isOpen}
    <div class="absolute top-full right-0 mt-2 w-48 bg-kong-bg-primary border border-kong-border rounded-md shadow-lg">
      <div class="py-1">
        <button
          class="w-full px-4 py-2 text-left text-sm text-kong-text-primary hover:bg-kong-bg-secondary/10 flex items-center gap-2"
          onclick={(e) => {
            e.stopPropagation();
            onSetFeatured();
          }}
        >
          <Star class="w-4 h-4" />
          {isFeatured ? 'Remove Featured' : 'Set as Featured'}
        </button>
        <button
          class="w-full px-4 py-2 text-left text-sm text-kong-text-primary hover:bg-kong-bg-secondary/10 flex items-center gap-2"
          onclick={(e) => {
            e.stopPropagation();
            onResolve();
          }}
        >
          <Coins class="w-4 h-4" />
          Resolve Market
        </button>
        <button
          class="w-full px-4 py-2 text-left text-sm text-kong-error hover:bg-kong-bg-secondary/10 flex items-center gap-2"
          onclick={(e) => {
            e.stopPropagation();
            onVoid();
          }}
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
          Void Market
        </button>
      </div>
    </div>
  {/if}
</div> 