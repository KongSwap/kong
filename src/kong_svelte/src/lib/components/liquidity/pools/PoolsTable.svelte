<script lang="ts">
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import PoolRow from "./PoolRow.svelte";
  import { writable } from "svelte/store";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import { ArrowUp, ArrowDown, ArrowUpDown, Search, Filter, LayoutList, LayoutGrid } from 'lucide-svelte';
  import AddLiquidityModal from "$lib/components/liquidity/add_liquidity/AddLiquidityModal.svelte";
  import { onMount, onDestroy } from 'svelte';
  import Button from "$lib/components/common/Button.svelte";

  export let pools: BE.Pool[] = [];
  export let loading = false;
  export let error: string | null = null;
  export let sortColumn: string;
  export let sortDirection: "asc" | "desc";
  export let tokenMap: Map<string, any>;

  let searchTerm = "";
  let searchDebounceTimer: NodeJS.Timeout;
  let debouncedSearchTerm = "";
  let showAddLiquidityModal = false;
  let selectedTokens = { token0: '', token1: '' };
  let forceCardView = false;
  let isCardView = false;

  const activeTab = writable("all_pools");

  function handleAddLiquidity(token0: string, token1: string) {
    selectedTokens = { token0, token1 };
    showAddLiquidityModal = true;
  }

  $: {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchTerm = searchTerm.trim().toLowerCase();
    }, 300);
  }

  $: filteredPools = pools.filter(pool => {
    if (!debouncedSearchTerm) return true;
    
    const searchMatches = [
      pool.symbol_0.toLowerCase(),                    // Token 0 symbol
      pool.symbol_1.toLowerCase(),                    // Token 1 symbol
      `${pool.symbol_0}/${pool.symbol_1}`.toLowerCase(), // Full pair name
      `${pool.symbol_1}/${pool.symbol_0}`.toLowerCase(), // Reverse pair name
      pool.address_0?.toLowerCase() || '',              // Pool address
      pool.address_1?.toLowerCase() || ''       // Token 1 address
    ];

    return searchMatches.some(match => match.includes(debouncedSearchTerm));
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

  onDestroy(() => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
  });
</script>

<div class="table-container">
  <div class="controls-wrapper" style="position: relative; z-index: 1;">
    <div class="controls-top">
      <div class="mode-selector" style="position: relative; z-index: 1;">
        <Button
          variant="blue"
          size="medium"
          state={$activeTab === "all_pools" ? "selected" : "default"}
          onClick={() => activeTab.set("all_pools")}
        >
          All Pools
        </Button>
        <Button
          variant="yellow"
          size="medium"
          state={$activeTab === "your_pools" ? "selected" : "default"}
          onClick={() => activeTab.set("your_pools")}
        >
          Your Pools
        </Button>
      </div>
      <div class="flex-spacer"></div>
      <div class="search-wrapper">
        <div class="search-input-container">
          <TextInput
            id="pool-search"
            placeholder="Search by token symbol, pair, or address..."
            bind:value={searchTerm}
            size="sm"
            variant="success"
          />
          <Search size={16} class="search-icon" color="white" />
        </div>
      </div>
    </div>
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
              <th class="text-left p-2 w-[25%]">
                <button class="header-button" on:click={() => toggleSort("pool")}>
                  <span>Pool</span>
                  <svelte:component this={getSortIcon("pool")} size={16} class="sort-icon" />
                </button>
              </th>
              <th class="text-right p-2 w-[15%]">
                <button class="header-button" on:click={() => toggleSort("price")}>
                  <span>Price</span>
                  <svelte:component this={getSortIcon("price")} size={16} class="sort-icon" />
                </button>
              </th>
              <th class="text-right p-2 w-[15%]">
                <button class="header-button" on:click={() => toggleSort("tvl")}>
                  <span>TVL</span>
                  <svelte:component this={getSortIcon("tvl")} size={16} class="sort-icon" />
                </button>
              </th>
              <th class="text-right p-2 w-[15%]">
                <button class="header-button" on:click={() => toggleSort("volume")}>
                  <span>Volume (24h)</span>
                  <svelte:component this={getSortIcon("volume")} size={16} class="sort-icon" />
                </button>
              </th>
              <th class="text-right p-2 w-[15%]">
                <button class="header-button" on:click={() => toggleSort("apy")}>
                  <span>APY</span>
                  <svelte:component this={getSortIcon("apy")} size={16} class="sort-icon" />
                </button>
              </th>
              <th class="text-right p-2 w-[15%]">Actions</th>
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
    onClose={() => {
      showAddLiquidityModal = false;
    }}
    initialToken0={tokenMap.get(selectedTokens.token0)}
    initialToken1={tokenMap.get(selectedTokens.token1)}
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
    width: 28rem;
    transition: all 0.2s ease;
  }

  .search-input-container {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    border-radius: 0.75rem;
    transition: all 0.2s ease;
    border: 1px solid rgba(59, 130, 246, 0.1);
    padding-right: 1rem;
  }

  .search-input-container:hover,
  .search-input-container:focus-within {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.2);
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
  }

  .search-input-container :global(input) {
    width: 100%;
    padding: 0.75rem 4rem 0.75rem 1rem !important;
    background: transparent;
    border: none !important;
    font-size: 0.925rem;
    color: rgb(209, 213, 219);
  }

  .search-input-container :global(input::placeholder) {
    color: rgba(209, 213, 219, 0.5);
  }

  .search-input-container :global(.input-wrapper) {
    width: 100%;
    border: none !important;
    background: transparent !important;
  }

  .search-input-container :global(input:focus) {
    outline: none;
    box-shadow: none !important;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .search-wrapper {
      max-width: 100%;
    }

    .search-input-container {
      border-radius: 0.5rem;
    }

    .search-input-container :global(input) {
      padding: 0.625rem 4rem 0.625rem 1rem !important;
      font-size: 0.875rem;
    }
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
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    position: relative;
    margin-bottom: 0.5rem;
  }

  .controls-top {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    flex-wrap: nowrap;
  }

  .flex-spacer {
    flex: 1;
  }

  .mode-selector {
    display: flex;
    gap: 8px;
    min-width: auto;
    position: relative;
    z-index: 1;
  }

  th {
    font-weight: 500;
    font-size: 0.875rem;
    color: rgb(209, 213, 219);
    padding: 0.5rem;
  }

  .header-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    width: 100%;
  }

  .header-button:hover {
    background-color: rgba(59, 130, 246, 0.15);
    color: rgb(96, 165, 250);
  }

  th button {
    transition: color 0.2s;
  }

  th button:hover {
    color: rgb(96, 165, 250);
  }

  tr:nth-child(even) {
    background: rgba(0, 0, 0, 0.2);
  }

  th:not(:first-child) .header-button {
    justify-content: flex-end;
  }

  .table-header {
    background-color: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .table-wrapper table {
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
  }

  .mode-selector {
    display: flex;
    gap: 8px;
    min-width: auto;
    position: relative;
    z-index: 1;
  }

  .controls-top {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    flex-wrap: wrap;
  }

  @media (max-width: 1250px) {
    .controls-top {
      flex-direction: row;
      align-items: center;
    }
    
    .mode-selector {
      flex: none;
    }

    .search-wrapper {
      flex: 1;
    }
  }

  @media (max-width: 640px) {
    .controls-top {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }

    .mode-selector {
      width: 100%;
      margin: 0;
    }

    .mode-selector :global(button) {
      flex: 1;
      padding: 0.625rem 0.5rem;
    }

    .controls-wrapper {
      gap: 0.375rem;
      margin-bottom: 0.375rem;
    }

    .search-wrapper {
      width: 100%;
      max-width: 100%;
    }

    .card-body-wrapper {
      scrollbar-width: none;
    }

    .card-body-wrapper::-webkit-scrollbar {
      display: none;
    }
  }

  .table-body-wrapper,
  .card-body-wrapper {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .card-body-wrapper::-webkit-scrollbar {
    width: 6px;
  }

  .card-body-wrapper::-webkit-scrollbar-track {
    background: transparent;
  }

  .card-body-wrapper::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .table-container {
    height: calc(100vh - 120px);
    max-height: 70vh;
  }

  @media (max-width: 640px) {
    .search-input-container :global(input) {
      padding: 0.625rem 4rem 0.625rem 1rem !important;
    }
  }

  .mode-selector :global(.tab-button) {
    padding: 0.75rem 1.25rem;  /* Match search input height */
    height: 100%;
    min-height: 2.75rem;  /* Ensure minimum height */
    display: flex;
    align-items: center;
  }

  @media (max-width: 640px) {
    .mode-selector :global(.tab-button) {
      padding: 0.625rem 1rem;  /* Slightly smaller for mobile */
      min-height: 2.5rem;
    }
  }
</style>
