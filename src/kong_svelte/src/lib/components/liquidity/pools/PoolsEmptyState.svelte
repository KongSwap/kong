<script lang="ts">
  import { goto } from "$app/navigation";
  import { Droplets, Plus } from "lucide-svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";

  interface EmptyStateProps {
    isUserPool: boolean;
    searchInput: string;
    isConnected: boolean;
  }

  let { isUserPool, searchInput, isConnected }: EmptyStateProps = $props();

  const config = $derived({
    icon: Droplets,
    title: searchInput 
      ? `No pools found matching "${searchInput}"`
      : isUserPool 
        ? "No active liquidity positions" 
        : "No pools available",
    subtitle: searchInput
      ? "Try a different search term or check your active positions"
      : isUserPool
        ? "Add liquidity to a pool to start earning fees"
        : "Check back later for available pools"
  });
</script>

{#if isUserPool && !isConnected}
  <div
    class="flex flex-col items-center justify-center h-64 text-center p-6 bg-white/[0.02] rounded-xl border border-white/[0.04] shadow-lg backdrop-blur-md m-4"
  >
    <div class="p-4 rounded-full bg-kong-primary/5 text-kong-primary/70 mb-4">
      <Droplets size={40} />
    </div>
    <p class="text-lg font-medium text-kong-text-primary mb-2">
      Connect your wallet to view your liquidity positions
    </p>
    <p class="text-sm text-kong-text-primary/60 max-w-md mb-6">
      Provide liquidity to pools and earn trading fees and rewards
    </p>
    <button
      class="px-6 py-2.5 bg-kong-primary text-white rounded-lg hover:bg-kong-primary-hover transition-all duration-200 flex items-center gap-2 shadow-md"
      onclick={() => sidebarStore.open()}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M12 12h.01" />
      </svg>
      <span class="font-medium">Connect Wallet</span>
    </button>
  </div>
{:else}
  <div class="flex flex-col items-center justify-center h-64 gap-4 text-center">
    <div class="p-4 rounded-full bg-kong-primary/5 text-kong-primary/70 mb-2">
      <svelte:component this={config.icon} size={40} />
    </div>
    <p class="text-lg font-medium text-kong-text-primary">
      {config.title}
    </p>
    <p class="text-sm text-kong-text-primary/60 max-w-md">
      {config.subtitle}
    </p>
  </div>
{/if}