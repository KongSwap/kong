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
  let isCardView = false;

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
    const checkView = () => {
      isCardView = window.innerWidth < 1250;
    };
    checkView();
    window.addEventListener('resize', checkView);
    return () => window.removeEventListener('resize', checkView);
  });

  const sortOptions = [
    { label: "Pool", value: "pool" },
    { label: "Price", value: "price" },
    { label: "TVL", value: "tvl" },
    { label: "Volume (24h)", value: "volume" },
    { label: "APY", value: "apy" }
  ];
</script>

<div class="table-container">
  <div class="controls-wrapper">
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

    {#if isCardView}
      <div class="mobile-sort-controls">
        {#each sortOptions as option}
          <button 
            class="sort-button {sortColumn === option.value ? 'active' : ''}"
            on:click={() => toggleSort(option.value)}
          >
            <span>{option.label}</span>
            <svelte:component this={getSortIcon(option.value)} size={16} />
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner" />
    </div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    {#if !isCardView}
      <!-- Desktop Table View -->
      <div class="table-scroll-container">
        <table class="w-full">
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
    {:else}
      <!-- Card View -->
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
    gap: 1rem;
    height: 70vh;
  }

  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    padding: 0 1rem;
    max-width: 400px;
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
    @apply flex flex-col gap-3 w-full;
  }

  .mobile-sort-controls {
    @apply flex flex-wrap gap-2 w-full;
  }

  .sort-button {
    @apply flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/30 
           border border-emerald-900/50 text-sm font-medium transition-colors
           hover:bg-emerald-900/40;
  }

  .sort-button.active {
    @apply bg-emerald-600/30 border-emerald-600;
  }

  @media (max-width: 640px) {
    .controls-wrapper {
      @apply gap-2;
    }

    .mobile-sort-controls {
      @apply gap-1.5;
    }

    .sort-button {
      @apply px-2 py-1 text-xs;
    }
  }
</style>
