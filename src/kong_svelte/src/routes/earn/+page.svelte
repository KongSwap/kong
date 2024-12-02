<script lang="ts">
  import { writable, derived } from "svelte/store";
  import { poolsList } from "$lib/services/pools/poolStore";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import PoolRow from "$lib/components/liquidity/pools/PoolRow.svelte";
  import { onMount } from 'svelte';
  import { goto } from "$app/navigation";
  import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-svelte';
  import PoolDetails from "$lib/components/liquidity/pools/PoolDetails.svelte";
  import { auth } from "$lib/services/auth";
  import { poolStore, userPoolBalances } from "$lib/services/pools/poolStore";
  import UserPool from "$lib/components/liquidity/pools/UserPool.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formatTokenAmount, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import PoolList from "$lib/components/sidebar/PoolList.svelte";
  import Modal from "$lib/components/common/Modal.svelte";

  type UserBalance = {
    name: string;
    symbol: string;
    symbol_0: string;
    symbol_1: string;
    balance: bigint;
    amount_0: bigint;
    amount_1: bigint;
    usd_balance: number;
    usd_amount_0: number;
    usd_amount_1: number;
    ts: bigint;
  };

  // Navigation state
  const activeSection = writable("pools");
  const activePoolView = writable("all"); // "all" or "user"
  
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

  // Get count of pools with non-zero balance
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

  // Search and filter functionality
  $: {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchTerm = searchTerm.trim().toLowerCase();
    }, 300);
  }

  $: filteredPools = $poolsList.filter(pool => {
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

  // Process user pool balances
  $: {
    console.log("UserPoolBalances in earn page:", $userPoolBalances);
  }

  function handlePoolClick(event) {
    const pool = event.detail;
    console.log("[Earn] Pool clicked:", pool);
    // Find the original pool data with all necessary information
    const fullPool = $poolsList.find(p => 
      p.symbol_0 === pool.symbol_0 && 
      p.symbol_1 === pool.symbol_1 &&
      p.pool_id
    );
    console.log("[Earn] Found full pool:", fullPool);
    if (fullPool && typeof fullPool.pool_id === 'number') {
      console.log("[Earn] Setting selected pool with ID:", fullPool.pool_id);
      selectedUserPool = fullPool;
    } else {
      console.error("[Earn] Could not find matching pool with valid ID");
    }
  }

  function formatLargeNumber(rawNum: number, isPreFormatted: boolean = false): string {
    // If the number is already formatted (like TVL), don't divide by decimals again
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
</script>

<section class="flex flex-col w-full h-full px-4 pb-4 {isMobile ? 'pb-24' : ''}">
  <div class="z-10 flex flex-col w-full h-full mx-auto gap-4 max-w-[1300px]">
    <!-- Hide earn cards on mobile since we have bottom nav -->
    <div class="earn-cards" class:hidden={isMobile}>
      <button 
        class="earn-card"
        class:active={$activeSection === 'pools'}
        on:click={() => activeSection.set('pools')}
      >
        <div class="card-content">
          <h3>Pools</h3>
          <p>Provide liquidity and earn trading fees</p>
          <div class="apy">Up to {$highestApr.toFixed(2)}% APR</div>
        </div>
      </button>

      <button 
        class="earn-card coming-soon"
        disabled
      >
        <div class="card-content">
          <h3>Staking</h3>
          <p>Lock tokens to earn staking rewards</p>
          <div class="coming-soon-label">
            <span class="coming-soon-icon">🚀</span>
            Coming Soon
          </div>
        </div>
      </button>

      <button
        class="earn-card coming-soon"
        disabled
      >
        <div class="card-content">
          <h3>Lending</h3>
          <p>Lend assets and earn interest</p>
          <div class="coming-soon-label">
            <span class="coming-soon-icon">🚀</span>
            Coming Soon
          </div>
        </div>
      </button>
    </div>

    {#if $activeSection === "pools"}
      <Panel className="flex-1 mb-4">
        <div class="h-full overflow-hidden flex flex-col">
          <!-- Common header for both views -->
          <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-4 gap-4 sticky top-0 z-10">
            <div class="flex gap-2 w-full lg:w-auto">
              <button 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                       {$activePoolView === 'all' 
                         ? 'bg-[#60A5FA] text-white' 
                         : 'bg-[#2a2d3d] text-[#8890a4] hover:bg-[#2a2d3d]/80'}"
                on:click={() => activePoolView.set('all')}
              >
                All Pools
              </button>
              <button 
                class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                       {$activePoolView === 'user' 
                         ? 'bg-[#60A5FA] text-white' 
                         : 'bg-[#2a2d3d] text-[#8890a4] hover:bg-[#2a2d3d]/80'}"
                on:click={() => {
                  if ($auth.isConnected) {
                    activePoolView.set('user');
                    poolStore.loadUserPoolBalances();
                  } else {
                    // TODO: Show connect wallet modal
                    console.log('Please connect your wallet');
                  }
                }}
              >
                Your Pools
                {#if $activePoolCount > 0}
                  <span class="ml-2 px-2 py-0.5 bg-[#2a2d3d] rounded-full text-xs">
                    {$activePoolCount}
                  </span>
                {/if}
              </button>
            </div>
            {#if $activePoolView === 'all'}
              <input
                type="text"
                placeholder="Search by token symbol, name, or address..."
                bind:value={searchTerm}
                class="w-full lg:w-96 px-4 py-2 bg-[#2a2d3d] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#60A5FA]/50 rounded-lg"
              />
            {/if}
          </div>

          <div class="overflow-auto flex-1">
            {#if $activePoolView === 'all'}
              <!-- All Pools View -->
              <div class="overflow-auto flex-1">
                <!-- Desktop Table View -->
                <table class="w-full hidden lg:table">
                  <thead>
                    <tr>
                      <th class="text-left w-1/4">Pool</th>
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
                        onShowDetails={() => handleShowDetails(pool)}
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
                          <TokenImages
                            tokens={[
                              $tokenMap.get(pool.address_0),
                              $tokenMap.get(pool.address_1)
                            ]}
                            size={32}
                            overlap={12}
                          />
                          <div>
                            <div class="font-medium text-white">{pool.symbol_0}/{pool.symbol_1}</div>
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
            {:else}
              <!-- User Pools View -->
              {#if $auth.isConnected}
                <div class="h-full">
                  <PoolList on:poolClick={handlePoolClick} />
                </div>
              {:else}
                <div class="flex flex-col items-center justify-center h-64 text-center">
                  <p class="text-gray-400 mb-4">Connect your wallet to view your liquidity positions</p>
                  <button
                    class="px-6 py-2 bg-[#60A5FA] text-white rounded-lg hover:bg-[#60A5FA]/90 transition-colors duration-200"
                    on:click={() => {
                      // TODO: Show connect wallet modal
                      console.log('Show connect wallet modal');
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

{#if selectedUserPool}
  <Modal
    isOpen={!!selectedUserPool}
    title={`${selectedUserPool.symbol_0}/${selectedUserPool.symbol_1} Pool Details`}
    onClose={() => selectedUserPool = null}
    width="max-w-2xl"
  >
    <UserPool
      poolId={selectedUserPool.pool_id}
      on:close={() => selectedUserPool = null}
    />
  </Modal>
{/if}

<style>
  .earn-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .earn-card {
    position: relative;
    display: flex;
    align-items: flex-start;
    padding: 1rem;
    border-radius: 0.5rem;
    background-color: rgba(26, 27, 35, 0.6);
    border: 1px solid #2a2d3d;
    text-align: left;
    transition: all 0.2s;
    backdrop-filter: blur(4px);
  }

  .earn-card:not(.coming-soon):hover {
    background-color: rgba(30, 31, 42, 0.8);
    border-color: rgba(96, 165, 250, 0.3);
    box-shadow: 0 0 10px rgba(96, 165, 250, 0.1);
    transform: scale(1.01);
  }

  .earn-card.active {
    background: linear-gradient(to bottom, #1e1f2a, #1a1b23);
    border-color: rgba(96, 165, 250, 0.2);
    box-shadow: 0 0 15px rgba(96, 165, 250, 0.1);
  }

  .earn-card.coming-soon {
    cursor: not-allowed;
    opacity: 0.8;
    background: linear-gradient(to bottom, rgba(30, 31, 42, 0.4), rgba(26, 27, 35, 0.4));
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .card-content h3 {
    font-size: 1.125rem;
    color: white;
  }

  .card-content p {
    color: #8890a4;
    font-size: 0.875rem;
  }

  .apy {
    color: #60A5FA;
    font-weight: 500;
    margin-top: 0.5rem;
    font-size: 0.875rem;
  }

  .coming-soon-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #60A5FA;
  }

  /* Mobile Navigation */
  .mobile-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: rgba(26, 27, 35, 0.9);
    border-top: 1px solid #2a2d3d;
    z-index: 50;
    backdrop-filter: blur(8px);
    box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.1);
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
    font-size: 0.75rem;
    font-weight: 500;
  }

  .soon-label {
    position: absolute;
    top: 0.75rem;
    font-size: 0.625rem;
    color: #60A5FA;
  }

  @media (max-width: 768px) {
    .earn-cards {
      display: none;
    }
  }

  /* Add these new styles */
  table th {
    padding: 1rem 0.5rem;
    color: #8890a4;
    font-weight: 500;
    font-size: 0.875rem;
  }

  table th:first-child {
    padding-left: 1rem;
  }

  table th:last-child {
    padding-right: 1rem;
  }
</style>
