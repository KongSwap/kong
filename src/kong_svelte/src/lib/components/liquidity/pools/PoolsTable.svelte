<script lang="ts">
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import PoolRow from "./PoolRow.svelte";
  import { writable } from "svelte/store";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import { ArrowUp, ArrowDown, ArrowUpDown, Search, Filter, LayoutList, LayoutGrid } from 'lucide-svelte';
  import AddLiquidityModal from "$lib/components/liquidity/add_liquidity/AddLiquidityModal.svelte";
  import { onMount } from 'svelte';
  import Button from "$lib/components/common/Button.svelte";

  export let pools: BE.Pool[] = [];
  export let loading = false;
  export let error: string | null = null;
  export let sortColumn: string;
  export let sortDirection: "asc" | "desc";
  export let tokenMap: Map<string, any>;

  let searchTerm = "";
  let showAddLiquidityModal = false;
  let selectedTokens = { token0: '', token1: '' };
  let forceCardView = false;
  let isCardView = false;

  const activeTab = writable("all_pools");

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
        if (a.rolling_24h_volume < b.rolling_24h_volume) return -1 * direction;
        if (a.rolling_24h_volume > b.rolling_24h_volume) return 1 * direction;
        return 0;
      case "apy":
        return (Number(a.rolling_24h_apy) - Number(b.rolling_24h_apy)) * direction;
      default:
        return 0;
    }
  });

  onMount(() => {
    const checkView = () => {
      if (typeof window !== 'undefined') {
        isCardView = window.innerWidth < 900 || forceCardView;
      }
    };
    checkView();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkView);
      return () => window.removeEventListener('resize', checkView);
    }
  });

  const sortOptions = [
    { label: "Pool", value: "pool" },
    { label: "Price", value: "price" },
    { label: "TVL", value: "tvl" },
    { label: "Volume (24h)", value: "volume" },
    { label: "APY", value: "apy" }
  ];

  $: {
    if (typeof window !== 'undefined') {
      isCardView = window.innerWidth < 1250 || forceCardView;
    }
  }
</script>

<div class="table-container">
  <div class="controls-wrapper" style="position: relative; z-index: 1;">
    <div class="controls-top">
      <div class="mode-selector" style="position: relative; z-index: 1;">
        <Button
          variant="yellow"
          size="medium"
          state={$activeTab === "all_pools" ? "selected" : "default"}
          onClick={() => activeTab.set("all_pools")}
          width="50%"
        >
          All Pools
        </Button>
        <Button
          variant="yellow"
          size="medium"
          state={$activeTab === "your_pools" ? "selected" : "default"}
          onClick={() => activeTab.set("your_pools")}
          width="50%"
        >
          Your Pools
        </Button>
      </div>
      <div class="search-wrapper" class:full-width={isCardView}>
        <div class="search-input-container">
          <button class="search-button">
            <Search size={18} />
          </button>
          <TextInput
            id="pool-search"
            placeholder="Search by token symbol or pair..."
            bind:value={searchTerm}
            size="sm"
            variant="success"
          />
        </div>
      </div>
    </div>

    {#if isCardView}
      <div class="mobile-sort-controls">
        <div class="top-row">
          <button 
            class="sort-button {sortColumn === 'pool' ? 'active' : ''}"
            on:click={() => toggleSort('pool')}
          >
            <span>Pool</span>
            <svelte:component this={getSortIcon('pool')} size={16} />
          </button>
          <button 
            class="sort-button {sortColumn === 'price' ? 'active' : ''}"
            on:click={() => toggleSort('price')}
          >
            <span>Price</span>
            <svelte:component this={getSortIcon('price')} size={16} />
          </button>
          <button 
            class="sort-button {sortColumn === 'tvl' ? 'active' : ''}"
            on:click={() => toggleSort('tvl')}
          >
            <span>TVL</span>
            <svelte:component this={getSortIcon('tvl')} size={16} />
          </button>
        </div>
        <div class="bottom-row">
          <button 
            class="sort-button {sortColumn === 'volume' ? 'active' : ''}"
            on:click={() => toggleSort('volume')}
          >
            <span>Volume (24h)</span>
            <svelte:component this={getSortIcon('volume')} size={16} />
          </button>
          <button 
            class="sort-button {sortColumn === 'apy' ? 'active' : ''}"
            on:click={() => toggleSort('apy')}
          >
            <span>APY</span>
            <svelte:component this={getSortIcon('apy')} size={16} />
          </button>
        </div>
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="content-area">
      <div class="loading">
        <div class="spinner" />
      </div>
    </div>
  {:else if error}
    <div class="content-area">
      <div class="error">{error}</div>
    </div>
  {:else}
    {#if !isCardView}
      <!-- Desktop Table View -->
      <div class="table-wrapper">
        <table class="w-full">
          <thead class="table-header" style="position: sticky; top: 0; z-index: 1;">
            <tr>
              <th class="text-left p-4 w-[22%]">
                <button class="header-button" on:click={() => toggleSort("pool")}>
                  <span>Pool</span>
                  <svelte:component this={getSortIcon("pool")} size={16} class="sort-icon" />
                </button>
              </th>
              <th class="text-right p-4 w-[15%]">
                <button class="header-button" on:click={() => toggleSort("price")}>
                  <span>Price</span>
                  <svelte:component this={getSortIcon("price")} size={16} class="sort-icon" />
                </button>
              </th>
              <th class="text-right p-4 w-[15%]">
                <button class="header-button" on:click={() => toggleSort("tvl")}>
                  <span>TVL</span>
                  <svelte:component this={getSortIcon("tvl")} size={16} class="sort-icon" />
                </button>
              </th>
              <th class="text-right p-4 w-[15%]">
                <button class="header-button" on:click={() => toggleSort("volume")}>
                  <span>Volume (24h)</span>
                  <svelte:component this={getSortIcon("volume")} size={16} class="sort-icon" />
                </button>
              </th>
              <th class="text-right p-4 w-[15%]">
                <button class="header-button" on:click={() => toggleSort("apy")}>
                  <span>APY</span>
                  <svelte:component this={getSortIcon("apy")} size={16} class="sort-icon" />
                </button>
              </th>
              <th class="text-center p-4">Actions</th>
            </tr>
          </thead>
          <tbody class="table-body">
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
    {:else}
      <div class="card-body-wrapper">
        <div class="card-container">
          {#each sortedAndFilteredPools as pool, i}
            <PoolRow 
              {pool} 
              {tokenMap} 
              isEven={i % 2 === 0} 
              onAddLiquidity={handleAddLiquidity}
            />
          {/each}
        </div>
      </div>
    {/if}
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
    gap: 0.69rem;
    padding: 0 0.69rem;
    position: relative;
    z-index: 1;
  }

  .table-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .table-header {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--background-color-darker, #111111);
    backdrop-filter: blur(8px);
  }

  .table-header::after {
    display: none;
  }

  .card-body-wrapper {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding-right: 6px;
  }

  .card-container {
    display: flex;
    flex-direction: column;
  }

  .search-wrapper {
    position: relative;
    width: 100%;
    max-width: 400px;
  }

  .search-wrapper.full-width {
    max-width: 100%;
  }

  .search-input-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input-container :global(input) {
    width: 100%;
    height: 40px;
    padding: 0.5rem 1rem 0.5rem 3rem;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.5rem;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
  }

  .search-button {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.5);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease;
  }

  .search-button:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  .search-input-container :global(input::placeholder) {
    color: rgba(255, 255, 255, 0.5);
  }

  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
  }

  .spinner {
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-left-color: #000;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .error {
    color: red;
    text-align: center;
  }

  .controls-wrapper {
    @apply flex flex-col gap-3 w-full relative;
    z-index: 1;
  }

  .mobile-sort-controls {
    @apply flex flex-col gap-2 w-full;
  }

  .mobile-sort-controls .top-row {
    @apply grid grid-cols-3 gap-2 w-full;
  }

  .mobile-sort-controls .bottom-row {
    @apply grid grid-cols-2 gap-2 w-full;
  }

  .sort-button {
    @apply flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg 
           bg-emerald-900/30 border border-emerald-900/50 text-sm font-medium 
           transition-colors hover:bg-emerald-900/40 w-full;
  }

  .sort-button.active {
    @apply bg-emerald-600/30 border-emerald-600;
  }

  @media (max-width: 640px) {
    .table-container {
      margin-top: 0.69rem;
    }

    .controls-wrapper {
      @apply gap-2;
    }

    .mobile-sort-controls {
      @apply gap-1.5;
    }

    .sort-button {
      @apply px-2 py-1 text-xs;
    }

    .card-body-wrapper {
      padding-right: 0;
    }
  }

  @media (max-width: 1250px) {
    .controls-top {
      @apply flex-col items-stretch;
    }
    
    .mode-selector {
      width: 100%;
      min-width: unset;
    }

    .mode-selector :global(button) {
      flex: 1;
      width: 100% !important;
    }

    .search-wrapper {
      width: 100%;
      max-width: 100%;
    }
  }

  .table-body-wrapper,
  .card-body-wrapper {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .table-body-wrapper::-webkit-scrollbar,
  .card-body-wrapper::-webkit-scrollbar {
    width: 6px;
  }

  .table-body-wrapper::-webkit-scrollbar-track,
  .card-body-wrapper::-webkit-scrollbar-track {
    background: transparent;
  }

  .table-body-wrapper::-webkit-scrollbar-thumb,
  .card-body-wrapper::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .table-container {
    height: calc(100vh - 120px);
    max-height: 70vh;
  }

  @media (max-width: 640px) {
    .table-body-wrapper,
    .card-body-wrapper {
      scrollbar-width: none;
    }

    .table-body-wrapper::-webkit-scrollbar,
    .card-body-wrapper::-webkit-scrollbar {
      display: none;
    }
  }

  :global(.pool-row-card) {
    width: 100%;
  }

  .controls-top {
    @apply flex items-center justify-between gap-4 w-full;
  }

  .view-toggle {
    @apply flex gap-1 bg-emerald-900/30 p-1 rounded-lg border border-emerald-900/50;
  }

  .toggle-button {
    @apply p-1.5 rounded-md transition-colors hover:bg-emerald-900/40;
  }

  .toggle-button.active {
    @apply bg-emerald-600/30;
  }

  th button {
    @apply hover:text-emerald-400 transition-colors;
  }

  tr:nth-child(even) {
    background: rgba(0, 0, 0, 0.2);
  }

  .header-button {
    @apply flex items-center gap-2 px-2 py-1 rounded-md transition-all duration-200
           hover:bg-emerald-900/30 hover:text-emerald-400 w-full;
  }

  th:not(:first-child) .header-button {
    @apply justify-end;
  }

  .sort-icon {
    @apply opacity-50 transition-opacity;
  }

  .header-button:hover .sort-icon {
    @apply opacity-100;
  }

  th {
    @apply font-medium text-sm text-gray-300;
  }

  .table-header {
    @apply bg-black/40 backdrop-blur-sm;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* Add table layout styles */
  .table-wrapper table {
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
  }

  .mode-selector {
    display: flex;
    gap: 8px;
    min-width: 300px;
    position: relative;
    z-index: 1;
  }

  .controls-top {
    @apply flex items-center gap-4 w-full flex-wrap;
  }
</style>
