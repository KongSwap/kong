<script lang="ts">
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import PoolRow from "./PoolRow.svelte";
  import { writable } from "svelte/store";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import { ArrowUp, ArrowDown, ArrowUpDown, Search } from 'lucide-svelte';
  import AddLiquidityModal from "$lib/components/liquidity/add_liquidity/AddLiquidityModal.svelte";
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
      pool.symbol_0.toLowerCase(),
      pool.symbol_1.toLowerCase(), 
      `${pool.symbol_0}/${pool.symbol_1}`.toLowerCase(),
      `${pool.symbol_1}/${pool.symbol_0}`.toLowerCase(),
      pool.address_0?.toLowerCase() || '',
      pool.address_1?.toLowerCase() || ''
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
</script>

<div class="container">
  <div class="controls">
    <div class="tabs">
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

    <div class="search">
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

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>
              <button on:click={() => toggleSort("pool")}>
                Pool
                <svelte:component this={getSortIcon("pool")} size={16} />
              </button>
            </th>
            <th>
              <button on:click={() => toggleSort("price")}>
                Price
                <svelte:component this={getSortIcon("price")} size={16} />
              </button>
            </th>
            <th>
              <button on:click={() => toggleSort("tvl")}>
                TVL
                <svelte:component this={getSortIcon("tvl")} size={16} />
              </button>
            </th>
            <th>
              <button on:click={() => toggleSort("volume")}>
                Volume (24h)
                <svelte:component this={getSortIcon("volume")} size={16} />
              </button>
            </th>
            <th>
              <button on:click={() => toggleSort("apy")}>
                APY
                <svelte:component this={getSortIcon("apy")} size={16} />
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
  {/if}
</div>

{#if showAddLiquidityModal}
  <AddLiquidityModal
    showModal={showAddLiquidityModal}
    onClose={() => showAddLiquidityModal = false}
    initialToken0={tokenMap.get(selectedTokens.token0)}
    initialToken1={tokenMap.get(selectedTokens.token1)}
  />
{/if}

<style>
  .container {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem;
  }

  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
  }

  .search {
    position: relative;
    width: 400px;
  }

  .table-wrapper {
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.2);
    max-height: 70vh;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    position: sticky;
    top: 0;
    background: rgba(0, 0, 0, 0.4);
    padding: 1rem;
    text-align: left;
  }

  th button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    width: 100%;
  }

  tbody tr:nth-child(even) {
    background: rgba(0, 0, 0, 0.2);
  }

  .loading, .error {
    text-align: center;
    padding: 2rem;
  }

  .error {
    color: red;
  }
</style>
