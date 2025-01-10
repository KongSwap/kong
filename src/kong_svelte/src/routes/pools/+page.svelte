<script lang="ts">
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { writable, derived } from "svelte/store";
  import {
    livePools,
    liveUserPools,
    filteredLivePools,
    poolSearchTerm,
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
    Flame,
    TrendingUp,
    PiggyBank,
  } from "lucide-svelte";
  import PageHeader from "$lib/components/common/PageHeader.svelte";
  import PoolDetails from "$lib/components/liquidity/pools/PoolDetails.svelte";
  import { auth } from "$lib/services/auth";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import UserPoolList from "$lib/components/earn/UserPoolList.svelte";
  import { browser } from "$app/environment";
  import { getPoolPriceUsd } from "$lib/utils/statsUtils";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import DataTable from "$lib/components/common/DataTable.svelte";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";

  // Navigation state
  const activeSection = writable("pools");
  const activePoolView = writable("all");
  let showPoolDetails = false;
  let selectedPool = null;
  let selectedUserPool = null;
  let isMobile = writable(false);
  let searchTerm = "";
  let searchDebounceTimer: NodeJS.Timeout;
  const mobileSortColumn = writable("rolling_24h_volume");
  const mobileSortDirection = writable<"asc" | "desc">("desc");

  const tokenMap = derived(formattedTokens, ($tokens) => {
    const map = new Map();
    if ($tokens) {
      $tokens.forEach((token) => {
        map.set(token.canister_id, token);
      });
    }
    return map;
  });

  function handlePoolClick(event) {
    const pool = event.detail;
    const fullPool = $livePools.find(
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

  function handleSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      poolSearchTerm.set(searchTerm.trim().toLowerCase());
    }, 300);
  }

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

  onDestroy(() => {
    clearTimeout(searchDebounceTimer);
    // reset search properties
    searchTerm = "";
    poolSearchTerm.set("");
  });

  function handleMobileSort(column: string) {
    mobileSortColumn.update(currentColumn => {
      if (currentColumn === column) {
        mobileSortDirection.update(d => d === "asc" ? "desc" : "asc");
      } else {
        mobileSortColumn.set(column);
        mobileSortDirection.set("desc");
      }
      return column;
    });
  }

  const sortedMobilePools = derived(
    [filteredLivePools, mobileSortColumn, mobileSortDirection],
    ([$filteredLivePools, $mobileSortColumn, $mobileSortDirection]) => {
      let sorted = [...$filteredLivePools];
      sorted.sort((a, b) => {
        // Always ensure KONG is at the top regardless of sort
        if (a.address_0 === KONG_CANISTER_ID || a.address_1 === KONG_CANISTER_ID) return -1;
        if (b.address_0 === KONG_CANISTER_ID || b.address_1 === KONG_CANISTER_ID) return 1;

        let aValue, bValue;
        switch ($mobileSortColumn) {
          case 'price':
            aValue = Number(getPoolPriceUsd(a));
            bValue = Number(getPoolPriceUsd(b));
            break;
          case 'tvl':
            aValue = Number(a.tvl);
            bValue = Number(b.tvl);
            break;
          case 'rolling_24h_volume':
            aValue = Number(a.rolling_24h_volume);
            bValue = Number(b.rolling_24h_volume);
            break;
          case 'rolling_24h_apy':
            aValue = Number(a.rolling_24h_apy);
            bValue = Number(b.rolling_24h_apy);
            break;
          default:
            aValue = Number(a.rolling_24h_volume);
            bValue = Number(b.rolling_24h_volume);
        }
        return $mobileSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      });
      return sorted;
    }
  );
</script>

<PageHeader
  title="Liquidity Pools"
  description="Provide liquidity to earn trading fees and rewards"
  icon={Droplets}
  stats={[
    {
      label: "Vol 24H",
      value: `${formatUsdValue(
        formatBalance(
          $filteredLivePools.reduce(
            (acc, pool) => acc + Number(pool.rolling_24h_volume),
            0,
          ),
          6,
          2,
        ),
      )}`,
      icon: TrendingUp,
    },
    {
      label: "TVL",
      value: `${formatUsdValue(
        formatBalance(
          $filteredLivePools.reduce((acc, pool) => acc + Number(pool.tvl), 0),
          6,
          2,
        ),
      )}`,
      icon: PiggyBank,
    },
    {
      label: "Highest APY",
      value: `${Math.max(...$filteredLivePools.map(pool => Number(pool.rolling_24h_apy))).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
      icon: Flame,
      hideOnMobile: true,
    },
  ]}
/>

<section class="flex flex-col w-full h-[calc(100vh-13.8rem)] px-2 pb-4 mt-4">
  <div class="z-10 flex flex-col w-full h-full mx-auto gap-4 max-w-[1300px]">
    {#if $activeSection === "pools"}
      <Panel className="flex-1 {$isMobile ? '' : '!p-0'}" variant="transparent">
        <div class="overflow-hidden flex flex-col h-full">
          <!-- Header with full-width search and "My Pools" button -->
          <div class="flex flex-col sticky top-0 z-20">
            <div class="flex flex-col gap-3 sm:gap-0">
              <!-- Mobile-only buttons -->
              <div class="sm:hidden space-y-2">
                <!-- Row 1: View Toggle & Search -->
                <div class="flex gap-2 w-full">
                  <!-- View Toggle -->
                  <div
                    class="flex border border-kong-border rounded-lg overflow-hidden"
                  >
                    <button
                      class="px-3 py-2 text-sm {$activePoolView === 'all'
                        ? 'text-kong-text-primary bg-[#60A5FA]/10'
                        : 'text-kong-text-secondary'}"
                      on:click={() => ($activePoolView = "all")}
                    >
                      All
                    </button>
                    <div class="w-px bg-kong-border"></div>
                    <button
                      class="px-3 py-2 text-sm {$activePoolView === 'user'
                        ? 'text-kong-text-primary bg-[#60A5FA]/10'
                        : 'text-kong-text-secondary'}"
                      on:click={() => ($activePoolView = "user")}
                    >
                      My ({$liveUserPools.length})
                    </button>
                  </div>

                  <!-- Search -->
                  <div class="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Search pools..."
                      class="w-full bg-kong-bg-dark border border-kong-border rounded-lg pl-8 pr-2 py-2 text-sm text-kong-text-primary placeholder-kong-text-secondary focus:outline-none"
                      bind:value={searchTerm}
                      on:input={handleSearch}
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-kong-text-secondary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>

                <!-- Row 2: Sort & Add (Only show when viewing all pools) -->
                {#if $activePoolView === "all"}
                  <div class="flex gap-2 w-full">
                    <!-- Sort -->
                    <div
                      class="flex-1 flex bg-kong-bg-dark border border-kong-border rounded-lg overflow-hidden"
                    >
                      <select
                        bind:value={$mobileSortColumn}
                        class="flex-1 bg-transparent text-kong-text-primary text-sm focus:outline-none px-3 py-2"
                      >
                        <option value="rolling_24h_volume">Volume 24H</option>
                        <option value="tvl">TVL</option>
                        <option value="rolling_24h_apy">APY</option>
                        <option value="price">Price</option>
                      </select>
                      <div class="w-px bg-kong-border"></div>
                      <button
                        on:click={() => mobileSortDirection.update(d => d === "asc" ? "desc" : "asc")}
                        class="px-3 text-[#60A5FA]"
                      >
                        <svelte:component
                          this={$mobileSortDirection === "asc"
                            ? ArrowUp
                            : ArrowDown}
                          class="w-4 h-4"
                        />
                      </button>
                    </div>

                    <!-- Add Position Button -->
                    <button
                      class="bg-kong-bg-dark border border-kong-border rounded-lg px-4 py-2 text-kong-text-primary hover:bg-kong-bg-dark/90 flex items-center gap-2"
                      on:click={() => goto("/pools/add")}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <span class="text-sm">Add</span>
                    </button>
                  </div>
                {/if}
              </div>
              <!-- Desktop view -->
              <div class="hidden sm:flex er-b border-kong-border py-1">
                <div class="flex-1">
                  <div class="flex items-center">
                    <div class="flex bg-transparent">
                      <button
                        class="px-4 py-2 transition-colors duration-200 {$activePoolView ===
                        'all'
                          ? 'text-kong-text-primary'
                          : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                        on:click={() => ($activePoolView = "all")}
                      >
                        All Pools
                      </button>
                      {#if $auth.isConnected}
                        <button
                          class="px-4 py-2 transition-colors duration-200 {$activePoolView ===
                          'user'
                            ? 'text-kong-text-primary'
                            : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                          on:click={() => ($activePoolView = "user")}
                        >
                          My Pools <span
                            class="text-xs ml-1 font-bold py-0.5 text-white/80 bg-kong-primary/80 px-1.5 rounded"
                            >{$liveUserPools.length}</span
                          >
                        </button>
                      {/if}
                    </div>

                    <div class="flex-1 px-4 py-2">
                      <input
                        type="text"
                        placeholder={$isMobile == true
                          ? "Search pools..."
                          : "Search pools by name, symbol, or canister ID"}
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
          </div>

          <div class="flex-1 overflow-hidden">
            {#if $activePoolView === "all"}
              <!-- All Pools View -->
              <div class="h-full overflow-auto">
                <!-- Desktop Table View -->
                <div class="hidden lg:flex lg:flex-col h-full">
                  <DataTable
                    data={$filteredLivePools}
                    rowKey="pool_id"
                    columns={[
                      {
                        key: 'pool_name',
                        title: 'Pool',
                        align: 'left',
                        width: '30%',
                        sortable: true,
                        component: PoolRow,
                        sortValue: (row) => `${row.symbol_0}/${row.symbol_1}`
                      },
                      {
                        key: 'price',
                        title: 'Price',
                        align: 'right',
                        width: '17.5%',
                        sortable: true,
                        sortValue: (row) => Number(getPoolPriceUsd(row)),
                        formatter: (row) => getPoolPriceUsd(row)
                      },
                      {
                        key: 'tvl',
                        title: 'TVL',
                        align: 'right',
                        width: '17.5%',
                        sortable: true,
                        sortValue: (row) => Number(row.tvl),
                        formatter: (row) => formatUsdValue(formatBalance(Number(row.tvl), 6, 2))
                      },
                      {
                        key: 'rolling_24h_volume',
                        title: 'Vol 24H',
                        align: 'right',
                        width: '17.5%',
                        sortable: true,
                        sortValue: (row) => Number(row.rolling_24h_volume),
                        formatter: (row) => formatUsdValue(formatBalance(Number(row.rolling_24h_volume), 6, 2))
                      },
                      {
                        key: 'rolling_24h_apy',
                        title: 'APY',
                        align: 'right',
                        width: '17.5%',
                        sortable: true,
                        sortValue: (row) => Number(row.rolling_24h_apy),
                        formatter: (row) => `${Number(row.rolling_24h_apy).toFixed(2)}%`
                      }
                    ]}
                    itemsPerPage={100}
                    defaultSort={{ column: 'rolling_24h_volume', direction: 'desc' }}
                    onRowClick={(row) => goto(`/pools/add?token0=${row.address_0}&token1=${row.address_1}`)}
                    isKongRow={(row) => row.address_0 === KONG_CANISTER_ID || row.address_1 === KONG_CANISTER_ID}
                  />
                </div>

                <!-- Mobile/Tablet Card View -->
                <div class="lg:hidden space-y-3 pb-3 h-full overflow-auto py-2">
                  {#each $sortedMobilePools || [] as pool, i (pool.address_0 + pool.address_1)}
                    <button
                      on:click={() =>
                        goto(
                          `/pools/add?token0=${pool.address_0}&token1=${pool.address_1}`,
                        )}
                      class="w-full text-left bg-kong-bg-dark rounded-xl border border-kong-border/50 hover:border-[#60A5FA]/30 hover:bg-kong-bg-dark/80 active:scale-[0.99] transition-all duration-200 overflow-hidden shadow-lg backdrop-blur-sm
                            {pool.address_0 === KONG_CANISTER_ID ||
                      pool.address_1 === KONG_CANISTER_ID
                        ? 'bg-gradient-to-br from-[rgba(0,255,128,0.05)] to-[rgba(0,255,128,0.02)] active:bg-[rgba(0,255,128,0.04)] shadow-[inset_0_1px_1px_rgba(0,255,128,0.1)]'
                        : 'shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'}"
                    >
                      <div class="p-4">
                        <!-- Pool Header -->
                        <div class="flex items-center justify-between mb-4">
                          <div class="flex items-center gap-2.5">
                            <TokenImages
                              tokens={[
                                $tokenMap.get(pool.address_0),
                                $tokenMap.get(pool.address_1),
                              ]}
                              size={28}
                            />
                            <div class="text-base font-medium text-kong-text-primary">
                              {pool.symbol_0}/{pool.symbol_1}
                            </div>
                          </div>
                          <div class="text-[#60A5FA] text-base font-medium flex items-center gap-1.5 bg-[#60A5FA]/5 px-2.5 py-1 rounded-lg">
                            <Flame class="w-4 h-4" />
                            {Number(pool.rolling_24h_apy).toFixed(2)}%
                          </div>
                        </div>

                        <!-- Pool Stats -->
                        <div class="grid grid-cols-3 gap-4">
                          <div class="bg-black/20 rounded-lg p-2.5">
                            <div class="text-xs text-kong-text-secondary mb-1">
                              Price
                            </div>
                            <div class="text-sm font-medium text-kong-text-primary">
                              {getPoolPriceUsd(pool)}
                            </div>
                          </div>
                          <div class="bg-black/20 rounded-lg p-2.5">
                            <div class="text-xs text-kong-text-secondary mb-1">
                              TVL
                            </div>
                            <div class="text-sm font-medium text-kong-text-primary">
                              {formatUsdValue(
                                formatBalance(Number(pool.tvl), 6, 2),
                              )}
                            </div>
                          </div>
                          <div class="bg-black/20 rounded-lg p-2.5">
                            <div class="text-xs text-kong-text-secondary mb-1">
                              Volume 24h
                            </div>
                            <div class="text-sm font-medium text-kong-text-primary">
                              {formatUsdValue(
                                formatBalance(
                                  Number(pool.rolling_24h_volume),
                                  6,
                                  2,
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
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
  /* Only keep Firefox-specific select styling if needed */
  select {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }
</style>
