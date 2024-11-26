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
    import { Flame, MoreVertical } from "lucide-svelte";
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
    let showSwapButton = true;
  
    onMount(() => {
      const checkMobile = () => {
        isMobile = window.innerWidth < 900;
        isSmallMobile = window.innerWidth < 640;
        showSwapButton = window.innerWidth >= 1150;
      };
      
      checkMobile();
      window.addEventListener('resize', checkMobile);
      
      return () => {
        window.removeEventListener('resize', checkMobile);
      };
    });
  
    function handleAddLiquidity() {
      onAddLiquidity(pool.address_0, pool.address_1);
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
  <tr class={isEven ? 'even' : ''}>
    <td class="pool-cell">
      <div class="pool-info">
        <TokenImages
          tokens={[tokenMap.get(pool.address_0), tokenMap.get(pool.address_1)]}
          size={24}
        />
        <div class="pool-details">
          <div class="pool-name">
            {pool.symbol_0}/{pool.symbol_1}
          </div>
        </div>
      </div>
    </td>
    <td class="price-cell">
      <div class="price-info">
        <div class="price-value">
          {formatToNonZeroDecimal(tokenMap.get(pool.address_0)?.price ?? 0)}
        </div>
        <div class="price-label">
          {pool.symbol_1} per {pool.symbol_0}
        </div>
      </div>
    </td>
    <td class="tvl-cell">
      <div class="tvl-info">
        <div class="tvl-value">
          ${formatToNonZeroDecimal(pool.tvl)}
        </div>
      </div>
    </td>
    <td class="volume-cell">
      <div class="volume-info">
        <div class="volume-value">
          ${formatToNonZeroDecimal(pool.rolling_24h_volume.toString())}
        </div>
      </div>
    </td>
    <td class="apy-cell">
      <div class="apy-info">
        <div class="apy-value">
          {formatToNonZeroDecimal(pool.rolling_24h_apy)}%
        </div>
      </div>
    </td>
    <td class="actions-cell">
      <div class="actions">
        <button
          class="action-btn add-lp"
          on:click={handleAddLiquidity}
        >
          Add LP
        </button>
        {#if showSwapButton}
          <button 
            class="action-btn swap"
            on:click={handleSwap}
          >
            Swap
          </button>
        {/if}
      </div>
    </td>
  </tr>
{:else}
  <!-- Mobile view (simplified card) -->
  <div class="mobile-pool-card">
    <div class="card-header">
      <div class="token-info">
        <TokenImages
          tokens={[tokenMap.get(pool.address_0), tokenMap.get(pool.address_1)]}
          size={32}
          overlap={12}
        />
        <div class="token-details">
          <span class="token-pair">{pool.symbol_0}/{pool.symbol_1}</span>
          <span class="tvl-badge">TVL: ${formatToNonZeroDecimal(pool.tvl)}</span>
        </div>
      </div>
      <div class="card-actions">
        <button 
          class="action-btn add-lp"
          on:click={handleAddLiquidity}
        >
          Actions
        </button>
      </div>
    </div>
  </div>
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
  tr {
    @apply transition-colors duration-150;
  }

  tr:hover {
    @apply bg-[#1a1b23];
  }

  td {
    @apply p-2 text-sm text-[#8890a4] border-b border-[#2a2d3d];
  }

  .pool-cell {
    @apply min-w-[200px];
  }

  .pool-info {
    @apply flex items-center gap-3;
  }

  .pool-details {
    @apply flex flex-col;
  }

  .pool-name {
    @apply text-white font-medium;
  }

  .pool-fee {
    @apply text-xs text-[#8890a4];
  }

  .price-info,
  .tvl-info,
  .volume-info,
  .apy-info {
    @apply flex flex-col;
  }

  .price-value,
  .tvl-value,
  .volume-value,
  .apy-value {
    @apply text-white font-medium;
  }

  .price-label {
    @apply text-xs text-[#8890a4];
  }

  .actions {
    @apply flex items-center gap-2;
  }

  .action-btn {
    @apply px-3 py-1.5 text-sm font-medium rounded-lg
           transition-all duration-150;
  }

  .add-lp {
    @apply bg-[#2a2d3d] text-white hover:bg-[#3d4154];
  }

  .swap {
    @apply bg-[#1a1b23] border border-[#2a2d3d] text-[#8890a4]
           hover:bg-[#2a2d3d] hover:text-white hover:border-[#3d4154];
  }

  /* Mobile Card Styles */
  .mobile-pool-card {
    @apply bg-[#1a1b23] rounded-lg p-3 mb-3 border border-[#2a2d3d];
  }

  .card-header {
    @apply flex items-center justify-between;
  }

  .token-info {
    @apply flex items-center gap-3;
  }

  .token-details {
    @apply flex flex-col gap-0.5;
  }

  .token-pair {
    @apply text-white font-medium;
  }

  .tvl-badge {
    @apply text-xs text-[#8890a4];
  }

  .card-actions {
    @apply flex items-center h-full;
  }

  .details-btn {
    @apply h-full px-3 text-[#8890a4] hover:text-white
           hover:bg-[#2a2d3d] transition-colors;
  }

  @media (max-width: 640px) {
    .mobile-pool-card {
      @apply p-2.5;
    }
    
    .token-info {
      @apply gap-2;
    }

    .tvl-badge {
      @apply text-[11px];
    }
  }
</style>
