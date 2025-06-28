<script lang="ts">
  import { fade } from "svelte/transition";
  import WalletCard from "./WalletCard.svelte";
  import { formatChainName } from "$lib/config/wallets";
  import type { WalletInfo, RecentWallet } from "$lib/config/wallets";

  // Props
  type Props = {
    groupedWallets: { grouped: Record<string, WalletInfo[]>; sortedChains: string[] };
    recentWallets: RecentWallet[];
    isConnecting: boolean;
    clickedWalletInfo: { id: string; source: 'recent' | 'all' } | null;
    focusedWalletId?: string;
    onConnect: (walletId: string) => void;
  };

  let {
    groupedWallets,
    recentWallets,
    isConnecting,
    clickedWalletInfo,
    focusedWalletId,
    onConnect
  }: Props = $props();

  function isRecentWallet(walletId: string): boolean {
    return recentWallets.some(rw => rw.id === walletId);
  }
</script>

<div class="wallet-grid-container">
  <div class="chains-grid">
    {#each groupedWallets.sortedChains as chain}
      <div class="chain-section" in:fade={{ duration: 300, delay: 100 }}>
        <div class="chain-header">
          <h4 class="chain-title">
            {formatChainName(chain)}
          </h4>
          <span class="wallet-count">
            {groupedWallets.grouped[chain].length}
            {groupedWallets.grouped[chain].length === 1 ? "wallet" : "wallets"}
          </span>
        </div>

        <div class="wallets-list">
          {#each groupedWallets.grouped[chain] as wallet, i}
            <WalletCard
              {wallet}
              isRecent={isRecentWallet(wallet.id)}
              {isConnecting}
              isClicked={clickedWalletInfo?.id === wallet.id && clickedWalletInfo?.source === 'all'}
              isFocused={focusedWalletId === wallet.id}
              isDisabled={isConnecting && !(clickedWalletInfo?.id === wallet.id && clickedWalletInfo?.source === 'all')}
              animationDelay={i * 50}
              onConnect={() => onConnect(wallet.id)}
            />
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style lang="postcss">
  .wallet-grid-container {
    @apply px-2 sm:px-0;
  }

  .chains-grid {
    @apply grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5;
  }

  .chain-section {
    @apply flex flex-col;
  }

  .chain-header {
    @apply flex items-center mb-3 gap-2;
  }

  .chain-title {
    @apply text-xs font-medium text-kong-text-secondary uppercase tracking-wide;
  }

  .wallet-count {
    @apply text-xs bg-kong-bg-secondary/20 text-kong-text-secondary;
    @apply px-1.5 py-0.5 rounded-full;
  }

  .wallets-list {
    @apply flex flex-col gap-2;
  }
</style>