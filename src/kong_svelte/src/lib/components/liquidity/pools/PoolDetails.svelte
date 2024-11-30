<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { formatTokenAmount, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { goto } from "$app/navigation";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";

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

  function calculatePositionValue(position: BE.Position): string {
    const amount0Value = Number(position.amount0) * (token0?.price || 0);
    const amount1Value = Number(position.amount1) * (token1?.price || 0);
    return formatToNonZeroDecimal(amount0Value + amount1Value);
  }

  function calculatePositionShare(position: BE.Position): string {
    const totalLiquidity = Number(pool.balance_0) + Number(pool.balance_1);
    const positionLiquidity = Number(position.amount0) + Number(position.amount1);
    return ((positionLiquidity / totalLiquidity) * 100).toFixed(2);
  }
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
      <div class="token-info">
        <TokenImages tokens={[token0, token1]} overlap={12} size={32} />
        <h3 class="token-pair">{pool.symbol_0}/{pool.symbol_1}</h3>
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

    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-label">TVL</span>
        <span class="stat-value">${formatBigIntToUSD(pool.balance)}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">24h Volume</span>
        <span class="stat-value">${formatBigIntToUSD(pool.rolling_24h_volume)}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">APY</span>
        <span class="stat-value apy" style="color: {apyColor}">{formatToNonZeroDecimal(pool.rolling_24h_apy)}%</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Fee</span>
        <span class="stat-value">{pool.lp_fee_bps / 100}%</span>
      </div>
    </div>

    <div class="tabs">
      <button
        class="tab-button"
        class:active={activeTab === 'info'}
        on:click={() => activeTab = 'info'}
      >
        Info
      </button>
      <button
        class="tab-button"
        class:active={activeTab === 'positions'}
        on:click={() => activeTab = 'positions'}
      >
        Your Positions
      </button>
    </div>

    <div class="tab-content">
      {#if activeTab === 'info'}
        <div class="pool-reserves">
          <h4>Pool Reserves</h4>
          <div class="reserves-grid">
            <div class="reserve-item">
              <TokenImages tokens={[token0]} size={24} />
              <div class="reserve-info">
                <span class="token-symbol">{pool.symbol_0}</span>
                <span class="token-amount">{formatTokenAmount(pool.balance_0.toString(), token0?.decimals || 8)}</span>
              </div>
            </div>
            <div class="reserve-item">
              <TokenImages tokens={[token1]} size={24} />
              <div class="reserve-info">
                <span class="token-symbol">{pool.symbol_1}</span>
                <span class="token-amount">{formatTokenAmount(pool.balance_1.toString(), token1?.decimals || 8)}</span>
              </div>
            </div>
          </div>
        </div>
      {:else}
        {#if positions.length > 0}
          <div class="positions-section">
            {#each positions as position}
              <div class="position-item">
                <div class="position-header">
                  <span class="position-value">${calculatePositionValue(position)}</span>
                  <span class="position-share">{calculatePositionShare(position)}% of pool</span>
                </div>
                <div class="token-amounts">
                  <div class="token-amount">
                    <TokenImages tokens={[token0]} size={24} />
                    <div class="token-details">
                      <span class="token-quantity">{formatTokenAmount(position.amount0, token0?.decimals)} {pool.symbol_0}</span>
                      <span class="token-value">${formatToNonZeroDecimal(Number(position.amount0) * (token0?.price || 0))}</span>
                    </div>
                  </div>
                  <div class="token-amount">
                    <TokenImages tokens={[token1]} size={24} />
                    <div class="token-details">
                      <span class="token-quantity">{formatTokenAmount(position.amount1, token1?.decimals)} {pool.symbol_1}</span>
                      <span class="token-value">${formatToNonZeroDecimal(Number(position.amount1) * (token1?.price || 0))}</span>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="no-positions">
            <p>You don't have any positions in this pool yet.</p>
            <button class="action-btn add-liquidity" on:click={handleAddLiquidity}>
              Add Liquidity
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</Modal>

<style lang="postcss">
  .pool-details {
    @apply flex flex-col gap-4;
  }

  .pool-header {
    @apply flex justify-between items-center mb-4;
  }

  .token-info {
    @apply flex items-center gap-3;
  }

  .token-pair {
    @apply text-xl font-medium text-white;
  }

  .quick-actions {
    @apply flex items-center gap-2;
  }

  .action-btn {
    @apply px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200;
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
    @apply grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4;
  }

  .stat-item {
    @apply flex flex-col gap-1 p-3 rounded-lg bg-[#2a2d3d]/50;
  }

  .stat-label {
    @apply text-sm text-[#8890a4];
  }

  .stat-value {
    @apply text-lg font-medium text-white;
  }

  .tabs {
    @apply flex gap-2 p-1 bg-[#2a2d3d]/30 rounded-lg mb-4;
  }

  .tab-button {
    @apply flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
           text-white/70 hover:text-white hover:bg-white/5;
  }

  .tab-button.active {
    @apply bg-[#2a2d3d] text-white;
  }

  .positions-section {
    @apply flex flex-col gap-4;
  }

  .position-item {
    @apply bg-[#1a1b23] rounded-lg border border-[#2a2d3d] p-4;
  }

  .position-header {
    @apply flex justify-between items-center mb-3 pb-3 border-b border-[#2a2d3d];
  }

  .position-value {
    @apply text-lg font-medium text-white;
  }

  .position-share {
    @apply text-sm text-[#8890a4];
  }

  .token-amounts {
    @apply flex flex-col gap-3;
  }

  .token-amount {
    @apply flex items-center gap-3;
  }

  .token-details {
    @apply flex flex-col;
  }

  .token-quantity {
    @apply text-white font-medium;
  }

  .token-value {
    @apply text-sm text-[#8890a4];
  }

  .pool-reserves h4 {
    @apply text-sm text-[#8890a4] mb-3;
  }

  .reserves-grid {
    @apply flex flex-col gap-2;
  }

  .reserve-item {
    @apply flex items-center gap-3 p-3 rounded-lg bg-[#2a2d3d]/50;
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

  .no-positions {
    @apply flex flex-col items-center gap-4 p-8 text-center;
  }

  .no-positions p {
    @apply text-[#8890a4] mb-2;
  }
</style>
