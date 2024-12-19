<script lang="ts">
  import { writable, derived } from "svelte/store";
  import {
    poolsList,
    userPoolBalances,
    filteredLivePools,
    poolSearchTerm,
    poolSortColumn,
    poolSortDirection,
  } from "$lib/services/pools/poolStore";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import PoolRow from "$lib/components/liquidity/pools/PoolRow.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import {
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    Droplets,
    Lock,
    Wallet,
  } from "lucide-svelte";
  import PoolDetails from "$lib/components/liquidity/pools/PoolDetails.svelte";
  import { auth } from "$lib/services/auth";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import UserPoolList from "$lib/components/earn/UserPoolList.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { browser } from "$app/environment";
    import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

  // Navigation state
  const activeSection = writable("pools");
  // activePoolView: "all" or "user"
  const activePoolView = writable("all");

  // Modal state
  let showPoolDetails = false;
  let selectedPool = null;
  let selectedUserPool = null;

  let isMobile = writable(false);
  let searchTerm = "";
  let searchDebounceTimer: NodeJS.Timeout;
  const KONG_CANISTER_ID = 'o7oak-iyaaa-aaaaq-aadzq-cai';

  onMount(() => {
    window.addEventListener("resize", checkMobile);
    checkMobile();

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  });

  const checkMobile = () => {
    $isMobile = window.innerWidth < 768;
  };

  $: if (browser) {
    checkMobile();
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
    return Math.max(...$pools.map((pool) => Number(pool.rolling_24h_apy)));
  });

  function handleAddLiquidity(token0: string, token1: string) {
    goto(`/earn/add?token0=${token0}&token1=${token1}`);
  }

  function handleShowDetails(pool) {
    selectedPool = pool;
    showPoolDetails = true;
  }

  function toggleSort(column: string) {
    if ($poolSortColumn === column) {
      poolSortDirection.set($poolSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      poolSortColumn.set(column);
      poolSortDirection.set('desc');
    }
  }

  function getSortIcon(column: string) {
    if ($poolSortColumn !== column) return ArrowUpDown;
    return $poolSortDirection === "asc" ? ArrowUp : ArrowDown;
  }

  function handlePoolClick(event) {
    const pool = event.detail;
    const fullPool = $poolsList.find(
      (p) =>
        p.symbol_0 === pool.symbol_0 &&
        p.symbol_1 === pool.symbol_1 &&
        p.pool_id,
    );
    if (fullPool && typeof fullPool.pool_id === "number") {
      selectedUserPool = fullPool;
    } else {
      console.error("[Earn] Could not find matching pool with valid ID");
    }
  }

  function formatLargeNumber(
    rawNum: number,
    isPreFormatted: boolean = false,
  ): string {
    const num = isPreFormatted ? Number(rawNum) : Number(rawNum) / 1e6;

    if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + "B";
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + "M";
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + "K";
    }
    return num.toFixed(2);
  }

  function handleSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      poolSearchTerm.set(searchTerm.trim().toLowerCase());
    }, 300);
  }
</script>

<section
  class="flex flex-col w-full h-full px-4 pb-4 {$isMobile ? 'pb-24' : ''}"
>
  <div class="z-10 flex flex-col w-full h-full mx-auto gap-4 max-w-[1300px]">
    {#if !$isMobile}
      <div class="earn-cards">
        <div
          class="earn-card"
          class:active={$activeSection === "pools"}
          on:click={() => activeSection.set("pools")}
        >
          <div class="card-content">
            <h3>Pools</h3>
            <div class="apy">Up to {$highestApr.toFixed(2)}% APY</div>
          </div>
          <div class="stat-icon-wrapper">
            <Droplets class="stat-icon" />
          </div>
        </div>

        <div class="earn-card" aria-disabled="true">
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

        <div class="earn-card" aria-disabled="true">
          <div class="card-content">
            <h3>Borrowing & Lending</h3>
            <div class="coming-soon-label">
              <span class="coming-soon-icon">💰</span>
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
      <Panel className="flex-1 {$isMobile ? '' : '!p-0'}">
        <div class="overflow-hidden flex flex-col">
          <!-- Header with full-width search and "My Pools" button -->
          <div class="flex flex-col sticky top-0 z-20">
            <div class="flex flex-col gap-3 sm:gap-0 sticky top-0 z-10">
              <!-- Mobile-only buttons -->
              <div class="flex flex-col gap-3 sm:hidden">
                <div class="w-full">
                  <div class="bg-[#1A1B24] border border-[#2a2d3d] rounded-lg w-full">
                    <div class="flex items-center w-full">
                      <div class="flex w-full border-r border-[#2a2d3d]">
                        <button
                          class="px-4 py-2 w-1/2 transition-colors duration-200 {$activePoolView === 'all'
                            ? 'text-white'
                            : 'text-[#8890a4] hover:text-white'}"
                          on:click={() => ($activePoolView = "all")}
                        >
                          All Pools
                        </button>
                        <button
                          class="px-4 py-2 w-1/2 transition-colors duration-200 {$activePoolView === 'user'
                            ? 'text-white'
                            : 'text-[#8890a4] hover:text-white'}"
                          on:click={() => ($activePoolView = "user")}
                        >
                        My Pools <span class="text-xs ml-1 font-bold py-0 text-black bg-blue-400/90 px-1.5 rounded">{$userPoolBalances.length}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="w-full bg-[#1a1b23] border border-[#2a2d3d] rounded-lg px-4 py-2">
                  <input
                    type="text"
                    placeholder={$isMobile == true ? "Search pools..." : "Search pools by name, symbol, or canister ID"}
                    class="w-full bg-transparent text-white placeholder-[#8890a4] focus:outline-none"
                    bind:value={searchTerm}
                    on:input={handleSearch}
                  />
                </div>
              </div>
              <!-- Desktop view -->
              <div class="hidden sm:flex items-center gap-3 pb-1 border-b border-[#2a2d3d] pt-2">
                <div class="flex-1">
                  <div class="flex items-center">
                    <div class="flex bg-transparent">
                      <button
                        class="px-4 py-2 transition-colors duration-200 {$activePoolView === 'all'
                          ? 'text-white'
                          : 'text-[#8890a4] hover:text-white'}"
                        on:click={() => ($activePoolView = "all")}
                      >
                        All Pools
                      </button>
                      <button
                        class="px-4 py-2 transition-colors duration-200 {$activePoolView === 'user'
                          ? 'text-white'
                          : 'text-[#8890a4] hover:text-white'}"
                        on:click={() => ($activePoolView = "user")}
                      >
                        My Pools <span class="text-xs ml-1 font-bold py-0.5 text-white/80 bg-blue-400/60 px-1.5 rounded">{$userPoolBalances.length}</span>
                      </button>
                    </div>

                    <div class="flex-1 px-4 py-2">
                      <input
                        type="text"
                        placeholder={$isMobile == true ? "Search pools..." : "Search pools by name, symbol, or canister ID"}
                        class="w-full bg-transparent text-white placeholder-[#8890a4] focus:outline-none"
                        bind:value={searchTerm}
                        on:input={handleSearch}
                      />
                    </div>
                  </div>
                </div>

                <button
                  class="flex items-center gap-2 rounded-none !rounded-tr-lg px-4 py-2 text-white/80 hover:text-primary-blue"
                  on:click={() => goto("/earn/add")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span>Add Position</span>
                </button>
              </div>
            </div>

            <!-- Mobile Sort Controls -->
            {#if $isMobile && $activePoolView === "all"}
              <div
                class="flex items-center justify-between mt-2 py-1 rounded-lg"
              >
                <select
                  bind:value={$poolSortColumn}
                  class="bg-transparent text-white text-sm focus:outline-none"
                >
                  <option value="rolling_24h_volume">Volume 24H</option>
                  <option value="tvl">TVL</option>
                  <option value="rolling_24h_apy">APY</option>
                  <option value="price">Price</option>
                </select>

                <button
                  on:click={() =>
                    poolSortDirection.update((d) => (d === "asc" ? "desc" : "asc"))}
                  class="flex items-center gap-1 text-[#60A5FA] text-sm"
                >
                  {$poolSortDirection === "asc" ? "Ascending" : "Descending"}
                  <svelte:component
                    this={$poolSortDirection === "asc" ? ArrowUp : ArrowDown}
                    class="w-4 h-4"
                  />
                </button>
              </div>
            {/if}
          </div>

          <div class="overflow-auto flex-1 custom-scrollbar">
            {#if $activePoolView === "all"}
              <!-- All Pools View -->
              <div
                class="overflow-auto flex-1 max-h-[calc(100vh-17.5rem)] {$isMobile
                  ? 'max-h-[calc(101vh-21.5rem)] pb-20'
                  : ''} custom-scrollbar"
              >
                <!-- Desktop Table View -->
                <table class="pools-table w-full hidden md:table relative">
                  <thead class="sticky top-0 z-10 bg-[#1E1F2A]">
                    <tr class="h-10 border-b border-[#2a2d3d]">
                      <th
                        class="text-left text-sm font-medium text-[#8890a4] cursor-pointer"
                        on:click={() => toggleSort("pool_name")}
                      >
                        Pool
                        <svelte:component this={getSortIcon("pool_name")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                      <th
                        class="text-left text-sm font-medium text-[#8890a4] cursor-pointer"
                        on:click={() => toggleSort("price")}
                      >
                        Price
                        <svelte:component this={getSortIcon("price")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                      <th
                        class="text-left text-sm font-medium text-[#8890a4] cursor-pointer"
                        on:click={() => toggleSort("tvl")}
                      >
                        TVL
                        <svelte:component this={getSortIcon("tvl")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                      <th
                        class="text-left text-sm font-medium text-[#8890a4] cursor-pointer"
                        on:click={() => toggleSort("rolling_24h_volume")}
                      >
                        Volume 24H
                        <svelte:component this={getSortIcon("rolling_24h_volume")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                      <th
                        class="text-left text-sm font-medium text-[#8890a4] cursor-pointer"
                        on:click={() => toggleSort("rolling_24h_apy")}
                      >
                        APY
                        <svelte:component this={getSortIcon("rolling_24h_apy")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                      <th class="text-left text-sm font-medium text-[#8890a4]">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="!px-4">
                    {#each $filteredLivePools as pool, i (pool.address_0 + pool.address_1)}
                      <PoolRow
                        pool={{
                          ...pool,
                          tvl: BigInt(pool.tvl),
                          rolling_24h_volume: BigInt(pool.rolling_24h_volume),
                          displayTvl: Number(pool.tvl) / 1e6
                        } as BE.Pool & { displayTvl: number }}
                        tokenMap={$tokenMap}
                        isEven={i % 2 === 0}
                        isKongPool={
                          pool.address_0 === KONG_CANISTER_ID ||
                          pool.address_1 === KONG_CANISTER_ID
                        }
                        onAddLiquidity={handleAddLiquidity}
                        onShowDetails={() => handleShowDetails(pool)}
                      />
                    {/each}
                  </tbody>
                </table>

                <!-- Mobile/Tablet Card View -->
                <div class="md:hidden space-y-4 mt-2">
                  {#each $filteredLivePools || [] as pool, i (pool.address_0 + pool.address_1)}
                    <div
                      class="bg-[#1a1b23] p-4 rounded-lg border border-[#2a2d3d] hover:border-[#60A5FA]/30 transition-all duration-200 
                            {(pool.address_0 === KONG_CANISTER_ID || pool.address_1 === KONG_CANISTER_ID) ? 'kong-special-card' : ''}"
                    >
                      <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center space-x-2">
                          <TokenImages
                            tokens={[
                              $tokenMap.get(pool.address_0),
                              $tokenMap.get(pool.address_1),
                            ]}
                            size={32}
                          />
                          <div>
                            <div class="text-xs text-white">
                              {pool.symbol_0}/{pool.symbol_1}
                            </div>
                            <div class="text-xs text-[#8890a4]">
                              Pool Tokens
                            </div>
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
                            ${formatToNonZeroDecimal(pool.price_usd)}
                          </div>
                        </div>
                        <div class="bg-[#2a2d3d]/50 p-3 rounded-lg">
                          <div class="text-sm text-[#8890a4] mb-1">TVL</div>
                          <div class="font-medium text-white">
                            ${formatLargeNumber(Number(pool.tvl), false)}
                          </div>
                        </div>
                        <div class="bg-[#2a2d3d]/50 p-3 rounded-lg">
                          <div class="text-sm text-[#8890a4] mb-1">
                            Volume 24H
                          </div>
                          <div class="font-medium text-white">
                            ${formatLargeNumber(
                              Number(pool.rolling_24h_volume),
                            )}
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
            {:else if $activePoolView === "user"}
              <!-- User Pools View -->
              {#if $auth.isConnected}
                <div class="h-full custom-scrollbar">
                  <UserPoolList 
                    on:poolClick={handlePoolClick}
                    searchQuery={searchTerm}
                  />
                </div>
              {:else}
                <div
                  class="flex flex-col items-center justify-center h-64 text-center"
                >
                  <p class="text-gray-400 mb-4">
                    Connect your wallet to view your liquidity positions
                  </p>
                  <button
                    class="px-6 py-2 bg-primary-blue text-white rounded-lg hover:bg-[#60A5FA]/90 transition-colors duration-200"
                    on:click={() => {
                      toastStore.info(
                        "Connect your wallet to view your liquidity positions",
                        undefined,
                        "Connect Wallet",
                      );
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

{#if $isMobile}
  <nav class="mobile-nav">
    <div class="mobile-nav-container">
      <button
        class="mobile-nav-item"
        class:active={$activeSection === "pools"}
        on:click={() => activeSection.set("pools")}
      >
        <span class="nav-icon">💧</span>
        <span class="nav-label">Pools</span>
      </button>

      <button class="mobile-nav-item disabled" disabled>
        <span class="nav-icon">🔒</span>
        <span class="nav-label">Staking</span>
        <span class="soon-label">Soon</span>
      </button>

      <button class="mobile-nav-item disabled" disabled>
        <span class="nav-icon">💰</span>
        <span class="nav-label">Borrow & Lend</span>
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

<style scoped lang="postcss">
  .earn-cards {
    @apply grid grid-cols-1 md:grid-cols-3 gap-4;
    max-width: 100%;
  }

  .earn-card {
    @apply relative flex items-center justify-between p-4 lg:p-6 rounded-lg transition-all duration-200
           bg-[#1a1b23]/60 border border-[#2a2d3d] text-left
           hover:bg-[#1e1f2a]/80 hover:border-[#60A5FA]/30 
           hover:shadow-[0_0_10px_rgba(96,165,250,0.1)]
           backdrop-blur-sm;
    min-width: 0; /* Prevent flex items from growing beyond container */
  }

  .card-content {
    @apply flex-1 min-w-0; /* Allow content to shrink */
  }

  .card-content h3 {
    @apply text-[#8890a4] text-xs lg:text-sm font-medium;
    white-space: nowrap;
  }

  .apy {
    @apply text-[#60A5FA] font-medium text-lg lg:text-2xl mt-2;
  }

  .stat-icon-wrapper {
    @apply p-3 lg:p-4 rounded-lg bg-[#2a2d3d] text-[#60A5FA] ml-3 flex-shrink-0;
  }

  .coming-soon-label {
    @apply flex items-center gap-1 lg:gap-2 mt-2;
  }

  .coming-soon-text {
    @apply text-[#60A5FA] text-sm lg:text-base;
    white-space: nowrap;
  }

  .coming-soon-icon {
    @apply text-lg lg:text-xl;
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
    color: #60a5fa;
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
    color: #60a5fa;
  }

  table th {
    padding: 0.5rem 0.5rem;
    color: #8890a4;
    font-weight: 500;
    font-size: 0.875rem;
    background-color: #1a1b23;
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
    background: #60a5fa; /* Use the theme's accent blue */
    border-radius: 4px;
    border: 2px solid #1a1b23; /* Ensures the thumb stands out slightly */
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #3b82f6; /* A slightly darker shade when hovered */
  }

  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #60a5fa #1a1b23;
  }

  /* For Firefox */
  /* The above scrollbar-color property supports Firefox. The first color is the thumb, the second is the track. */

  @media (max-width: 350px) {
    .mobile-nav-container {
      height: 5rem;
    }
    
    .nav-label {
      font-size: 0.65rem;
    }
  }

  .kong-special-card {
    background: rgba(0, 255, 128, 0.02);

    &:hover {
      background: rgba(0, 255, 128, 0.04);
    }
  }

  .pools-table {
    th, td {
      padding: 0.5rem 0.5rem;
      
      &:first-child {
        padding-left: 1rem;
      }
      
      &:last-child {
        padding-right: 1rem;
      }
    }
  }
</style>
