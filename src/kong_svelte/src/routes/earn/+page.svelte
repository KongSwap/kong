<script lang="ts">
  import { writable, derived } from "svelte/store";
  import { poolsList } from "$lib/services/pools/poolStore";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import PoolRow from "$lib/components/liquidity/pools/PoolRow.svelte";
  import { onMount } from 'svelte';
  import { goto } from "$app/navigation";
  import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-svelte';

  // Navigation state
  const activeSection = writable("pools");
  
  // Sort state
  const sortColumn = writable("rolling_24h_volume");
  const sortDirection = writable<"asc" | "desc">("desc");

  let isMobile = false;
  let searchTerm = "";
  let searchDebounceTimer: NodeJS.Timeout;
  let debouncedSearchTerm = "";

  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  // Instead of creating our own derived store, use the existing formattedTokens
  const tokenMap = derived(formattedTokens, ($tokens) => {
    const map = new Map();
    if ($tokens) {
      $tokens.forEach((token) => {
        map.set(token.canister_id, token);
      });
    }
    return map;
  });

  // Get highest APR from pools
  const highestApr = derived(poolsList, ($pools) => {
    if (!$pools || $pools.length === 0) return 0;
    return Math.max(...$pools.map(pool => Number(pool.rolling_24h_apy)));
  });

  function handleAddLiquidity(token0: string, token1: string) {
    goto(`/earn/add?token0=${token0}&token1=${token1}`);
  }

  // Search and filter functionality
  $: {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchTerm = searchTerm.trim().toLowerCase();
    }, 300);
  }

  $: filteredPools = $poolsList.filter(pool => {
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
    if ($sortColumn === column) {
      sortDirection.update(d => d === "asc" ? "desc" : "asc");
    } else {
      sortColumn.set(column);
      sortDirection.set("asc");
    }
  }

  function getSortIcon(column: string) {
    if ($sortColumn !== column) return ArrowUpDown;
    return $sortDirection === "asc" ? ArrowUp : ArrowDown;
  }

  $: sortedPools = [...filteredPools].sort((a, b) => {
    const direction = $sortDirection === "asc" ? 1 : -1;
    const column = $sortColumn;
    
    if (column === "rolling_24h_volume") {
      return direction * (Number(a.rolling_24h_volume) - Number(b.rolling_24h_volume));
    }
    if (column === "tvl") {
      return direction * ((a.tvl || 0) - (b.tvl || 0));
    }
    if (column === "rolling_24h_apy") {
      return direction * (Number(a.rolling_24h_apy) - Number(b.rolling_24h_apy));
    }
    if (column === "price") {
      return direction * (Number(a.price) - Number(b.price));
    }
    return 0;
  });
</script>

<section class="flex flex-col w-full h-full px-4 pb-4">
  <div class="z-10 flex flex-col w-full h-full max-w-[1300px] mx-auto gap-4">
    <!-- Earn Hub Navigation -->
    <div class="earn-cards {isMobile ? 'mobile-tabs' : ''}">
      <button 
        class="earn-card {$activeSection === 'pools' ? 'active' : ''} {isMobile ? 'mobile-tab' : ''}"
        on:click={() => activeSection.set('pools')}
      >
        <div class="card-content">
          <h3>Pools</h3>
          {#if !isMobile}
            <p>Provide liquidity and earn trading fees</p>
            <div class="apy">Up to {$highestApr.toFixed(2)}% APR</div>
          {/if}
        </div>
      </button>

      <button 
        class="earn-card coming-soon {isMobile ? 'mobile-tab' : ''}"
        disabled
      >
        <div class="card-content">
          <h3>Staking {isMobile ? '•' : ''} <span class="soon-tag-inline">Soon</span></h3>
          {#if !isMobile}
            <p>Lock tokens to earn staking rewards</p>
            <div class="apy">Up to 25% APY</div>
            <div class="soon-tag">Coming Soon</div>
          {/if}
        </div>
      </button>

      <button
        class="earn-card coming-soon {isMobile ? 'mobile-tab' : ''}"
        disabled
      >
        <div class="card-content">
          <h3>Lending {isMobile ? '•' : ''} <span class="soon-tag-inline">Soon</span></h3>
          {#if !isMobile}
            <p>Lend assets and earn interest</p>
            <div class="apy">Up to 12% APY</div>
            <div class="soon-tag">Coming Soon</div>
          {/if}
        </div>
      </button>
    </div>

    {#if $activeSection === "pools"}
      <Panel className="flex-1 mb-4">
        <div class="h-full overflow-hidden flex flex-col">
          <div class="flex items-center justify-between mb-4 sticky top-0 bg-[#1a1b23] z-10">
            <input
              type="text"
              placeholder="Search by token name or address..."
              bind:value={searchTerm}
              class="w-full px-4 py-2 bg-[#2a2d3d] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#60A5FA]/50"
            />
          </div>

          <div class="overflow-auto flex-1">
            <!-- Desktop Table View -->
            <table class="w-full hidden lg:table">
              <thead>
                <tr>
                  <th class="w-1/4">Pool</th>
                  <th class="text-right cursor-pointer w-1/6" on:click={() => toggleSort("price")}>
                    Price
                    <svelte:component this={getSortIcon("price")} class="inline w-4 h-4 ml-1" />
                  </th>
                  <th class="text-right cursor-pointer w-1/6" on:click={() => toggleSort("tvl")}>
                    TVL
                    <svelte:component this={getSortIcon("tvl")} class="inline w-4 h-4 ml-1" />
                  </th>
                  <th class="text-right cursor-pointer w-1/6" on:click={() => toggleSort("rolling_24h_volume")}>
                    Volume 24H
                    <svelte:component this={getSortIcon("rolling_24h_volume")} class="inline w-4 h-4 ml-1" />
                  </th>
                  <th class="text-right cursor-pointer w-1/6" on:click={() => toggleSort("rolling_24h_apy")}>
                    APY
                    <svelte:component this={getSortIcon("rolling_24h_apy")} class="inline w-4 h-4 ml-1" />
                  </th>
                  <th class="text-right w-1/12">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each sortedPools as pool, i (pool.address_0 + pool.address_1)}
                  <PoolRow
                    {pool}
                    tokenMap={$tokenMap}
                    isEven={i % 2 === 0}
                    onAddLiquidity={handleAddLiquidity}
                  />
                {/each}
              </tbody>
            </table>

            <!-- Mobile/Tablet Card View -->
            <div class="lg:hidden space-y-4">
              <!-- Sort Controls for Mobile -->
              <div class="flex flex-col gap-3 bg-[#1a1b23] rounded-lg border border-[#2a2d3d] p-4">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-[#8890a4]">Sort by</span>
                  <button 
                    on:click={() => sortDirection.update(d => d === "asc" ? "desc" : "asc")}
                    class="flex items-center gap-2 text-[#60A5FA] text-sm font-medium"
                  >
                    <span>{$sortDirection === "asc" ? "Ascending" : "Descending"}</span>
                    <svelte:component this={$sortDirection === "asc" ? ArrowUp : ArrowDown} class="w-4 h-4" />
                  </button>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {#each [
                    { value: "rolling_24h_volume", label: "Volume 24H" },
                    { value: "tvl", label: "TVL" },
                    { value: "rolling_24h_apy", label: "APY" },
                    { value: "price", label: "Price" }
                  ] as option}
                    <button
                      class="px-3 py-2 rounded-lg text-sm text-center transition-all duration-200
                             {$sortColumn === option.value 
                               ? 'bg-[#60A5FA] text-white font-medium' 
                               : 'bg-[#2a2d3d] text-[#8890a4] hover:bg-[#2a2d3d]/80'}"
                      on:click={() => sortColumn.set(option.value)}
                    >
                      {option.label}
                    </button>
                  {/each}
                </div>
              </div>

              {#each sortedPools as pool, i (pool.address_0 + pool.address_1)}
                <div class="bg-[#1a1b23] p-4 rounded-lg border border-[#2a2d3d] hover:border-[#60A5FA]/30 transition-all duration-200">
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center space-x-2">
                      <div class="relative flex items-center">
                        <img 
                          src={$tokenMap.get(pool.address_0)?.logo || ''} 
                          alt={pool.symbol_0}
                          class="w-8 h-8 rounded-full ring-2 ring-[#1a1b23]"
                        />
                        <img 
                          src={$tokenMap.get(pool.address_1)?.logo || ''} 
                          alt={pool.symbol_1}
                          class="w-8 h-8 rounded-full -ml-3 ring-2 ring-[#1a1b23]"
                        />
                      </div>
                      <div>
                        <div class="font-medium text-white">{pool.symbol_0}/{pool.symbol_1}</div>
                        <div class="text-xs text-[#8890a4]">Pool Tokens</div>
                      </div>
                    </div>
                    <button
                      on:click={() => handleAddLiquidity(pool.address_0, pool.address_1)}
                      class="px-4 py-2 text-sm bg-[#60A5FA] text-white rounded-lg hover:bg-[#60A5FA]/90 transition-colors duration-200"
                    >
                      Add Liquidity
                    </button>
                  </div>
                  
                  <div class="grid grid-cols-2 gap-4">
                    <div class="bg-[#2a2d3d]/50 p-3 rounded-lg">
                      <div class="text-sm text-[#8890a4] mb-1">Price</div>
                      <div class="font-medium text-white">${Number(pool.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
                    </div>
                    <div class="bg-[#2a2d3d]/50 p-3 rounded-lg">
                      <div class="text-sm text-[#8890a4] mb-1">TVL</div>
                      <div class="font-medium text-white">${Number(pool.tvl)}</div>
                    </div>
                    <div class="bg-[#2a2d3d]/50 p-3 rounded-lg">
                      <div class="text-sm text-[#8890a4] mb-1">Volume 24H</div>
                      <div class="font-medium text-white">${Number(pool.rolling_24h_volume).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div class="bg-[#2a2d3d]/50 p-3 rounded-lg">
                      <div class="text-sm text-[#8890a4] mb-1">APY</div>
                      <div class="font-medium text-[#60A5FA]">{Number(pool.rolling_24h_apy).toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </Panel>
    {/if}
  </div>
</section>

<style lang="postcss">
  .earn-cards {
    @apply grid md:grid-cols-3 gap-4;
  }

  .earn-card {
    @apply relative flex items-start p-4 rounded-lg transition-all duration-200
           bg-[#1a1b23]/60 border border-[#2a2d3d] text-left
           hover:shadow-sm hover:shadow-[#60A5FA]/5 backdrop-blur-sm;
  }

  .earn-card:not(.coming-soon):hover {
    @apply bg-[#1e1f2a]/80 border-[#60A5FA]/30
           shadow-[0_0_10px_rgba(96,165,250,0.1)]
           transform scale-[1.01];
  }

  .earn-card.active {
    @apply bg-gradient-to-b from-[#1e1f2a] to-[#1a1b23]
           border-[#60A5FA]/20
           shadow-[0_0_15px_rgba(96,165,250,0.1)];
  }

  .earn-card.coming-soon {
    @apply cursor-not-allowed opacity-60;
  }

  .card-content {
    @apply flex flex-col gap-1.5;
  }

  .card-content h3 {
    @apply text-lg text-white;
  }

  .card-content p {
    @apply text-[#8890a4] text-sm;
  }

  .apy {
    @apply text-[#60A5FA] font-medium mt-2 text-sm;
  }

  .soon-tag {
    @apply absolute top-3 right-3 bg-[#60A5FA] text-white px-2 py-0.5
           rounded-md text-xs font-medium;
  }

  .soon-tag-inline {
    @apply text-xs text-[#60A5FA] font-medium ml-2;
  }

  table {
    @apply border-collapse;
  }

  th {
    @apply sticky top-0 px-4 py-3 text-sm font-medium text-[#8890a4] border-b border-[#2a2d3d] bg-[#1a1b23] z-10;
  }

  /* Scrollbar Styling */
  .overflow-auto {
    scrollbar-width: thin;
    scrollbar-color: #2a2d3d transparent;
  }

  .overflow-auto::-webkit-scrollbar {
    @apply w-1.5;
  }

  .overflow-auto::-webkit-scrollbar-track {
    @apply bg-transparent;
  }

  .overflow-auto::-webkit-scrollbar-thumb {
    @apply bg-[#2a2d3d] rounded-full hover:bg-[#3a3d4d] transition-colors duration-200;
  }

  /* For mobile, use flex instead of grid */
  @media (max-width: 768px) {
    .earn-cards {
      @apply flex flex-row gap-2 overflow-x-auto pb-2;
    }

    .earn-card {
      @apply flex-1 min-w-[140px] py-2 px-3;
    }

    .earn-card .card-content h3 {
      @apply text-sm text-center whitespace-nowrap;
    }

    .soon-tag-inline {
      @apply text-[10px] ml-1;
    }
  }
</style>
