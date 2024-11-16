<script lang="ts">
    import { goto } from "$app/navigation";
    import {
      formatTokenAmount,
      formatToNonZeroDecimal,
    } from "$lib/utils/numberFormatUtils";
    import TokenImages from "$lib/components/common/TokenImages.svelte";
    import Button from "$lib/components/common/Button.svelte";
    import Modal from "$lib/components/common/Modal.svelte";
    import PoolDetails from "$lib/components/liquidity/pools/PoolDetails.svelte";
    import { Flame } from "lucide-svelte";
    import AddLiquidityModal from "$lib/components/liquidity/add_liquidity/AddLiquidityModal.svelte";
    import { onMount } from 'svelte';
  
    export let pool: BE.Pool & { tvl?: number };
    export let tokenMap: Map<string, any>;
    export let isEven: boolean;
    export let onAddLiquidity: (token0: string, token1: string) => void;
  
    let showPoolDetails = false;
    let showAddLiquidity = false;
    let isMobile = false;
    let isSmallMobile = false;
    let isTableCompact = false;
    let hideSwap = false;
  
    onMount(() => {
      const checkMobile = () => {
        isMobile = window.innerWidth < 1000;
      };
      
      checkMobile();
      window.addEventListener('resize', checkMobile);
      
      return () => {
        window.removeEventListener('resize', checkMobile);
      };
    });
  
    function handleAddLiquidity() {
      showAddLiquidity = true;
    }
  
    function handleAddLiquidityClose() {
      showAddLiquidity = false;
    }
  
    function handleSwap() {
      if (pool.address_0 && pool.address_1) {
        goto(`/swap?from=${pool.address_0}&to=${pool.address_1}`);
      }
    }
  
    function handleClose() {
      showPoolDetails = false;
    }
  
    function handleViewDetails() {
      showPoolDetails = true;
    }
  
    $: apyColor =
      pool.rolling_24h_apy > 100
        ? "#FFD700"
        : pool.rolling_24h_apy > 50
          ? "#FFA500"
          : "#FF8C00";
</script>

{#if !isMobile}
  <!-- Desktop view (table row) -->
  <tr class="pool-row {isEven ? 'even' : ''}">
    <td class="w-[44px] pl-2 sm:pl-3.5">
      <div class="token-info">
        <TokenImages
          tokens={[tokenMap.get(pool.address_0), tokenMap.get(pool.address_1)]}
          size={isTableCompact ? 32 : 40}
          overlap={isTableCompact ? 12 : 16}
        />
        <div class="flex flex-col">
          <span class="token-pair text-base sm:text-lg font-bold">{pool.symbol_0}/{pool.symbol_1}</span>
        </div>
      </div>
    </td>
    <td class="value-cell">
      ${formatToNonZeroDecimal(tokenMap.get(pool.address_0)?.price ?? 0)}
    </td>
    <td class="value-cell">
      ${formatToNonZeroDecimal(pool.tvl)}
    </td>
    <td class="value-cell">
      ${formatToNonZeroDecimal(pool.rolling_24h_volume.toString())}
    </td>
    <td class="value-cell">
      <div style="display: flex; justify-content: flex-end;">
        <span class="apy-badge" style="background-color: {apyColor}">
          {formatToNonZeroDecimal(pool.rolling_24h_apy)}%
        </span>
      </div>
    </td>
    <td>
      <div class="actions">
        <Button
          variant="green"
          size="small"
          text="Add LP"
          onClick={handleAddLiquidity}
          className="action-button"
        />
        {#if !hideSwap}
          <Button 
            variant="green" 
            size="small" 
            text="Swap" 
            onClick={handleSwap}
            className="action-button"
          />
        {/if}
        {#if !isTableCompact}
          <Button 
            variant="green"
            size="small" 
            text="Details" 
            onClick={handleViewDetails}
            className="action-button"
          />
        {/if}
      </div>
    </td>
  </tr>
{:else}
  <!-- Mobile view (card) -->
  <div class="mobile-pool-card">
    <div class="card-header">
      <div class="token-info">
        <TokenImages
          tokens={[tokenMap.get(pool.address_0), tokenMap.get(pool.address_1)]}
          size={isSmallMobile ? 32 : 40}
          overlap={isSmallMobile ? 12 : 16}
        />
        <div class="token-info-text">
          <span class="token-pair">{pool.symbol_0}/{pool.symbol_1}</span>
        </div>
        <Button 
          variant="green"
          size="small"
          text="Details"
          onClick={handleViewDetails}
          className="header-details-button ml-auto"
        />
      </div>
    </div>

    <div class="card-stats">
      <div class="stat-row">
        <div class="stat-item">
          <span class="stat-label">Price</span>
          <span class="stat-value">${formatToNonZeroDecimal(tokenMap.get(pool.address_0)?.price ?? 0)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">TVL</span>
          <span class="stat-value">${formatToNonZeroDecimal(pool.tvl)}</span>
        </div>
      </div>
      
      <div class="stat-row">
        <div class="stat-item">
          <span class="stat-label">Volume (24h)</span>
          <span class="stat-value">${formatToNonZeroDecimal(pool.rolling_24h_volume.toString())}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">APY</span>
          <span class="apy-badge" style="background-color: {apyColor}">
            {formatToNonZeroDecimal(pool.rolling_24h_apy)}%
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showAddLiquidity}
  <AddLiquidityModal
    showModal={showAddLiquidity}
    onClose={handleAddLiquidityClose}
    token0={tokenMap.get(pool.address_0)}
    token1={tokenMap.get(pool.address_1)}
  />
{/if}

{#if showPoolDetails}
  <PoolDetails 
    showModal={showPoolDetails} 
    onClose={handleClose}
    {pool}
    {tokenMap}
  />
{/if}

<style lang="postcss">
  .pool-row {
    @apply border-b border-emerald-900/30 transition-colors duration-150;
  }

  .pool-row:hover {
    @apply bg-emerald-800/10;
  }

  .pool-row.even {
    @apply bg-emerald-900/30;
  }

  .mobile-pool-card {
    @apply bg-emerald-900/20 rounded-lg sm:rounded-xl flex flex-col border border-emerald-900/30 
           shadow-lg mb-3 sm:mb-4 overflow-hidden;
    width: 100%;
  }

  .card-header {
    @apply p-2 sm:p-3 md:p-4 border-b border-emerald-900/30 bg-emerald-900/10;
  }

  .token-info {
    @apply flex items-center gap-1.5 sm:gap-3 w-full;
  }

  .token-info-text {
    @apply flex flex-col items-start gap-0.5 min-w-0 flex-1;
  }

  .token-pair {
    @apply text-sm sm:text-base md:text-xl font-bold text-white leading-tight truncate w-full;
  }

  .card-stats {
    @apply flex flex-col gap-1.5 sm:gap-2 p-2 sm:p-3 md:p-4 border-b border-emerald-900/30;
    min-width: 0;
  }

  .stat-row {
    @apply grid grid-cols-2 gap-1.5 sm:gap-2 md:gap-4;
    min-width: 0;
  }

  .stat-item {
    @apply flex flex-col items-start text-left p-1.5 sm:p-2 rounded-lg bg-emerald-900/20;
    min-width: 0;
  }

  .stat-label {
    @apply text-xs text-emerald-300/70 font-medium;
  }

  .stat-value {
    @apply text-white font-bold font-mono text-xs sm:text-sm md:text-base truncate w-full;
    word-break: break-word;
  }

  .apy-badge {
    @apply px-2 py-0.5 sm:px-3 sm:py-1 md:px-4 md:py-1.5 rounded-lg font-bold font-mono 
           text-black text-xs sm:text-sm shadow-sm;
  }

  .value-cell {
    @apply px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-right font-mono text-white font-medium text-sm sm:text-base;
  }

  .actions {
    @apply flex justify-center gap-1.5 sm:gap-2 p-2 sm:p-4;
  }

  @media (max-width: 374px) {
    .token-pair {
      @apply text-xs sm:text-sm;
    }

    .stat-value {
      @apply text-xs;
    }

    .stat-label {
      @apply text-[10px];
    }

    .stat-item {
      @apply p-1;
    }
  }

  @media (max-width: 480px) {
    .card-stats {
      @apply p-2;
    }

    .stat-row {
      @apply gap-1;
    }

    .stat-item {
      @apply p-1;
    }
  }
</style>
