<script lang="ts">
  import { t } from "$lib/services/translations";
  import { writable, derived } from "svelte/store";
  import { poolsList, poolsLoading, poolsError } from "$lib/services/pools/poolStore";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import PoolRow from "$lib/components/liquidity/pools/PoolRow.svelte";
  import { onMount } from 'svelte';
  import { goto } from "$app/navigation";
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-svelte';

  // Navigation state
  const activeSection = writable("pools");
  const activeTab = writable("all_pools");
  
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
          <div class="flex items-center justify-between mb-4 px-4 sticky top-0 bg-[#1a1b23] z-10">
            <input
              type="text"
              placeholder="Search by token name or address..."
              bind:value={searchTerm}
              class="w-full px-4 py-2 bg-[#2a2d3d] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#60A5FA]/50"
            />
          </div>

          <div class="overflow-auto flex-1">
            <table class="w-full">
              <thead>
                <tr>
                  <th>Pool</th>
                  <th class="text-right cursor-pointer" on:click={() => toggleSort("price")}>
                    Price
                    <svelte:component this={getSortIcon("price")} class="inline w-4 h-4 ml-1" />
                  </th>
                  <th class="text-right cursor-pointer" on:click={() => toggleSort("tvl")}>
                    TVL
                    <svelte:component this={getSortIcon("tvl")} class="inline w-4 h-4 ml-1" />
                  </th>
                  <th class="text-right cursor-pointer" on:click={() => toggleSort("rolling_24h_volume")}>
                    Volume 24H
                    <svelte:component this={getSortIcon("rolling_24h_volume")} class="inline w-4 h-4 ml-1" />
                  </th>
                  <th class="text-right cursor-pointer" on:click={() => toggleSort("rolling_24h_apy")}>
                    APY
                    <svelte:component this={getSortIcon("rolling_24h_apy")} class="inline w-4 h-4 ml-1" />
                  </th>
                  <th class="text-right">Actions</th>
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

  .earn-card.coming-soon.mobile {
    @apply py-3 px-4;
  }

  .earn-card.coming-soon.mobile .card-content {
    @apply gap-0;
  }

  .soon-tag-inline {
    @apply text-xs text-[#60A5FA] font-medium ml-2;
  }

  table {
    @apply border-collapse;
  }

  th {
    @apply px-4 py-2 text-sm font-medium text-[#8890a4] border-b border-[#2a2d3d];
  }

  @media (max-width: 640px) {
    section {
      @apply px-2 pb-2;
    }
  }

  /* For mobile, use flex instead of grid */
  @media (max-width: 768px) {
    .earn-cards {
      @apply flex flex-row gap-2 overflow-x-auto;
    }

    .earn-card {
      @apply flex-1 min-w-0 py-2 px-3;
    }

    .earn-card .card-content h3 {
      @apply text-sm text-center whitespace-nowrap;
    }

    .soon-tag-inline {
      @apply text-[10px] ml-1;
    }
  }
</style>
