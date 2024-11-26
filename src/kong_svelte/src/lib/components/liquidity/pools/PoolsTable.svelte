<script lang="ts">
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import PoolRow from "./PoolRow.svelte";
  import { writable } from "svelte/store";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import { ArrowUp, ArrowDown, ArrowUpDown, Filter, LayoutList, LayoutGrid } from 'lucide-svelte';
  import AddLiquidityModal from "$lib/components/liquidity/add_liquidity/AddLiquidityModal.svelte";
  import { onMount } from 'svelte';
  import Button from "$lib/components/common/Button.svelte";
  import { debounce } from 'lodash';

  export let pools: BE.Pool[] = [];
  export let loading = false;
  export let error: string | null = null;
  export let sortColumn: string;
  export let sortDirection: "asc" | "desc";
  export let tokenMap: Map<string, any>;

  let searchTerm = "";
  let searchInput: HTMLInputElement;
  let showAddLiquidityModal = false;
  let selectedTokens = { token0: '', token1: '' };
  let forceCardView = false;
  let isCardView = false;

  const activeTab = writable("all_pools");

  let debouncedSearchTerm = "";

  const updateDebouncedSearch = debounce((value: string) => {
    debouncedSearchTerm = value;
  }, 300);

  $: {
    updateDebouncedSearch(searchTerm);
  }

  $: filteredPools = pools.filter(pool => {
    if (!debouncedSearchTerm) return true;
    
    const searchTerms = debouncedSearchTerm.toLowerCase().split(/[\s,]+/).filter(Boolean);
    
    return searchTerms.every(term => {
      const symbolMatch = 
        pool.symbol_0.toLowerCase().includes(term) ||
        pool.symbol_1.toLowerCase().includes(term) ||
        `${pool.symbol_0}/${pool.symbol_1}`.toLowerCase().includes(term);

      const addressMatch =
        pool.token_0.toLowerCase().includes(term) ||
        pool.token_1.toLowerCase().includes(term);

      const token0Data = tokenMap.get(pool.token_0);
      const token1Data = tokenMap.get(pool.token_1);
      const nameMatch =
        token0Data?.name?.toLowerCase().includes(term) ||
        token1Data?.name?.toLowerCase().includes(term);

      return symbolMatch || addressMatch || nameMatch;
    });
  });

  function handleAddLiquidity(token0: string, token1: string) {
    selectedTokens = { token0, token1 };
    showAddLiquidityModal = true;
  }

  function toggleSort(column: string) {
    if (sortColumn === column) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortColumn = column;
      sortDirection = "asc";
    }
  }

  function getSortIcon(column: string) {
    if (sortColumn === column) {
      return sortDirection === "asc" ? ArrowUp : ArrowDown;
    }
    return ArrowUpDown;
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

  function handleKeydown(event: KeyboardEvent) {
    // Clear search on Escape
    if (event.key === 'Escape' && searchTerm) {
      event.preventDefault();
      searchTerm = '';
      searchInput.focus();
    }
    // Focus search on forward slash
    else if (event.key === '/' && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
  }
</script>

<div class="table-container">
  <div class="controls">
    <div class="controls-top">
      <div class="tab-group">
        <button
          class="tab-btn {$activeTab === 'all_pools' ? 'active' : ''}"
          on:click={() => activeTab.set('all_pools')}
        >
          All Pools
        </button>
        <button
          class="tab-btn {$activeTab === 'your_pools' ? 'active' : ''}"
          on:click={() => activeTab.set('your_pools')}
        >
          Your Pools
        </button>
        <div class="search-container">
          <input
            bind:this={searchInput}
            bind:value={searchTerm}
            type="text"
            placeholder="Search pools..."
            class="search-input"
            on:keydown={handleKeydown}
          />
        </div>
      </div>
    </div>

    {#if isCardView}
      <div class="sort-controls">
        <div class="sort-row">
          <button 
            class="sort-btn {sortColumn === 'pool' ? 'active' : ''}"
            on:click={() => toggleSort('pool')}
          >
            Pool
            <svelte:component this={getSortIcon('pool')} size={16} />
          </button>
          <button 
            class="sort-btn {sortColumn === 'price' ? 'active' : ''}"
            on:click={() => toggleSort('price')}
          >
            Price
            <svelte:component this={getSortIcon('price')} size={16} />
          </button>
          <button 
            class="sort-btn {sortColumn === 'tvl' ? 'active' : ''}"
            on:click={() => toggleSort('tvl')}
          >
            TVL
            <svelte:component this={getSortIcon('tvl')} size={16} />
          </button>
        </div>
        <div class="sort-row">
          <button 
            class="sort-btn {sortColumn === 'volume' ? 'active' : ''}"
            on:click={() => toggleSort('volume')}
          >
            Volume (24h)
            <svelte:component this={getSortIcon('volume')} size={16} />
          </button>
          <button 
            class="sort-btn {sortColumn === 'apy' ? 'active' : ''}"
            on:click={() => toggleSort('apy')}
          >
            APY
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
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>
                <button class="th-btn" on:click={() => toggleSort('pool')}>
                  Pool
                  <svelte:component this={getSortIcon('pool')} size={16} class="sort-icon" />
                </button>
              </th>
              <th>
                <button class="th-btn" on:click={() => toggleSort('price')}>
                  Price
                  <svelte:component this={getSortIcon('price')} size={16} class="sort-icon" />
                </button>
              </th>
              <th>
                <button class="th-btn" on:click={() => toggleSort('tvl')}>
                  TVL
                  <svelte:component this={getSortIcon('tvl')} size={16} class="sort-icon" />
                </button>
              </th>
              <th>
                <button class="th-btn" on:click={() => toggleSort('volume')}>
                  Volume (24h)
                  <svelte:component this={getSortIcon('volume')} size={16} class="sort-icon" />
                </button>
              </th>
              <th>
                <button class="th-btn" on:click={() => toggleSort('apy')}>
                  APY
                  <svelte:component this={getSortIcon('apy')} size={16} class="sort-icon" />
                </button>
              </th>
              <th>Actions</th>
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
      <div class="cards-grid">
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
    onClose={() => {
      showAddLiquidityModal = false;
    }}
    initialToken0={tokenMap.get(selectedTokens.token0)}
    initialToken1={tokenMap.get(selectedTokens.token1)}
  />
{/if}

<style lang="postcss">
  .table-container {
    @apply w-full max-w-[1400px] mx-auto flex flex-col h-full;
  }

  .controls {
    @apply mb-2 space-y-2 flex-shrink-0;
  }

  .controls-top {
    @apply flex flex-col sm:flex-row gap-2 mr-2;
  }

  .tab-group {
    @apply flex items-center justify-between bg-[#1a1b23] rounded-lg p-1 w-full;
  }

  .tab-btn {
    @apply px-4 py-2.5 text-sm font-medium rounded-md
           transition-all duration-150 text-[#8890a4];
  }

  .tab-btn.active {
    @apply bg-[#2a2d3d] text-white;
  }

  .tab-btn:not(.active) {
    @apply hover:bg-[#2a2d3d]/50 hover:text-white;
  }

  .search-container {
    @apply relative ml-auto;
  }

  .search-input {
    @apply w-64 px-4 py-2 rounded-lg bg-white/5 text-white 
           placeholder-white/40 border border-white/10 
           focus:border-white/20 focus:outline-none
           transition-all duration-200;
  }

  .sort-controls {
    @apply space-y-2 bg-[#1a1b23] border border-[#2a2d3d] rounded-lg p-3;
  }

  .sort-row {
    @apply flex gap-2;
  }

  .sort-btn {
    @apply flex-1 flex items-center justify-between px-3 py-2
           bg-[#1a1b23] border border-[#2a2d3d] rounded text-sm 
           text-[#8890a4] transition-all duration-150;
  }

  .sort-btn:hover {
    @apply bg-[#2a2d3d]/50 text-white border-[#3d4154];
  }

  .sort-btn.active {
    @apply bg-[#2a2d3d] text-white border-[#3d4154];
  }

  .table-wrapper {
    @apply w-full overflow-x-auto rounded-lg min-w-[1000px]
           flex-grow relative bg-[#1a1b23]/80;
    height: calc(100% - 2rem); /* Account for controls margin */
  }

  table {
    @apply w-full relative;
  }

  thead {
    @apply bg-[#1a1b23] sticky top-0 z-10
           backdrop-blur-md shadow-lg;
  }

  th {
    @apply p-4 text-left text-sm font-medium text-[#8890a4] 
           border-b border-[#2a2d3d];
  }

  tbody tr {
    @apply transition-colors duration-200 border-b border-[#2a2d3d]/50;
  }

  tbody tr:nth-child(even) {
    @apply bg-[#1e1f2a]/40;
  }

  tbody tr:hover {
    @apply bg-[#2a2d3d]/60;
  }

  .th-btn {
    @apply flex items-center gap-2 text-sm font-medium text-[#8890a4]
           hover:text-white transition-colors duration-150 w-full;
  }

  .cards-grid {
    @apply space-y-2 overflow-y-auto pr-2;
    height: calc(100% - 2rem); /* Account for controls margin */
  }

  .loading, .error {
    @apply flex items-center justify-center h-64 text-[#8890a4];
  }

  .spinner {
    @apply w-8 h-8 border-4 border-[#2a2d3d] border-t-white
           rounded-full animate-spin;
  }

  /* Scrollbar styling */
  .table-wrapper, .cards-grid {
    scrollbar-width: thin;
    scrollbar-color: #2a2d3d #1a1b23;
  }

  .table-wrapper::-webkit-scrollbar,
  .cards-grid::-webkit-scrollbar {
    @apply w-2;
  }

  .table-wrapper::-webkit-scrollbar-track,
  .cards-grid::-webkit-scrollbar-track {
    @apply bg-[#1a1b23];
  }

  .table-wrapper::-webkit-scrollbar-thumb,
  .cards-grid::-webkit-scrollbar-thumb {
    @apply bg-[#2a2d3d] rounded-full hover:bg-[#3d4154];
  }

  @media (max-width: 640px) {
    .controls-top {
      @apply gap-3;
    }

    .sort-controls {
      @apply p-2;
    }

    .sort-row {
      @apply gap-1;
    }

    .sort-btn {
      @apply px-2 py-1.5 text-xs;
    }

    .tab-group {
      @apply flex-col;
    }

    .tab-btn {
      @apply w-full;
    }

    .search-container {
      @apply w-full;
    }

    .search-input {
      @apply w-full max-w-full;
    }
  }
</style>
