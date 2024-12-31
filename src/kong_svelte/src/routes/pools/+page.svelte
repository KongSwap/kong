<script lang="ts">
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { writable, derived } from "svelte/store";
  import {
    livePools,
    liveUserPools,
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
    Flame,
    TrendingUp,
  } from "lucide-svelte";
  import PageHeader from "$lib/components/common/PageHeader.svelte";
  import PoolDetails from "$lib/components/liquidity/pools/PoolDetails.svelte";
  import { auth } from "$lib/services/auth";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import UserPoolList from "$lib/components/earn/UserPoolList.svelte";
  import { browser } from "$app/environment";
  import { getPoolPriceUsd } from "$lib/utils/statsUtils";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";

  // Navigation state
  const activeSection = writable("pools");
  const activePoolView = writable("all");
  let showPoolDetails = false;
  let selectedPool = null;
  let selectedUserPool = null;
  let isMobile = writable(false);
  let searchTerm = "";
  let searchDebounceTimer: NodeJS.Timeout;
  const KONG_CANISTER_ID = "o7oak-iyaaa-aaaaq-aadzq-cai";

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

  const highestApr = derived(livePools, ($pools) => {
    if (!$pools || $pools.length === 0) return 0;
    return Math.max(...$pools.map((pool) => Number(pool.rolling_24h_apy)));
  });

  function toggleSort(column: string) {
    if ($poolSortColumn === column) {
      poolSortDirection.set($poolSortDirection === "asc" ? "desc" : "asc");
    } else {
      poolSortColumn.set(column);
      poolSortDirection.set("desc");
    }
  }

  function getSortIcon(column: string) {
    if ($poolSortColumn !== column) return ArrowUpDown;
    return $poolSortDirection === "asc" ? ArrowUp : ArrowDown;
  }

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

  onDestroy(() => {
    clearTimeout(searchDebounceTimer);
    // reset search properties
    searchTerm = "";
    poolSearchTerm.set("");
  });
</script>

<PageHeader
  title="Liquidity Pools"
  description="Provide liquidity to earn trading fees and rewards"
  icon={Droplets}
  stats={[
    {
      label: "Volume 24H",
      value: `${formatUsdValue(
        formatBalance(
          $livePools.reduce(
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
          $livePools.reduce((acc, pool) => acc + Number(pool.tvl), 0),
          6,
          2,
        ),
      )}`,
      icon: TrendingUp,
    },
    {
      label: "Highest APY",
      value: `${$highestApr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
      icon: Flame,
      hideOnMobile: true,
    },
  ]}
/>

<section class="flex flex-col w-full h-[calc(100vh-13.8rem)] px-2 pb-4 mt-4">
  <div class="z-10 flex flex-col w-full h-full mx-auto gap-4 max-w-[1300px]">
    {#if $activeSection === "pools"}
      <Panel className="flex-1 {$isMobile ? '' : '!p-0'}">
        <div class="overflow-hidden flex flex-col">
          <!-- Header with full-width search and "My Pools" button -->
          <div class="flex flex-col sticky top-0 z-20">
            <div class="flex flex-col gap-3 sm:gap-0 sticky top-0 z-10">
              <!-- Mobile-only buttons -->
              <div class="sm:hidden px-2 space-y-2">
                <!-- Row 1: View Toggle & Search -->
                <div class="flex gap-2 w-full">
                  <!-- View Toggle -->
                  <div
                    class="flex bg-kong-bg-dark border border-kong-border rounded-lg overflow-hidden"
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
                        bind:value={$poolSortColumn}
                        class="flex-1 bg-transparent text-kong-text-primary text-sm focus:outline-none px-3 py-2"
                      >
                        <option value="rolling_24h_volume">Volume 24H</option>
                        <option value="tvl">TVL</option>
                        <option value="rolling_24h_apy">APY</option>
                        <option value="price">Price</option>
                      </select>
                      <div class="w-px bg-kong-border"></div>
                      <button
                        on:click={() =>
                          poolSortDirection.update((d) =>
                            d === "asc" ? "desc" : "asc",
                          )}
                        class="px-3 text-[#60A5FA]"
                      >
                        <svelte:component
                          this={$poolSortDirection === "asc"
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

          <div class="h-full custom-scrollbar overflow-y-auto">
            {#if $activePoolView === "all"}
              <!-- All Pools View -->
              <div class="overflow-auto {$isMobile ? '' : ''} custom-scrollbar">
                <!-- Desktop Table View -->
                <table
                  class="w-full hidden md:table relative [&_th:first-child]:pl-4 [&_td:first-child]:pl-4 [&_th:last-child]:pr-4 [&_td:last-child]:pr-4"
                >
                  <thead class="sticky top-0 z-10 bg-kong-bg-dark">
                    <tr
                      class="h-10 border-b border-kong-border bg-kong-bg-dark"
                    >
                      <th
                        class="text-left text-sm font-medium text-kong-text-secondary cursor-pointer"
                        on:click={() => toggleSort("pool_name")}
                      >
                        Pool
                        <svelte:component
                          this={getSortIcon("pool_name")}
                          class="inline w-3.5 h-3.5 ml-1"
                        />
                      </th>
                      <th
                        class="text-left text-sm font-medium text-kong-text-secondary cursor-pointer"
                        on:click={() => toggleSort("price")}
                      >
                        Price
                        <svelte:component
                          this={getSortIcon("price")}
                          class="inline w-3.5 h-3.5 ml-1"
                        />
                      </th>
                      <th
                        class="text-left text-sm font-medium text-kong-text-secondary cursor-pointer"
                        on:click={() => toggleSort("tvl")}
                      >
                        TVL
                        <svelte:component
                          this={getSortIcon("tvl")}
                          class="inline w-3.5 h-3.5 ml-1"
                        />
                      </th>
                      <th
                        class="text-left text-sm font-medium text-kong-text-secondary cursor-pointer"
                        on:click={() => toggleSort("rolling_24h_volume")}
                      >
                        Volume 24H
                        <svelte:component
                          this={getSortIcon("rolling_24h_volume")}
                          class="inline w-3.5 h-3.5 ml-1"
                        />
                      </th>
                      <th
                        class="text-left text-sm font-medium text-kong-text-secondary cursor-pointer"
                        on:click={() => toggleSort("rolling_24h_apy")}
                      >
                        APY
                        <svelte:component
                          this={getSortIcon("rolling_24h_apy")}
                          class="inline w-3.5 h-3.5 ml-1"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody class="!px-4 h-full">
                    {#each $filteredLivePools as pool, i (pool.address_0 + pool.address_1)}
                      <PoolRow
                        on:click={() =>
                          goto(
                            `/pools/add?token0=${pool.address_0}&token1=${pool.address_1}`,
                          )}
                        pool={{
                          ...pool,
                          tvl: BigInt(pool.tvl),
                          rolling_24h_volume: BigInt(pool.rolling_24h_volume),
                          displayTvl: Number(pool.tvl) / 1e6,
                        } as BE.Pool & { displayTvl: number }}
                        tokenMap={$tokenMap}
                        isEven={i % 2 === 0}
                        isKongPool={pool.address_0 === KONG_CANISTER_ID ||
                          pool.address_1 === KONG_CANISTER_ID}
                      />
                    {/each}
                  </tbody>
                </table>

                <!-- Mobile/Tablet Card View -->
                <div class="md:hidden space-y-2.5 mt-2 h-full">
                  {#each $filteredLivePools || [] as pool, i (pool.address_0 + pool.address_1)}
                    <button
                      on:click={() =>
                        goto(
                          `/pools/add?token0=${pool.address_0}&token1=${pool.address_1}`,
                        )}
                      class="w-full text-left bg-kong-bg-dark rounded-lg border border-kong-border hover:border-[#60A5FA]/30 transition-all duration-200
                            {pool.address_0 === KONG_CANISTER_ID ||
                      pool.address_1 === KONG_CANISTER_ID
                        ? 'bg-gradient-to-b from-[rgba(0,255,128,0.02)] to-[rgba(0,255,128,0.01)] active:bg-[rgba(0,255,128,0.04)]'
                        : ''}"
                    >
                      <!-- Pool Header -->
                      <div class="p-3 border-b border-kong-border">
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <TokenImages
                              tokens={[
                                $tokenMap.get(pool.address_0),
                                $tokenMap.get(pool.address_1),
                              ]}
                              size={28}
                            />
                            <div>
                              <div
                                class="text-sm font-medium text-kong-text-primary"
                              >
                                {pool.symbol_0}/{pool.symbol_1}
                              </div>
                            </div>
                          </div>
                          <div class="text-[#60A5FA] text-sm font-medium">
                            {Number(pool.rolling_24h_apy).toFixed(2)}% APY
                          </div>
                        </div>
                      </div>

                      <!-- Pool Stats -->
                      <div class="p-3">
                        <div class="grid grid-cols-2 gap-2">
                          <div>
                            <div
                              class="text-xs text-kong-text-secondary mb-0.5"
                            >
                              Price
                            </div>
                            <div
                              class="text-sm font-medium text-kong-text-primary"
                            >
                              {getPoolPriceUsd(pool)}
                            </div>
                          </div>
                          <div>
                            <div
                              class="text-xs text-kong-text-secondary mb-0.5"
                            >
                              TVL
                            </div>
                            <div
                              class="text-sm font-medium text-kong-text-primary"
                            >
                              {formatUsdValue(
                                formatBalance(Number(pool.tvl), 6, 2),
                              )}
                            </div>
                          </div>
                          <div class="mt-2">
                            <div
                              class="text-xs text-kong-text-secondary mb-0.5"
                            >
                              Volume 24h
                            </div>
                            <div
                              class="text-sm font-medium text-kong-text-primary"
                            >
                              {formatUsdValue(
                                formatBalance(
                                  Number(pool.rolling_24h_volume),
                                  6,
                                  2,
                                ),
                              )}
                            </div>
                          </div>
                          <div class="mt-2">
                            <div
                              class="text-xs text-kong-text-secondary mb-0.5"
                            >
                              Fees 24h
                            </div>
                            <div
                              class="text-sm font-medium text-kong-text-primary"
                            >
                              {formatUsdValue(
                                formatBalance(
                                  Number(pool.rolling_24h_lp_fee),
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
