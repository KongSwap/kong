<script lang="ts">
	import { sidebarStore } from '$lib/stores/sidebarStore';
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
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import {
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    Droplets,
  } from "lucide-svelte";
  import PoolDetails from "$lib/components/liquidity/pools/PoolDetails.svelte";
  import { auth } from "$lib/services/auth";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import UserPoolList from "$lib/components/earn/UserPoolList.svelte";
  import { browser } from "$app/environment";
  import { getPoolPriceUsd } from "$lib/utils/statsUtils";

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
    goto(`/pools/add?token0=${token0}&token1=${token1}`);
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

  onDestroy(() => {
    clearTimeout(searchDebounceTimer);
    // reset search properties
    searchTerm = "";
    poolSearchTerm.set("");
  });
</script>

<section
  class="flex flex-col w-full h-[calc(100vh-7rem)] px-4 pb-4"
>
  <div class="z-10 flex flex-col w-full h-full mx-auto gap-4 max-w-[1300px]">
    <!-- Add page heading -->
  
    {#if $activeSection === "pools"}
      <Panel className="flex-1 {$isMobile ? '' : '!p-0'}">
        <div class="overflow-hidden flex flex-col">
          <!-- Header with full-width search and "My Pools" button -->
          <div class="flex flex-col sticky top-0 z-20">
            <div class="flex flex-col gap-3 sm:gap-0 sticky top-0 z-10">
              <!-- Mobile-only buttons -->
              <div class="flex flex-col gap-3 sm:hidden">
                <div class="w-full">
                  <div class="bg-kong-bg-dark border border-kong-border rounded-lg w-full">
                    <div class="flex items-center w-full">
                      <div class="flex w-full border-r border-kong-border">
                        <button
                          class="px-4 py-2 w-1/2 transition-colors duration-200 {$activePoolView === 'all'
                            ? 'text-kong-text-primary'
                            : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                          on:click={() => ($activePoolView = "all")}
                        >
                          All Pools
                        </button>
                        <button
                          class="px-4 py-2 w-1/2 transition-colors duration-200 {$activePoolView === 'user'
                            ? 'text-kong-text-primary'
                            : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                          on:click={() => ($activePoolView = "user")}
                        >
                        My Pools <span class="text-xs ml-1 font-bold py-0.5 text-white/80 bg-kong-primary px-1.5 rounded">{$userPoolBalances.length}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="w-full bg-kong-bg-dark border border-kong-border rounded-lg px-4 py-2">
                  <input
                    type="text"
                    placeholder={$isMobile == true ? "Search pools..." : "Search pools by name, symbol, or canister ID"}
                    class="w-full bg-transparent text-kong-text-primary placeholder-[#8890a4] focus:outline-none"
                    bind:value={searchTerm}
                    on:input={handleSearch}
                  />
                </div>
              </div>
              <!-- Desktop view -->
              <div class="hidden sm:flex items-center gap-3 pb-1 border-b border-kong-border pt-2">
                <div class="flex-1">
                  <div class="flex items-center">
                    <div class="flex bg-transparent">
                      <button
                        class="px-4 py-2 transition-colors duration-200 {$activePoolView === 'all'
                          ? 'text-kong-text-primary'
                          : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                        on:click={() => ($activePoolView = "all")}
                      >
                        All Pools
                      </button>
                      <button
                        class="px-4 py-2 transition-colors duration-200 {$activePoolView === 'user'
                          ? 'text-kong-text-primary'
                          : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                        on:click={() => ($activePoolView = "user")}
                      >
                        My Pools <span class="text-xs ml-1 font-bold py-0.5 text-white/80 bg-kong-primary/80 px-1.5 rounded">{$userPoolBalances.length}</span>
                      </button>
                    </div>

                    <div class="flex-1 px-4 py-2">
                      <input
                        type="text"
                        placeholder={$isMobile == true ? "Search pools..." : "Search pools by name, symbol, or canister ID"}
                        class="w-full bg-transparent text-kong-text-primary placeholder-[#8890a4] focus:outline-none"
                        bind:value={searchTerm}
                        on:input={handleSearch}
                      />
                    </div>
                  </div>
                </div>

                <button
                  class="flex items-center gap-2 rounded-none !rounded-tr-lg px-4 py-2 text-kong-text-primary/80 hover:text-kong-primary"
                  on:click={() => goto("/pools/add")}
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
                class="flex items-center justify-between py-1 rounded-lg sticky z-20 bg-kong-bg-dark border-b border-kong-border"
              >
                <select
                  bind:value={$poolSortColumn}
                  class="bg-transparent text-kong-text-primary text-sm focus:outline-none"
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

          <div class="h-full custom-scrollbar overflow-y-auto">
            {#if $activePoolView === "all"}
              <!-- All Pools View -->
              <div
                class="overflow-auto {$isMobile
                  ? ''
                  : ''} custom-scrollbar"
              >
                <!-- Desktop Table View -->
                <table class="pools-table w-full hidden md:table relative">
                  <thead class="sticky top-0 z-10 bg-kong-bg-dark">
                    <tr class="h-10 border-b border-kong-border bg-kong-bg-dark">
                      <th
                        class="text-left text-sm font-medium text-kong-text-secondary cursor-pointer"
                        on:click={() => toggleSort("pool_name")}
                      >
                        Pool
                        <svelte:component this={getSortIcon("pool_name")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                      <th
                        class="text-left text-sm font-medium text-kong-text-secondary cursor-pointer"
                        on:click={() => toggleSort("price")}
                      >
                        Price
                        <svelte:component this={getSortIcon("price")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                      <th
                        class="text-left text-sm font-medium text-kong-text-secondary cursor-pointer"
                        on:click={() => toggleSort("tvl")}
                      >
                        TVL
                        <svelte:component this={getSortIcon("tvl")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                      <th
                        class="text-left text-sm font-medium text-kong-text-secondary cursor-pointer"
                        on:click={() => toggleSort("rolling_24h_volume")}
                      >
                        Volume 24H
                        <svelte:component this={getSortIcon("rolling_24h_volume")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                      <th
                        class="text-left text-sm font-medium text-kong-text-secondary cursor-pointer"
                        on:click={() => toggleSort("rolling_24h_apy")}
                      >
                        APY
                        <svelte:component this={getSortIcon("rolling_24h_apy")} class="inline w-3.5 h-3.5 ml-1" />
                      </th>
                    </tr>
                  </thead>
                  <tbody class="!px-4 h-full">
                    {#each $filteredLivePools as pool, i (pool.address_0 + pool.address_1)}
                      <PoolRow
                        on:click={() => goto(`/pools/create?token0=${pool.address_0}&token1=${pool.address_1}`)}
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
                <div class="md:hidden space-y-4 mt-2 h-full">
                  {#each $filteredLivePools || [] as pool, i (pool.address_0 + pool.address_1)}
                    <div
                      class="bg-kong-bg-dark p-4 rounded-lg border border-kong-border hover:border-[#60A5FA]/30 transition-all duration-200 
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
                            <div class="text-xs text-kong-text-primary">
                              {pool.symbol_0}/{pool.symbol_1}
                            </div>
                            <div class="text-xs text-kong-text-secondary">
                              Pool Tokens
                            </div>
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <button
                            on:click={() => handleShowDetails(pool)}
                            class="px-4 py-2 text-sm bg-kong-bg-dark text-kong-text-primary rounded-lg hover:bg-kong-bg-dark/90 transition-colors duration-200"
                          >
                            Details
                          </button>
                        </div>
                      </div>

                      <div class="grid grid-cols-2 gap-4">
                        <div class="bg-kong-bg-dark/50 p-3 rounded-lg">
                          <div class="text-sm text-kong-text-secondary mb-1">Price</div>
                          <div class="font-medium text-kong-text-primary">
                            {getPoolPriceUsd(pool)}
                          </div>
                        </div>
                        <div class="bg-kong-bg-dark/50 p-3 rounded-lg">
                          <div class="text-sm text-kong-text-secondary mb-1">TVL</div>
                          <div class="font-medium text-kong-text-primary">
                            ${formatLargeNumber(Number(pool.tvl), false)}
                          </div>
                        </div>
                        <div class="bg-kong-bg-dark/50 p-3 rounded-lg">
                          <div class="text-sm text-kong-text-secondary mb-1">
                            Volume 24H
                          </div>
                          <div class="font-medium text-kong-text-primary">
                            ${formatLargeNumber(
                              Number(pool.rolling_24h_volume),
                            )}
                          </div>
                        </div>
                        <div class="bg-kong-bg-dark/50 p-3 rounded-lg">
                          <div class="text-sm text-kong-text-secondary mb-1">APY</div>
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
                    class="px-6 py-2 bg-kong-primary text-white rounded-lg hover:bg-[#60A5FA]/90 transition-colors duration-200"
                    on:click={() => {
                      sidebarStore.open();
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
  table th {
    padding: 0.5rem 0.5rem;
    color: #8890a4;
    font-weight: 500;
    font-size: 0.875rem;
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
