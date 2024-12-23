<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { formatBalance, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { goto } from "$app/navigation";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import PoolList from "$lib/components/sidebar/PoolList.svelte";

  export let pool: BE.Pool;
  export let tokenMap: Map<string, any>;
  export let onClose: () => void;
  export let positions: BE.Position[] = [];
  export let showModal: boolean;

  $: token0 = tokenMap.get(pool.address_0);
  $: token1 = tokenMap.get(pool.address_1);
  $: apyColor = pool.rolling_24h_apy > 100 ? "#FFD700" : 
                pool.rolling_24h_apy > 50 ? "#FFA500" : "#FF8C00";

  let activeTab = positions.length > 0 ? 'positions' : 'info';

  // Helper function to format bigint values to USD
  function formatBigIntToUSD(value: bigint): string {
    return formatToNonZeroDecimal(Number(value) / 1e6);
  }

  function handleClose() {
      showModal = false;
      onClose();
  }

  function handleSwap() {
    if (pool.address_0 && pool.address_1) {
      goto(`/swap?from=${pool.address_0}&to=${pool.address_1}`);
    }
  }

  function handleAddLiquidity() {
    if (pool.address_0 && pool.address_1) {
      goto(`/earn/add?token0=${pool.address_0}&token1=${pool.address_1}`);
    }
  }

  let showPositions = false;

  $: poolName = `${pool.symbol_0}/${pool.symbol_1}`;
</script>

<Modal
  isOpen={showModal}
  title="Pool Details"
  onClose={handleClose}
  variant="green"
  width="800px"
>
  <div class="pool-details">
    <div class="pool-header">
      <div class="header-content">
        <div class="token-info">
          <TokenImages tokens={[token0, token1]} overlap={12} size={32} />
          <h3 class="token-pair">{pool.symbol_0}/{pool.symbol_1}</h3>
        </div>
      </div>
      
      <div class="quick-actions">
        <button class="action-btn add-liquidity" on:click={handleAddLiquidity}>
          Add Liquidity
        </button>
        <button class="action-btn swap" on:click={handleSwap}>
          Swap
        </button>
      </div>
    </div>

    <div class="tabs">
      <button
        class="tab-button"
        class:active={!showPositions}
        on:click={() => showPositions = false}
      >
        Info
      </button>
      <button
        class="tab-button"
        class:active={showPositions}
        on:click={() => showPositions = true}
      >
        Your Positions
      </button>
    </div>

    <div class="tab-content">
      {#if showPositions}
        <PoolList initialSearch={poolName} />
      {:else}
        <div class="info-content">
          <div class="stats-grid">
            <div class="stat-item full-width">
              <span class="stat-label">TVL</span>
              <span class="stat-value">${formatBigIntToUSD(pool.tvl)}</span>
            </div>
            <div class="stat-item full-width">
              <span class="stat-label">24h Volume</span>
              <span class="stat-value">${formatBigIntToUSD(pool.rolling_24h_volume)}</span>
            </div>
            <div class="stat-row">
              <div class="stat-item flex-1">
                <span class="stat-label">APY</span>
                <span class="stat-value apy" style="color: {apyColor}">{formatToNonZeroDecimal(pool.rolling_24h_apy)}%</span>
              </div>
              <div class="stat-item flex-1">
                <span class="stat-label">Fee</span>
                <span class="stat-value">{pool.lp_fee_bps / 100}%</span>
              </div>
            </div>
          </div>

          <div class="pool-reserves">
            <h4>Pool Reserves</h4>
            <div class="reserves-grid">
              <div class="reserve-item">
                <TokenImages tokens={[token0]} size={24} />
                <div class="reserve-info">
                  <span class="token-symbol">{pool.symbol_0}</span>
                  <span class="token-amount">{formatBalance(pool.balance_0.toString(), token0?.decimals || 8)}</span>
                </div>
              </div>
              <div class="reserve-item">
                <TokenImages tokens={[token1]} size={24} />
                <div class="reserve-info">
                  <span class="token-symbol">{pool.symbol_1}</span>
                  <span class="token-amount">{formatBalance(pool.balance_1.toString(), token1?.decimals || 8)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</Modal>

<style lang="postcss">
  .pool-details {
    @apply flex flex-col gap-3;
  }

  .pool-header {
    @apply flex flex-col gap-2 mb-2;
  }

  .header-content {
    @apply flex items-center justify-between;
  }

  .token-info {
    @apply flex items-center gap-3;
  }

  .token-pair {
    @apply text-xl font-medium text-white;
  }

  .quick-actions {
    @apply flex gap-2 w-full;
  }

  .action-btn {
    @apply px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 flex-1;
  }

  .action-btn.add-liquidity {
    @apply bg-[#60A5FA]/20 text-[#60A5FA] border border-[#60A5FA]/30
           hover:bg-[#60A5FA]/30 hover:border-[#60A5FA]/50;
  }

  .action-btn.swap {
    @apply bg-white/10 text-white/70 border border-white/10
           hover:bg-white/20 hover:border-white/20 hover:text-white;
  }

  .stats-grid {
    @apply flex flex-col gap-2 mb-3;
  }

  .stat-row {
    @apply flex gap-2;
  }

  .stat-item {
    @apply flex flex-col gap-0.5 p-2 rounded-lg bg-[#2a2d3d]/50;
  }

  .stat-item.full-width {
    @apply w-full;
  }

  .stat-label {
    @apply text-sm text-[#8890a4];
  }

  .stat-value {
    @apply text-lg font-medium text-white;
  }

  .tabs {
    @apply flex gap-2 p-0.5 bg-[#2a2d3d]/30 rounded-lg mb-3;
  }

  .tab-button {
    @apply flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200
           text-white/70 hover:text-white hover:bg-white/5;
  }

  .tab-button.active {
    @apply bg-[#2a2d3d] text-white;
  }

  .pool-reserves h4 {
    @apply text-sm text-[#8890a4] mb-2;
  }

  .reserves-grid {
    @apply flex flex-col gap-1.5;
  }

  .reserve-item {
    @apply flex items-center gap-2 p-2 rounded-lg bg-[#2a2d3d]/50;
  }

  .reserve-info {
    @apply flex flex-col;
  }

  .token-symbol {
    @apply text-sm text-[#8890a4];
  }

  .token-amount {
    @apply text-white font-medium;
  }

  /* Desktop styles */
  @media (min-width: 640px) {
    .pool-header {
      @apply flex-row justify-between items-center mb-2;
    }

    .quick-actions {
      @apply w-auto;
    }

    .action-btn {
      @apply w-auto flex-initial min-w-[100px];
    }

    .stats-grid {
      @apply grid grid-cols-2 gap-2;
    }

    .stat-item.full-width {
      @apply col-span-1;
    }

    .stat-row {
      @apply col-span-2;
    }
  }
</style>
