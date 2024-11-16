<script lang="ts">
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import PoolRow from "./PoolRow.svelte";
  import { writable } from "svelte/store";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import { ArrowUp, ArrowDown, ArrowUpDown, Search, Filter } from 'lucide-svelte';
  import AddLiquidityModal from "$lib/components/liquidity/add_liquidity/AddLiquidityModal.svelte";
  import { onMount } from 'svelte';
  
  export let pools: BE.Pool[] = [];
  export let loading = false;
  export let error: string | null = null;
  export let sortColumn: string;
  export let sortDirection: "asc" | "desc";
  export let tokenMap: Map<string, any>;

  let searchTerm = "";
  let showAddLiquidityModal = false;
  let selectedTokens = { token0: '', token1: '' };
  let showMobileSort = false;
  let isMobile = false;

  function handleAddLiquidity(token0: string, token1: string) {
    selectedTokens = { token0, token1 };
    showAddLiquidityModal = true;
  }

  $: filteredPools = pools.filter(pool => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return pool.symbol_0.toLowerCase().includes(searchLower) || 
           pool.symbol_1.toLowerCase().includes(searchLower) ||
           (pool.symbol_0 + '/' + pool.symbol_1).toLowerCase().includes(searchLower);
  });

  function toggleSort(column: string) {
    if (sortColumn === column) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortColumn = column;
      sortDirection = "asc";
    }
  }

  function getSortIcon(column: string) {
    if (sortColumn !== column) return ArrowUpDown;
    return sortDirection === "asc" ? ArrowUp : ArrowDown;
  }

  $: sortedAndFilteredPools = filteredPools.sort((a, b) => {
    if (!sortColumn) return 0;
    
    const direction = sortDirection === "asc" ? 1 : -1;
    switch (sortColumn) {
      case "pool":
        return (a.symbol_0 + a.symbol_1).localeCompare(b.symbol_0 + b.symbol_1) * direction;
      case "price":
        return (Number(a.price) - Number(b.price)) * direction;
      case "tvl":
        return (Number(a.tvl) - Number(b.tvl)) * direction;
      case "volume":
        return (Number(a.volume_24h) - Number(b.volume_24h)) * direction;
      case "apy":
        return (Number(a.rolling_24h_apy) - Number(b.rolling_24h_apy)) * direction;
      default:
        return 0;
    }
  });

  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  });
</script>

<div class="table-container">
  <div class="controls-wrapper">
    <div class="controls">
      <div class="search-section">
        <div class="search-wrapper">
          <Search class="search-icon" size={18} />
          <TextInput
            id="pool-search"
            placeholder="Search by token symbol or pair..."
            bind:value={searchTerm}
            size="sm"
            variant="success"
          />
        </div>
      </div>

      {#if isMobile}
        <div class="sort-options-row">
          <button 
            class="sort-button"
            class:active={sortColumn === "pool"}
            on:click={() => toggleSort("pool")}
          >
            <span>Pool</span>
            <svelte:component this={getSortIcon("pool")} size={16} />
          </button>
          <button 
            class="sort-button"
            class:active={sortColumn === "price"}
            on:click={() => toggleSort("price")}
          >
            <span>Price</span>
            <svelte:component this={getSortIcon("price")} size={16} />
          </button>
          <button 
            class="sort-button"
            class:active={sortColumn === "tvl"}
            on:click={() => toggleSort("tvl")}
          >
            <span>TVL</span>
            <svelte:component this={getSortIcon("tvl")} size={16} />
          </button>
          <button 
            class="sort-button"
            class:active={sortColumn === "volume"}
            on:click={() => toggleSort("volume")}
          >
            <span>Volume</span>
            <svelte:component this={getSortIcon("volume")} size={16} />
          </button>
          <button 
            class="sort-button"
            class:active={sortColumn === "apy"}
            on:click={() => toggleSort("apy")}
          >
            <span>APY</span>
            <svelte:component this={getSortIcon("apy")} size={16} />
          </button>
        </div>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner" />
    </div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <!-- Desktop view -->
    <div class="table-scroll-container">
      <table class="w-full hidden md:table">
        <thead>
          <tr>
            <th class="text-left p-4">
              <button class="flex items-center gap-2" on:click={() => toggleSort("pool")}>
                <span>Pool</span>
                <svelte:component this={getSortIcon("pool")} size={16} />
              </button>
            </th>
            <th class="text-right p-4">
              <button class="flex items-center gap-2 ml-auto" on:click={() => toggleSort("price")}>
                <span>Price</span>
                <svelte:component this={getSortIcon("price")} size={16} />
              </button>
            </th>
            <th class="text-right p-4">
              <button class="flex items-center gap-2 ml-auto" on:click={() => toggleSort("tvl")}>
                <span>TVL</span>
                <svelte:component this={getSortIcon("tvl")} size={16} />
              </button>
            </th>
            <th class="text-right p-4">
              <button class="flex items-center gap-2 ml-auto" on:click={() => toggleSort("volume")}>
                <span>Volume (24h)</span>
                <svelte:component this={getSortIcon("volume")} size={16} />
              </button>
            </th>
            <th class="text-right p-4">
              <button class="flex items-center gap-2 ml-auto" on:click={() => toggleSort("apy")}>
                <span>APY</span>
                <svelte:component this={getSortIcon("apy")} size={16} />
              </button>
            </th>
            <th class="text-center p-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedAndFilteredPools as pool, i}
            <PoolRow 
              {pool} 
              {tokenMap} 
              isEven={i % 2 === 0} 
              onAddLiquidity={handleAddLiquidity} 
            />
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Mobile view -->
    <div class="mobile-scroll-container">
      {#each sortedAndFilteredPools as pool, i}
        <PoolRow 
          {pool} 
          {tokenMap} 
          isEven={i % 2 === 0} 
          onAddLiquidity={handleAddLiquidity}
        />
      {/each}
    </div>
  {/if}
</div>

{#if showAddLiquidityModal}
  <AddLiquidityModal
    showModal={showAddLiquidityModal}
    onClose={() => showAddLiquidityModal = false}
    token0={tokenMap.get(selectedTokens.token0)}
    token1={tokenMap.get(selectedTokens.token1)}
  />
{/if}

<style>
  .table-container {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    height: 70vh;
    min-height: 400px;
    min-width: 0;
    padding: 0 1rem;
  }

  .controls-wrapper {
    width: 100%;
    position: sticky;
    top: 0;
    z-index: 10;
    background: inherit;
    padding-right: 0.375rem;
    flex-shrink: 0;
  }

  .controls {
    display: flex;
    flex-direction: row; /* Changed from column to row */
    justify-content: flex-start; /* Changed from space-between to flex-start */
    align-items: center;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-shrink: 0;
  }

  .search-section {
    flex: 0 1 400px; /* Changed from flex: 1 to flex: 0 1 400px */
    width: auto; /* Changed from 100% to auto */
  }

  @media (min-width: 768px) {
    .search-section {
      max-width: 400px;
    }
  }

  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    padding: 0 1rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  /* Mobile-specific styles */
  @media (max-width: 767px) {
    .sort-options-row {
      display: flex;
      flex-wrap: nowrap;
      gap: 0.5rem;
      width: 100%;
      overflow-x: auto;
      padding-bottom: 0.5rem;
      -webkit-overflow-scrolling: touch;
    }

    .table-scroll-container {
      flex: 0 0 auto;
      display: none;
    }

    .sort-button {
      font-size: 0.75rem;
      padding: 0.5rem 0.75rem;
      white-space: nowrap;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 0.375rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .sort-button.active {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .controls {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
      padding: 0.75rem;
    }

    .search-section {
      flex: none;
      width: 100%;
    }

    .table-container {
      height: 74dvh;
      min-height: 300px;
      width: 100%;
      min-width: 320px;
    }

    .search-wrapper {
      min-width: 280px;
    }

    @media (max-width: 374px) {
      .sort-button {
        font-size: 0.7rem;
        padding: 0.4rem 0.6rem;
      }

      .search-wrapper {
        min-width: 250px;
      }
    }
  }

  /* Desktop-specific styles */
  @media (min-width: 768px) {
    .mobile-scroll-container {
      display: none;
    }
  }

  .mobile-scroll-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    width: 100%;
    min-width: 0;
  }

  /* Custom Scrollbar Styles */
  .mobile-scroll-container,
  .sort-options-row {
    /* Firefox */
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
  }

  /* Webkit (Chrome, Safari, Edge) */
  .mobile-scroll-container::-webkit-scrollbar,
  .sort-options-row::-webkit-scrollbar {
    width: 6px;  /* vertical scrollbar width */
    height: 6px; /* horizontal scrollbar height */
  }

  .mobile-scroll-container::-webkit-scrollbar-track,
  .sort-options-row::-webkit-scrollbar-track {
    background: transparent;
  }

  .mobile-scroll-container::-webkit-scrollbar-thumb,
  .sort-options-row::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.3);
    border-radius: 20px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  /* Hover state */
  .mobile-scroll-container::-webkit-scrollbar-thumb:hover,
  .sort-options-row::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.4);
  }

  /* Ensure smooth scrolling */
  .mobile-scroll-container,
  .sort-options-row {
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }
</style>
