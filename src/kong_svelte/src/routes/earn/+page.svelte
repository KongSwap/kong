<script lang="ts">
  import { writable, derived } from "svelte/store";
  import { poolsList, poolStore, userPoolBalances } from "$lib/services/pools/poolStore";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import PoolRow from "$lib/components/liquidity/pools/PoolRow.svelte";
  import { onMount } from 'svelte';
  import { goto } from "$app/navigation";
  import { ArrowUp, ArrowDown, ArrowUpDown, Droplets, Lock, Wallet } from 'lucide-svelte';
  import PoolDetails from "$lib/components/liquidity/pools/PoolDetails.svelte";
  import { auth } from "$lib/services/auth";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import PoolList from "$lib/components/sidebar/PoolList.svelte";
  import { toastStore } from "$lib/stores/toastStore";

  // Navigation state
  const activeSection = writable("pools");
  // activePoolView: "all" or "user"
  const activePoolView = writable("all");

  // Modal state
  let showPoolDetails = false;
  let selectedPool = null;
  let selectedUserPool = null;

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

  onMount(async () => {
    if ($auth.isConnected) {
      await poolStore.loadUserPoolBalances();
    }
  });

  // Watch for auth changes and reload balances
  $: if ($auth.isConnected) {
    poolStore.loadUserPoolBalances();
  }

  const tokenMap = derived(formattedTokens, ($tokens) => {
    const map = new Map();
    if ($tokens) {
      $tokens.forEach((token) => {
        map.set(token.canister_id, token);
      });
    }
    return map;
  });

  const highestApr = derived(poolsList, ($pools) => {
    if (!$pools || $pools.length === 0) return 0;
    return Math.max(...$pools.map(pool => Number(pool.rolling_24h_apy)));
  });

  const activePoolCount = derived(userPoolBalances, ($balances) => {
    if (!Array.isArray($balances)) return 0;
    return $balances.filter(balance => balance.balance > 0n).length;
  });

  function handleAddLiquidity(token0: string, token1: string) {
    goto(`/earn/add?token0=${token0}&token1=${token1}`);
  }

  function handleShowDetails(pool) {
    selectedPool = pool;
    showPoolDetails = true;
  }

  // Debounce search input
  $: {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchTerm = searchTerm.trim().toLowerCase();
    }, 300);
  }

  // Filter pools by search (only when viewing all pools)
  $: filteredPools = $poolsList.filter(pool => {
    if ($activePoolView !== "all") return true; // no filtering when on user view

    if (!debouncedSearchTerm) return true;
    
    const token0 = $tokenMap.get(pool.address_0);
    const token1 = $tokenMap.get(pool.address_1);
    
    const searchMatches = [
      pool.symbol_0.toLowerCase(),
      pool.symbol_1.toLowerCase(),
      `${pool.symbol_0}/${pool.symbol_1}`.toLowerCase(),
      `${pool.symbol_1}/${pool.symbol_0}`.toLowerCase(),
      pool.address_0?.toLowerCase() || '',
      pool.address_1?.toLowerCase() || '',
      token0?.name?.toLowerCase() || '',
      token1?.name?.toLowerCase() || ''
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
    if ($activePoolView !== "all") return 0; // sorting only applies to all pools view

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

  function handlePoolClick(event) {
    const pool = event.detail;
    const fullPool = $poolsList.find(p => 
      p.symbol_0 === pool.symbol_0 && 
      p.symbol_1 === pool.symbol_1 &&
      p.pool_id
    );
    if (fullPool && typeof fullPool.pool_id === 'number') {
      selectedUserPool = fullPool;
    } else {
      console.error("[Earn] Could not find matching pool with valid ID");
    }
  }

  function formatLargeNumber(rawNum: number, isPreFormatted: boolean = false): string {
    const num = isPreFormatted ? Number(rawNum) : Number(rawNum) / 1e6;
    
    if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  }

  // Toggle between All Pools and User Pools
  function toggleUserPools() {
    if ($activePoolView === 'all') {
      // Switch to user pools
      if (!$auth.isConnected) {
        toastStore.error(
          'Please connect your wallet to view your liquidity positions',
          undefined,
          'Connect Wallet'
        );
        return; 
      }
      activePoolView.set('user');
    } else {
      // Switch back to all pools
      activePoolView.set('all');
    }
  }
</script>

<section class="flex flex-col w-full h-full px-4 pb-4 {isMobile ? 'pb-24' : ''}">
  <div class="z-10 flex flex-col w-full h-full mx-auto gap-4 max-w-[1300px]">
    {#if !isMobile}
      <div class="earn-cards">
        <div class="earn-card" class:active={$activeSection === 'pools'} on:click={() => activeSection.set('pools')}>
          <div class="card-content">
            <h3>Pools</h3>
            <div class="apy">Up to {$highestApr.toFixed(2)}% APR</div>
          </div>
          <div class="stat-icon-wrapper">
            <Droplets class="stat-icon" />
          </div>
        </div>

        <div class="earn-card" disabled>
          <div class="card-content">
            <h3>Staking</h3>
            <div class="coming-soon-label">
              <span class="coming-soon-icon">🚀</span>
              <span class="coming-soon-text">Coming Soon</span>
            </div>
          </div>
          <div class="stat-icon-wrapper">
            <Lock class="stat-icon" />
          </div>
        </div>

        <div class="earn-card" disabled>
          <div class="card-content">
            <h3>Lending</h3>
            <div class="coming-soon-label">
              <span class="coming-soon-icon">🚀</span>
              <span class="coming-soon-text">Coming Soon</span>
            </div>
          </div>
          <div class="stat-icon-wrapper">
            <Wallet class="stat-icon" />
          </div>
        </div>
      </div>
    {/if}

    {#if $activeSection === "pools"}
      <Panel className="flex-1">
        <div class="h-full overflow-hidden flex flex-col">
          <!-- Header with full-width search and "My Pools" button on the right -->
          <div class="flex flex-col sticky top-0 z-20 } pb-2">
            <div class="flex items-center justify-between">
              {#if $activePoolView === 'all'}
                <input
                  type="text"
                  placeholder="Search by token symbol, name, or address..."
                  bind:value={searchTerm}
                  class="flex-1 bg-transparent border-b border-[#2a2d3d] text-white placeholder-gray-400 focus:outline-none focus:ring-0 py-2 mr-4"
                />
              {:else}
                <div class="flex-1"></div>
              {/if}
              <button
                class="px-4 py-2 mb-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                       {$activePoolView === 'user'
                         ? 'bg-[#60A5FA] text-white'
                         : 'bg-[#2a2d3d] text-[#8890a4] hover:bg-[#2a2d3d]/80'}"
                on:click={toggleUserPools}
              >
                My Pools
                {#if $activePoolCount > 0 && $auth.isConnected}
                  <span class="ml-2 px-2 py-0.5  rounded-full text-xs">
                    {$activePoolCount}
                  </span>
                {/if}
              </button>
            </div>

            <!-- Mobile Sort Controls -->
            {#if isMobile && $activePoolView === 'all'}
              <div class="flex items-center justify-between mt-2  py-1 rounded-lg">
                <select 
                  bind:value={$sortColumn}
                  class="bg-transparent text-white text-sm focus:outline-none"
                >
                  <option value="rolling_24h_volume">Volume 24H</option>
                  <option value="tvl">TVL</option>
                  <option value="rolling_24h_apy">APY</option>
                  <option value="price">Price</option>
                </select>
                
                <button 
                  on:click={() => sortDirection.update(d => d === "asc" ? "desc" : "asc")}
                  class="flex items-center gap-1 text-[#60A5FA] text-sm"
                >
                  {$sortDirection === "asc" ? "Ascending" : "Descending"}
                  <svelte:component this={$sortDirection === "asc" ? ArrowUp : ArrowDown} class="w-4 h-4" />
                </button>
              </div>
            {/if}
          </div>

          <div class="overflow-auto flex-1 custom-scrollbar">
            {#if $activePoolView === 'all'}
              <!-- All Pools View -->
              <div class="overflow-auto flex-1 max-h-[calc(100vh-20.5rem)] {isMobile ? 'max-h-[calc(97vh-16.5rem)]' : ''} custom-scrollbar">
                <!-- Desktop Table View -->
                <table class="w-full hidden lg:table relative">
                  <thead class="sticky top-0 z-10">
                    <tr class="h-10 border-b border-[#2a2d3d]">
                      <th class="text-left p-2 text-sm font-medium text-[#8890a4]">Pool</th>
                      <th class="text-left p-2 text-sm font-medium text-[#8890a4] cursor-pointer" on:click={() => toggleSort("price")}>
                        Price
                        <svelte:component this={getSortIcon("price")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                      <th class="text-left p-2 text-sm font-medium text-[#8890a4] cursor-pointer" on:click={() => toggleSort("tvl")}>
                        TVL
                        <svelte:component this={getSortIcon("tvl")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                      <th class="text-left p-2 text-sm font-medium text-[#8890a4] cursor-pointer" on:click={() => toggleSort("rolling_24h_volume")}>
                        Volume 24H
                        <svelte:component this={getSortIcon("rolling_24h_volume")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                      <th class="text-left p-2 text-sm font-medium text-[#8890a4] cursor-pointer" on:click={() => toggleSort("rolling_24h_apy")}>
                        APY
                        <svelte:component this={getSortIcon("rolling_24h_apy")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                      <th class="text-left p-2 text-sm font-medium text-[#8890a4]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each sortedPools as pool, i (pool.address_0 + pool.address_1)}
                      <PoolRow
                        {pool}
                        tokenMap={$tokenMap}
                        isEven={i % 2 === 0}
                        onAddLiquidity={handleAddLiquidity}
                        onShowDetails={() => handleShowDetails(pool)}
                      />
                    {/each}
                  </tbody>
                </table>

                <!-- Mobile/Tablet Card View -->
                <div class="lg:hidden space-y-4">
                  {#each sortedPools as pool, i (pool.address_0 + pool.address_1)}
                    <div class="bg-[#1a1b23] p-4 rounded-lg border border-[#2a2d3d] hover:border-[#60A5FA]/30 transition-all duration-200">
                      <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center space-x-2">
                          <TokenImages
                            tokens={[
                              $tokenMap.get(pool.address_0),
                              $tokenMap.get(pool.address_1)
                            ]}
                            size={32}
                          />
                          <div>
                            <div class="text-xs text-white">{pool.symbol_0}/{pool.symbol_1}</div>
                            <div class="text-xs text-[#8890a4]">Pool Tokens</div>
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <button
                            on:click={() => handleShowDetails(pool)}
                            class="px-4 py-2 text-sm bg-[#2a2d3d] text-white rounded-lg hover:bg-[#2a2d3d]/90 transition-colors duration-200"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                      
                      <div class="grid grid-cols-2 gap-4">
                        <div class="bg-[#2a2d3d]/50 p-3 rounded-lg">
                          <div class="text-sm text-[#8890a4] mb-1">Price</div>
                          <div class="font-medium text-white">
                            ${Number(pool.price) < 0.01 
                              ? Number(pool.price).toFixed(6)
                              : Number(pool.price).toFixed(2)}
                          </div>
                        </div>
                        <div class="bg-[#2a2d3d]/50 p-3 rounded-lg">
                          <div class="text-sm text-[#8890a4] mb-1">TVL</div>
                          <div class="font-medium text-white">
                            ${formatLargeNumber(Number(pool.tvl), true)}
                          </div>
                        </div>
                        <div class="bg-[#2a2d3d]/50 p-3 rounded-lg">
                          <div class="text-sm text-[#8890a4] mb-1">Volume 24H</div>
                          <div class="font-medium text-white">
                            ${formatLargeNumber(Number(pool.rolling_24h_volume))}
                          </div>
                        </div>
                        <div class="bg-[#2a2d3d]/50 p-3 rounded-lg">
                          <div class="text-sm text-[#8890a4] mb-1">APY</div>
                          <div class="font-medium text-[#60A5FA]">
                            {Number(pool.rolling_24h_apy).toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {:else if $activePoolView === 'user'}
              <!-- User Pools View -->
              {#if $auth.isConnected}
                <div class="h-full custom-scrollbar">
                  <PoolList on:poolClick={handlePoolClick} />
                </div>
              {:else}
                <div class="flex flex-col items-center justify-center h-64 text-center">
                  <p class="text-gray-400 mb-4">Connect your wallet to view your liquidity positions</p>
                  <button
                    class="px-6 py-2 bg-[#60A5FA] text-white rounded-lg hover:bg-[#60A5FA]/90 transition-colors duration-200"
                    on:click={() => {
                      toastStore.info('Connect your wallet to view your liquidity positions', undefined, 'Connect Wallet');
                    }}
                  >
                    Connect Wallet
                  </button>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </Panel>
    {/if}
  </div>
</section>

{#if isMobile}
  <nav class="mobile-nav">
    <div class="mobile-nav-container">
      <button 
        class="mobile-nav-item"
        class:active={$activeSection === 'pools'}
        on:click={() => activeSection.set('pools')}
      >
        <span class="nav-icon">💧</span>
        <span class="nav-label">Pools</span>
      </button>

      <button 
        class="mobile-nav-item disabled"
        disabled
      >
        <span class="nav-icon">🔒</span>
        <span class="nav-label">Staking</span>
        <span class="soon-label">Soon</span>
      </button>

      <button 
        class="mobile-nav-item disabled"
        disabled
      >
        <span class="nav-icon">💰</span>
        <span class="nav-label">Lending</span>
        <span class="soon-label">Soon</span>
      </button>
    </div>
  </nav>
{/if}

{#if showPoolDetails && selectedPool}
  <PoolDetails 
    pool={selectedPool}
    tokenMap={$tokenMap}
    showModal={showPoolDetails}
    positions={[]}
    onClose={() => {
      showPoolDetails = false;
      selectedPool = null;
    }}
  />
{/if}

<style>
  .earn-cards {
    @apply grid grid-cols-1 md:grid-cols-3 gap-4;
  }

  .earn-card {
    @apply relative flex items-center justify-between p-6 rounded-lg transition-all duration-200
           bg-[#1a1b23]/60 border border-[#2a2d3d] text-left
           hover:bg-[#1e1f2a]/80 hover:border-[#60A5FA]/30 
           hover:shadow-[0_0_10px_rgba(96,165,250,0.1)]
           backdrop-blur-sm;
  }

  .earn-card[disabled] {
    @apply opacity-75 cursor-not-allowed hover:border-[#2a2d3d] hover:bg-[#1a1b23]/60 hover:shadow-none;
  }

  .card-content h3 {
    @apply text-[#8890a4] text-sm font-medium;
  }

  .apy {
    @apply text-[#60A5FA] font-medium text-2xl mt-2;
  }

  .stat-icon-wrapper {
    @apply p-4 rounded-lg bg-[#2a2d3d] text-[#60A5FA];
  }

  .mobile-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    border-top: 1px solid #2a2d3d;
    z-index: 50;
    backdrop-filter: blur(8px);
    box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.1);
    border-color: rgb(42 45 61 / var(--tw-border-opacity, 1));
    background-color: rgb(26 27 35 / 0.9);
  }

  .mobile-nav-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    height: 4rem;
  }

  .mobile-nav-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    color: #8890a4;
    transition: color 0.2s;
  }

  .mobile-nav-item.active {
    color: #60A5FA;
  }

  .mobile-nav-item.disabled {
    opacity: 0.6;
  }

  .nav-icon {
    font-size: 1.25rem;
  }

  .nav-label {
    font-size: 0.71rem;
    font-weight: 500;
  }

  .soon-label {
    position: absolute;
    top: 0.75rem;
    font-size: 0.625rem;
    color: #60A5FA;
  }

  table th {
    padding: 0.5rem 0.5rem;
    color: #8890a4;
    font-weight: 500;
    font-size: 0.875rem;
    background-color: #1a1b23;
  }

  .coming-soon-label {
    @apply flex items-center gap-2 mt-2;
  }

  .coming-soon-text {
    @apply text-[#60A5FA] text-base;
  }

  .coming-soon-icon {
    @apply text-xl;
  }

  /* Custom Scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: #1a1b23; /* Match the background color for a subtle look */
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #60A5FA; /* Use the theme's accent blue */
    border-radius: 4px;
    border: 2px solid #1a1b23; /* Ensures the thumb stands out slightly */
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #3b82f6; /* A slightly darker shade when hovered */
  }

  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #60A5FA #1a1b23; 
  }

  /* For Firefox */
  /* The above scrollbar-color property supports Firefox. The first color is the thumb, the second is the track. */

</style>
