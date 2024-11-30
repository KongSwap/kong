<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { formatTokenAmount, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import AddLiquidityForm from "$lib/components/liquidity/add_liquidity/AddLiquidityForm.svelte";
  import { goto } from "$app/navigation";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";

  export let pool: BE.Pool;
  export let tokenMap: Map<string, any>;
  export let onClose: () => void;
  export let positions: BE.Position[] = [];
  export let showModal: boolean;

  let activeTab: 'details' | 'add-liquidity' | 'positions' = 'details';
  
  const tabs = [
    { id: 'details', label: 'Pool Details' },
    { id: 'positions', label: 'Your Positions' },
    { id: 'add-liquidity', label: 'Add Liquidity' }
  ];

  function handleSwap() {
    if (pool.address_0 && pool.address_1) {
      goto(`/swap?from=${pool.address_0}&to=${pool.address_1}`);
    }
  }

  $: token0 = tokenMap.get(pool.address_0);
  $: token1 = tokenMap.get(pool.address_1);
  $: apyColor = pool.rolling_24h_apy > 100 ? "#FFD700" : 
                pool.rolling_24h_apy > 50 ? "#FFA500" : "#FF8C00";

  function handleClose() {
      showModal = false;
      onClose();
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
        <button class="action-btn" on:click={handleSwap}>
          Swap
        </button>
      </div>
    </div>

    <div class="tabs">
      {#each tabs as tab}
        <button
          class="tab-btn {activeTab === tab.id ? 'active' : ''}"
          on:click={() => activeTab = tab.id as any}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    {#if activeTab === 'details'}
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">TVL</span>
          <span class="stat-value">${formatToNonZeroDecimal(pool.tvl)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">24h Volume</span>
          <span class="stat-value">${pool.rolling_24h_volume}</span>
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
    {:else if activeTab === 'positions'}
      <div class="positions-list">
        {#if positions.length === 0}
          <div class="empty-state">
            <p>You don't have any positions in this pool yet.</p>
            <button class="action-btn" on:click={() => activeTab = 'add-liquidity'}>
              Add Liquidity
            </button>
          </div>
        {:else}
          {#each positions as position}
            <div class="position-item">
              <h4>Your Position</h4>
              <div class="token-amounts">
                <div class="token-amount">
                  <TokenImages tokens={[token0]} size={24} />
                  <span>{formatTokenAmount(position.amount0, token0?.decimals)} {pool.symbol_0}</span>
                </div>
                <div class="token-amount">
                  <TokenImages tokens={[token1]} size={24} />
                  <span>{formatTokenAmount(position.amount1, token1?.decimals)} {pool.symbol_1}</span>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    {:else if activeTab === 'add-liquidity'}
      <AddLiquidityForm
        token0={token0}
        token1={token1}
        amount0=""
        amount1=""
        loading={false}
        previewMode={false}
        error={null}
        token0Balance="0"
        token1Balance="0"
        onTokenSelect={() => {}}
        onInput={() => {}}
        onSubmit={() => {}}
      />
    {/if}
  </div>
</Modal>

<style lang="postcss">
  .pool-details {
    @apply flex flex-col gap-4;
  }

  .pool-header {
    @apply flex justify-between items-center mb-2;
  }

  .token-info {
    @apply flex items-center gap-3;
  }

  .token-pair {
    @apply text-xl font-medium text-white;
  }

  .action-btn {
    @apply px-4 py-1 text-sm font-medium rounded-lg transition-all duration-200
           bg-[#60A5FA]/20 text-[#60A5FA] border border-[#60A5FA]/30
           hover:bg-[#60A5FA]/30 hover:border-[#60A5FA]/50;
  }

  .tabs {
    @apply flex gap-2 p-1 bg-[#1a1b23] rounded-lg border border-[#2a2d3d] mb-4;
  }

  .tab-btn {
    @apply flex-1 px-4 py-1 text-sm font-medium rounded-md transition-all duration-200
           text-[#8890a4] hover:text-white;
  }

  .tab-btn.active {
    @apply bg-[#2a2d3d] text-white;
  }

  .stats-grid {
    @apply grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4;
  }

  .stat-item {
    @apply flex flex-col gap-1 p-2 rounded-lg bg-[#2a2d3d]/50;
  }

  .stat-label {
    @apply text-sm text-[#8890a4];
  }

  .stat-value {
    @apply text-lg font-medium text-white;
  }

  .pool-reserves {
    @apply bg-[#1a1b23] rounded-lg border border-[#2a2d3d] p-3;
  }

  .pool-reserves h4 {
    @apply text-sm text-[#8890a4] mb-2;
  }

  .reserves-grid {
    @apply flex flex-col gap-2;
  }

  .reserve-item {
    @apply flex items-center gap-3 p-2 rounded-lg bg-[#2a2d3d]/50;
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

  .positions-list {
    @apply flex flex-col gap-2;
  }

  .empty-state {
    @apply flex flex-col items-center gap-2 p-4 text-center;
  }

  .empty-state p {
    @apply text-[#8890a4];
  }

  .position-item {
    @apply bg-[#1a1b23] rounded-lg border border-[#2a2d3d] p-3;
  }

  .position-item h4 {
    @apply text-sm text-[#8890a4] mb-2;
  }

  .token-amounts {
    @apply flex flex-col gap-2;
  }

  .token-amount {
    @apply flex items-center gap-3 p-2 rounded-lg bg-[#2a2d3d]/50;
  }

  @media (max-width: 640px) {
    .stats-grid {
      @apply grid-cols-2;
    }

    .stat-item {
      @apply p-2;
    }

    .stat-value {
      @apply text-base;
    }
  }
</style>
