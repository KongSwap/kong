<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { formatTokenAmount, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import AddLiquidityForm from "$lib/components/liquidity/add_liquidity/AddLiquidityForm.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import { goto } from "$app/navigation";
  import type { Position } from "$lib/types";

  export let pool: BE.Pool;
  export let tokenMap: Map<string, any>;
  export let onClose: () => void;
  export let positions: Position[] = [];
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
  show={showModal}
  title="Pool Details"
  onClose={handleClose}
  variant="green"
  width="800px"
>
  <div class="pool-details">
    <div class="pool-header">
      <div class="token-info">
        <TokenImages tokens={[token0, token1]} overlap={12} />
        <h3 class="token-pair">{pool.symbol_0}/{pool.symbol_1}</h3>
      </div>
      
      <div class="quick-actions">
        <Button variant="green" size="small" text="Swap" onClick={handleSwap} />
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
          <span class="stat-value">${formatToNonZeroDecimal(pool.rolling_24h_volume.toString())}</span>
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
            <TokenImages tokens={[token0]} />
            <div class="reserve-info">
              <span class="token-symbol">{pool.symbol_0}</span>
              <span class="token-amount">{formatTokenAmount(pool.balance_0, token0?.decimals || 8)}</span>
            </div>
          </div>
          <div class="reserve-item">
            <TokenImages tokens={[token1]} />
            <div class="reserve-info">
              <span class="token-symbol">{pool.symbol_1}</span>
              <span class="token-amount">{formatTokenAmount(pool.balance_1, token1?.decimals || 8)}</span>
            </div>
          </div>
        </div>
      </div>
    {:else if activeTab === 'positions'}
      <div class="positions-container">
        {#if positions.length === 0}
          <div class="empty-state">
            <p>You don't have any positions in this pool yet.</p>
            <Button 
              variant="green" 
              size="small" 
              text="Add Liquidity" 
              onClick={() => activeTab = 'add-liquidity'} 
            />
          </div>
        {:else}
          {#each positions as position}
            <div class="position-item">
              <div class="position-header">
                <span class="position-label">Position #{position.id}</span>
                <span class="position-value">${formatToNonZeroDecimal(position.value)}</span>
              </div>
              <div class="position-tokens">
                <div class="token-amount">
                  <TokenImages tokens={[token0]} />
                  <span>{formatTokenAmount(position.amount0, token0?.decimals)} {pool.symbol_0}</span>
                </div>
                <div class="token-amount">
                  <TokenImages tokens={[token1]} />
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
    @apply flex flex-col gap-6;
  }

  .pool-header {
    @apply flex justify-between items-center;
  }

  .token-info {
    @apply flex items-center gap-3;
  }

  .token-pair {
    @apply text-xl font-semibold text-white m-0;
  }

  .tabs {
    @apply flex gap-8 mb-6 relative;
    &::after {
      content: '';
      @apply absolute bottom-0 left-0 right-0 h-[1px] bg-white/20;
    }
  }

  .tab-btn {
    @apply px-2 py-3 text-white/60 relative cursor-pointer font-medium;
    @apply bg-transparent border-none transition-colors;
    @apply hover:text-white;

    &.active {
      @apply text-white;
      &::after {
        content: '';
        @apply absolute bottom-0 left-0 right-0 h-[2px] bg-white;
        z-index: 1;
      }
    }
  }

  .stats-grid {
    @apply grid grid-cols-2 md:grid-cols-4 gap-4;
  }

  .stat-item {
    @apply bg-emerald-900/50 rounded-lg p-4 flex flex-col;
  }

  .stat-label {
    @apply text-sm text-white/60;
  }

  .stat-value {
    @apply text-lg font-medium text-white;
  }

  .pool-reserves {
    @apply mt-6;
  }

  .pool-reserves h4 {
    @apply text-lg font-medium text-white mb-4;
  }

  .reserves-grid {
    @apply grid grid-cols-1 md:grid-cols-2 gap-4;
  }

  .reserve-item {
    @apply flex items-center gap-3 bg-emerald-900/30 rounded-lg p-4;
  }

  .reserve-info {
    @apply flex flex-col;
  }

  .token-symbol {
    @apply text-sm text-white/80;
  }

  .token-amount {
    @apply text-white font-medium;
  }

  .positions-container {
    @apply flex flex-col gap-4;
  }

  .empty-state {
    @apply flex flex-col items-center gap-4 py-8 text-white/60;
  }

  .position-item {
    @apply bg-emerald-900/30 rounded-lg p-4 flex flex-col gap-3;
  }

  .position-header {
    @apply flex justify-between items-center;
  }

  .position-label {
    @apply text-white/60 text-sm;
  }

  .position-value {
    @apply text-white font-medium;
  }

  .position-tokens {
    @apply flex flex-col gap-2;
  }

  .token-amount {
    @apply flex items-center gap-2 text-white;
  }
</style>
