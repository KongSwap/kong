<script lang="ts">
  import { Clock, Trash2 } from "lucide-svelte";
  import { fade } from "svelte/transition";
  import WalletCard from "./WalletCard.svelte";
  import type { WalletInfo, RecentWallet } from "$lib/config/wallets";

  // Props
  type Props = {
    recentWallets: RecentWallet[];
    getWalletById: (id: string) => WalletInfo | undefined;
    isConnecting: boolean;
    clickedWalletInfo: { id: string; source: 'recent' | 'all' } | null;
    onConnect: (walletId: string) => void;
    onRemove: (walletId: string) => void;
    onClearAll: () => void;
  };

  let {
    recentWallets,
    getWalletById,
    isConnecting,
    clickedWalletInfo,
    onConnect,
    onRemove,
    onClearAll
  }: Props = $props();
</script>

{#if recentWallets.length > 0}
  <div class="recent-wallets-section" in:fade={{ duration: 300 }}>
    <div class="section-header">
      <h3 class="section-title">
        <Clock size={14} class="text-kong-primary" />
        <span>Recently Used</span>
      </h3>

      {#if recentWallets.length > 1}
        <button
          class="clear-all-button"
          onclick={onClearAll}
        >
          <Trash2 size={12} />
          <span>Clear All</span>
        </button>
      {/if}
    </div>

    <div class="wallets-grid">
      {#each recentWallets as recentWallet, i (recentWallet.id)}
        {@const wallet = getWalletById(recentWallet.id)}
        {#if wallet}
          <WalletCard
            {wallet}
            isRecent={true}
            recentTimestamp={recentWallet.timestamp}
            {isConnecting}
            isClicked={clickedWalletInfo?.id === wallet.id && clickedWalletInfo?.source === 'recent'}
            isDisabled={isConnecting && !(clickedWalletInfo?.id === wallet.id && clickedWalletInfo?.source === 'recent')}
            showRemove={true}
            variant={i === 0 ? 'first-recent' : 'recent'}
            animationDelay={i * 50}
            onConnect={() => onConnect(wallet.id)}
            onRemove={() => onRemove(wallet.id)}
          />
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style lang="postcss">
  .recent-wallets-section {
    @apply mb-6 px-2 sm:px-0;
  }

  .section-header {
    @apply flex items-center justify-between mb-2;
  }

  .section-title {
    @apply text-sm font-medium text-kong-text-primary flex items-center gap-2;
  }

  .clear-all-button {
    @apply text-xs text-kong-text-secondary hover:text-kong-error;
    @apply flex items-center gap-1.5 px-2 py-1 rounded;
    @apply hover:bg-kong-error/10 transition-colors;
  }

  .wallets-grid {
    @apply grid grid-cols-1 sm:grid-cols-2 gap-3;
  }
</style>