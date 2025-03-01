<script lang="ts">
  import {
    formatToNonZeroDecimal,
  } from "$lib/utils/numberFormatUtils";
  import { writable, derived } from "svelte/store";
  import Panel from "$lib/components/common/Panel.svelte";
  import PoolRow from "$lib/components/liquidity/pools/PoolRow.svelte";
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import {
    ArrowUp,
    ArrowDown,
    Droplets,
    Flame,
    TrendingUp,
    PiggyBank,
  } from "lucide-svelte";
  import PageHeader from "$lib/components/common/PageHeader.svelte";
  import { auth } from "$lib/services/auth";
  import { browser } from "$app/environment";
  import { getPoolPriceUsd } from "$lib/utils/statsUtils";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import DataTable from "$lib/components/common/DataTable.svelte";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { fetchPools, fetchPoolTotals } from "$lib/api/pools";
  import { page } from "$app/stores";
  import UserPoolList from "$lib/components/liquidity/pools/UserPoolList.svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { userPoolListStore } from "$lib/stores/userPoolListStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { fetchTokens } from "$lib/api/tokens";

  // Navigation state
  const activeSection = writable("pools");
  const activePoolView = writable("all");
  let isMobile = writable(false);
  let searchQuery = browser ? $page.url.searchParams.get("search") || "" : "";
  let pageQuery = browser
    ? parseInt($page.url.searchParams.get("page") || "1")
    : 1;
  let searchTerm = searchQuery;
  let searchInput = searchQuery;
  let poolSearchTerm = writable("");
  let searchDebounceTimer: NodeJS.Timeout;
  let livePools = writable<BE.Pool[]>([]);
  let pagination = { totalItems: 0, totalPages: 0, currentPage: 1, limit: 50 };
  let isLoading = writable<boolean>(false);
  let liveUserPools = writable<BE.Pool[]>([]);
  const mobileSortColumn = writable("rolling_24h_volume");
  const mobileSortDirection = writable<"asc" | "desc">("desc");

  let cleanup: () => void;

  // Add a debounce timer for URL changes
  let urlChangeDebounceTimer: NodeJS.Timeout;

  // After declaration of liveUserPools, add token support
  let allTokens = writable([]);
  const tokenMap = derived(allTokens, ($tokens) => {
    const map = new Map();
    if ($tokens) {
      $tokens.forEach((token) => {
        map.set(token.canister_id, token);
      });
    }
    return map;
  });

  // Add sortedMobilePools derived from livePools
  const sortedMobilePools = derived(
    [livePools, mobileSortColumn, mobileSortDirection],
    ([$livePools, $mobileSortColumn, $mobileSortDirection]) => {
      let sorted = [...$livePools];
      sorted.sort((a, b) => {
        // Always put KONG at the top
        if (
          a.address_0 === KONG_CANISTER_ID ||
          a.address_1 === KONG_CANISTER_ID
        )
          return -1;
        if (
          b.address_0 === KONG_CANISTER_ID ||
          b.address_1 === KONG_CANISTER_ID
        )
          return 1;

        let aValue, bValue;
        switch ($mobileSortColumn) {
          case "price":
            aValue = Number(getPoolPriceUsd(a));
            bValue = Number(getPoolPriceUsd(b));
            break;
          case "tvl":
            aValue = Number(a.tvl);
            bValue = Number(b.tvl);
            break;
          case "rolling_24h_volume":
            aValue = Number(a.rolling_24h_volume);
            bValue = Number(b.rolling_24h_volume);
            break;
          case "rolling_24h_apy":
            aValue = Number(a.rolling_24h_apy);
            bValue = Number(b.rolling_24h_apy);
            break;
          default:
            aValue = Number(a.rolling_24h_volume);
            bValue = Number(b.rolling_24h_volume);
        }
        return $mobileSortDirection === "asc"
          ? aValue - bValue
          : bValue - aValue;
      });
      return sorted;
    },
  );

  // Add new state variables for mobile pagination
  let mobilePage = 1;
  let mobileTotalPages = 0;
  let isMobileFetching = false;

  // Add scroll handler for mobile
  async function handleMobileScroll() {
    if (!browser) return;
    if (
      !$isMobile ||
      $activePoolView !== "all" ||
      isMobileFetching ||
      mobilePage >= mobileTotalPages
    )
      return;

    const container = document.querySelector(".mobile-pools-container");
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 100;

    if (isNearBottom) {
      isMobileFetching = true;
      try {
        const nextPage = mobilePage + 1;
        const result = await fetchPools({
          page: nextPage,
          limit: pagination.limit,
          search: searchTerm,
        });
        $livePools = [...$livePools, ...(result.pools || [])];
        mobilePage = nextPage;
        mobileTotalPages = result.total_pages;
      } catch (error) {
        console.error("Error fetching more pools:", error);
      } finally {
        isMobileFetching = false;
      }
    }
  }

  // Subscribe to auth changes and fetch user pools when authenticated
  $: if ($auth.isConnected && browser) {
    fetchUserPools();
  }

  // Add new state variable with other state variables
  let poolTotals = writable({
    total_volume_24h: 0,
    total_tvl: 0,
    total_fees_24h: 0,
  });

  // Update onMount to fetch totals
  onMount(() => {
    if (!browser) return;
    isLoading.set(true);
    loadTokens();

    // Fetch both pools and totals
    Promise.all([
      fetchPools({
        page: pageQuery,
        limit: pagination.limit,
        search: searchQuery,
      }),
      fetchPoolTotals(),
    ])
      .then(([poolsResult, totalsResult]) => {
        const poolsArray = poolsResult.pools ? poolsResult.pools : [];
        livePools.set(poolsArray);
        pagination.totalItems = poolsResult.total_count;
        pagination.totalPages = poolsResult.total_pages;
        pagination.currentPage = poolsResult.page;
        pagination.limit = poolsResult.limit;
        mobilePage = 1;
        mobileTotalPages = poolsResult.total_pages;

        // Set the totals from API
        poolTotals.set(totalsResult);
      })
      .catch((error) => {
        console.error("Error fetching pools:", error);
        livePools.set([]);
      })
      .finally(() => {
        isLoading.set(false);
      });

    if (browser) {
      window.addEventListener("resize", checkMobile);
      checkMobile();
    }
    cleanup = () => {
      if (browser) {
        window.removeEventListener("resize", checkMobile);
      }
    };
    return cleanup;
  });

  // Update the reactive statement with debounce
  $: if (browser) {
    clearTimeout(urlChangeDebounceTimer);
    urlChangeDebounceTimer = setTimeout(() => {
      const newSearch = $page.url.searchParams.get("search") || "";
      const newPage = parseInt($page.url.searchParams.get("page") || "1");

      // Only update if the values have actually changed
      if (newSearch !== searchTerm || newPage !== pagination.currentPage) {
        searchTerm = newSearch;
        searchInput = newSearch;
        pagination.currentPage = newPage;

        // Fetch pools with new parameters
        isLoading.set(true);
        fetchPools({
          page: newPage,
          limit: pagination.limit,
          search: newSearch,
        })
          .then((result) => {
            const poolsArray = result.pools ? result.pools : [];
            livePools.set(poolsArray);
            pagination.totalItems = result.total_count;
            pagination.totalPages = result.total_pages;
            pagination.currentPage = result.page;
            pagination.limit = result.limit;
            mobilePage = 1;
            mobileTotalPages = result.total_pages;
          })
          .catch((error) => {
            console.error("Error fetching pools:", error);
            livePools.set([]);
          })
          .finally(() => {
            isLoading.set(false);
          });
      }
    }, 350); // 350ms debounce
  }

  function handleSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(async () => {
      const searchValue = searchInput.trim().toLowerCase();
      if (searchValue !== searchTerm) {
        searchTerm = searchValue;
        poolSearchTerm.set(searchValue);

        goto(`/pools?search=${encodeURIComponent(searchValue)}&page=1`, {
          keepFocus: true,
          noScroll: true,
          replaceState: true,
        });

        isLoading.set(true);
        try {
          const result = await fetchPools({
            page: 1,
            limit: pagination.limit,
            search: searchValue,
          });
          livePools.set(result.pools || []);
          pagination.totalItems = result.total_count;
          pagination.totalPages = result.total_pages;
          pagination.currentPage = result.page;
          pagination.limit = result.limit;
          mobilePage = 1;
          mobileTotalPages = result.total_pages;
        } catch (error) {
          console.error("Error searching pools:", error);
        } finally {
          isLoading.set(false);
        }
      }
    }, 300);
  }

  const checkMobile = () => {
    if (!browser) return;
    $isMobile = window.innerWidth < 768;
  };

  $: if (browser) {
    checkMobile();
  }

  onDestroy(() => {
    cleanup?.();
    clearTimeout(searchDebounceTimer);
    clearTimeout(urlChangeDebounceTimer);
    // reset search properties
    searchTerm = "";
    poolSearchTerm.set("");
  });

  // Added function to fetch user pools
  async function fetchUserPools() {
    isLoading.set(true);
    try {
      await userPoolListStore.initialize();

      // Casting liveUserPools to any to call set
      $liveUserPools = $userPoolListStore.filteredPools as unknown as BE.Pool[];
    } catch (error) {
      console.error("Error fetching user pools:", error);
      $liveUserPools = [];
    } finally {
      isLoading.set(false);
    }
  }

  async function handlePageChange(page: number) {
    isLoading.set(true);
    try {
      goto(`/pools?search=${encodeURIComponent(searchTerm)}&page=${page}`, {
        keepFocus: true,
        noScroll: true,
        replaceState: true,
      });

      const result = await fetchPools({
        page,
        limit: pagination.limit,
        search: searchTerm,
      });
      livePools.set(result.pools || []);
      pagination.totalItems = result.total_count;
      pagination.totalPages = result.total_pages;
      pagination.currentPage = result.page;
      pagination.limit = result.limit;
    } catch (error) {
      console.error("Error fetching pools:", error);
    } finally {
      isLoading.set(false);
    }
  }

  function handlePoolClick(event: CustomEvent) {
    console.log("Pool clicked", event.detail);
  }

  // Add loadTokens function to load token data for mobile cards
  async function loadTokens() {
    try {
      const { tokens } = await fetchTokens();
      allTokens.set(tokens);
    } catch (error) {
      console.error("Error loading tokens:", error);
    }
  }
</script>

<svelte:head>
  <title>Liquidity Pools - KongSwap</title>
</svelte:head>

<PageHeader
  title="Liquidity Pools"
  description="Provide liquidity to earn trading fees and rewards"
  icon={Droplets}
  stats={[
    {
      label: "Vol 24H",
      value: `${formatUsdValue($poolTotals.total_volume_24h)}`,
      icon: TrendingUp,
    },
    {
      label: "TVL",
      value: `${formatUsdValue($poolTotals.total_tvl)}`,
      icon: PiggyBank,
    },
    {
      label: "Highest APY",
      value: `${Math.max(...($livePools || []).map((pool) => Number(pool.rolling_24h_apy))).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
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
          <div class="flex flex-col sticky top-0 z-20 backdrop-blur-md">
            <div class="flex flex-col gap-3 sm:gap-0">
              <!-- Mobile-only buttons -->
              <div class="sm:hidden space-y-2">
                <!-- Row 1: View Toggle & Search -->
                <div class="flex gap-2 w-full">
                  <!-- View Toggle -->
                  <div
                    class="flex border border-white/[0.08] rounded-lg overflow-hidden shadow-inner bg-white/[0.02]"
                  >
                    <button
                      class="px-3 py-2 text-sm {$activePoolView === 'all'
                        ? 'text-kong-text-primary bg-kong-primary/10 font-medium'
                        : 'text-kong-text-secondary'}"
                      on:click={() => ($activePoolView = "all")}
                    >
                      All
                    </button>
                    <div class="w-px bg-white/[0.04]"></div>
                    <button
                      class="px-3 py-2 text-sm {$activePoolView === 'user'
                        ? 'text-kong-text-primary bg-kong-primary/10 font-medium'
                        : 'text-kong-text-secondary'}"
                      on:click={() => {
                        $activePoolView = "user";
                        fetchUserPools();
                      }}
                    >
                      My ({$liveUserPools.length})
                    </button>
                  </div>

                  <!-- Search -->
                  <div class="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Search pools..."
                      class="w-full bg-white/[0.02] border border-white/[0.08] rounded-lg pl-8 pr-2 py-2 text-sm text-kong-text-primary placeholder-kong-text-secondary focus:outline-none focus:ring-1 focus:ring-kong-primary/20 transition-all duration-200"
                      bind:value={searchInput}
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
                      class="flex-1 flex bg-white/[0.02] border border-white/[0.08] rounded-lg overflow-hidden shadow-inner"
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
                      <div class="w-px bg-white/[0.04]"></div>
                      <button
                        on:click={() =>
                          mobileSortDirection.update((d) =>
                            d === "asc" ? "desc" : "asc",
                          )}
                        class="px-3 text-kong-primary"
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
                      class="bg-kong-primary text-white rounded-lg px-4 py-2 hover:bg-kong-primary-hover flex items-center gap-2 transition-all duration-200 shadow-md"
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
                      <span class="text-sm font-medium">Add</span>
                    </button>
                  </div>
                {/if}
              </div>
              <!-- Desktop view -->
              <div class="hidden sm:flex border-b border-white/[0.04] py-1">
                <div class="flex-1">
                  <div class="flex items-center">
                    <div class="flex bg-transparent">
                      <button
                        class="px-4 py-2 transition-colors duration-200 {$activePoolView ===
                        'all'
                          ? 'text-kong-text-primary font-medium'
                          : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                        on:click={() => ($activePoolView = "all")}
                      >
                        All Pools
                      </button>
                      {#if $auth.isConnected}
                        <button
                          class="px-4 py-2 transition-colors duration-200 {$activePoolView ===
                          'user'
                            ? 'text-kong-text-primary font-medium'
                            : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                          on:click={() => {
                            $activePoolView = "user";
                            fetchUserPools();
                          }}
                        >
                          My Pools <span
                            class="text-xs ml-1 font-bold py-0.5 text-white bg-kong-primary px-1.5 rounded"
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
                        class="w-full bg-transparent text-kong-text-primary placeholder-kong-text-secondary/70 focus:outline-none focus:border-b focus:border-kong-primary/20 transition-all duration-200 pb-1"
                        bind:value={searchInput}
                        on:input={handleSearch}
                      />
                    </div>
                  </div>
                </div>

                <button
                  class="-mt-2 -mb-1 flex items-center gap-2 rounded-none !rounded-tr-lg px-6 py-2 text-white bg-kong-primary hover:bg-kong-primary-hover hover:shadow-[0_0_15px_rgba(0,149,235,0.2)] transition-all duration-200"
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
                    class="text-white"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span class="font-medium">Add Liquidity</span>
                </button>
              </div>
            </div>
          </div>

          <div class="flex-1 overflow-hidden">
            {#if $activePoolView === "all"}
              <!-- All Pools View -->
              <div class="h-full overflow-auto">
                {#if $isMobile}
                  <!-- Mobile/Tablet Card View -->
                  <div
                    class="lg:hidden space-y-3 pb-3 h-full overflow-auto py-2 mobile-pools-container"
                    on:scroll={handleMobileScroll}
                  >
                    {#each $sortedMobilePools as pool, i (pool.address_0 + pool.address_1)}
                      <button
                        on:click={() =>
                          goto(
                            `/pools/add?token0=${pool.address_0}&token1=${pool.address_1}`,
                          )}
                        class="w-full text-left bg-white/[0.02] rounded-xl border border-white/[0.04] hover:border-kong-primary/20 hover:bg-white/[0.04] active:scale-[0.99] transition-all duration-200 overflow-hidden shadow-lg backdrop-blur-md {pool.address_0 ===
                          KONG_CANISTER_ID ||
                        pool.address_1 === KONG_CANISTER_ID
                          ? 'bg-gradient-to-br from-[rgba(0,149,235,0.05)] to-[rgba(0,149,235,0.02)] active:bg-[rgba(0,149,235,0.04)] shadow-[inset_0_1px_1px_rgba(0,149,235,0.1)]'
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
                              <div
                                class="text-base font-medium text-kong-text-primary"
                              >
                                {pool.symbol_0}/{pool.symbol_1}
                              </div>
                            </div>
                            <div
                              class="text-kong-primary text-base font-medium flex items-center gap-1.5 bg-kong-primary/5 px-2.5 py-1 rounded-lg"
                            >
                              <Flame class="w-4 h-4" />
                              {Number(pool.rolling_24h_apy).toFixed(2)}%
                            </div>
                          </div>

                          <!-- Pool Stats -->
                          <div class="grid grid-cols-3 gap-4">
                            <div class="bg-black/10 rounded-lg p-2.5">
                              <div
                                class="text-xs text-kong-text-secondary mb-1"
                              >
                                Price
                              </div>
                              <div
                                class="text-sm font-medium text-kong-text-primary"
                              >
                                {formatToNonZeroDecimal(getPoolPriceUsd(pool))}
                              </div>
                            </div>
                            <div class="bg-black/10 rounded-lg p-2.5">
                              <div
                                class="text-xs text-kong-text-secondary mb-1"
                              >
                                TVL
                              </div>
                              <div
                                class="text-sm font-medium text-kong-text-primary"
                              >
                                {formatUsdValue(Number(pool.tvl))}
                              </div>
                            </div>
                            <div class="bg-black/10 rounded-lg p-2.5">
                              <div
                                class="text-xs text-kong-text-secondary mb-1"
                              >
                                Volume 24h
                              </div>
                              <div
                                class="text-sm font-medium text-kong-text-primary"
                              >
                                {formatUsdValue(
                                  Number(pool.rolling_24h_volume),
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    {/each}
                    {#if isMobileFetching}
                      <div class="text-center text-kong-text-secondary py-4">
                        <div class="inline-block w-5 h-5 border-2 border-kong-primary/20 border-t-kong-primary rounded-full animate-spin mr-2"></div>
                        Loading more pools...
                      </div>
                    {/if}
                  </div>
                {:else}
                  <!-- Desktop Table View -->
                  <div class="hidden sm:flex sm:flex-col h-full">
                    <DataTable
                      data={$livePools}
                      rowKey="pool_id"
                      columns={[
                        {
                          key: "pool_name",
                          title: "Pool",
                          align: "left",
                          width: "30%",
                          sortable: true,
                          component: PoolRow,
                          componentProps: {},
                          sortValue: (row) => `${row.symbol_0}/${row.symbol_1}`,
                        },
                        {
                          key: "price",
                          title: "Price",
                          align: "right",
                          width: "17.5%",
                          sortable: true,
                          sortValue: (row) => Number(getPoolPriceUsd(row)),
                          formatter: (row) =>
                            formatToNonZeroDecimal(getPoolPriceUsd(row)),
                        },
                        {
                          key: "tvl",
                          title: "TVL",
                          align: "right",
                          width: "17.5%",
                          sortable: true,
                          sortValue: (row) => Number(row.tvl),
                          formatter: (row) => formatUsdValue(Number(row.tvl)),
                        },
                        {
                          key: "rolling_24h_volume",
                          title: "Vol 24H",
                          align: "right",
                          width: "17.5%",
                          sortable: true,
                          sortValue: (row) => Number(row.rolling_24h_volume),
                          formatter: (row) =>
                            formatUsdValue(Number(row.rolling_24h_volume)),
                        },
                        {
                          key: "rolling_24h_apy",
                          title: "APY",
                          align: "right",
                          width: "17.5%",
                          sortable: true,
                          sortValue: (row) => Number(row.rolling_24h_apy),
                          formatter: (row) =>
                            `${Number(row.rolling_24h_apy).toFixed(2)}%`,
                        },
                      ]}
                      itemsPerPage={pagination.limit}
                      totalItems={pagination.totalItems}
                      currentPage={pagination.currentPage}
                      defaultSort={{
                        column: "rolling_24h_volume",
                        direction: "desc",
                      }}
                      onPageChange={handlePageChange}
                      onRowClick={(row) =>
                        goto(
                          `/pools/add?token0=${row.address_0}&token1=${row.address_1}`,
                        )}
                      isKongRow={(row) =>
                        row.address_0 === KONG_CANISTER_ID ||
                        row.address_1 === KONG_CANISTER_ID}
                      isLoading={$isLoading}
                    ></DataTable>
                  </div>
                {/if}
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
                  class="flex flex-col items-center justify-center h-64 text-center p-6 bg-white/[0.02] rounded-xl border border-white/[0.04] shadow-lg backdrop-blur-md m-4"
                >
                  <div class="p-4 rounded-full bg-kong-primary/5 text-kong-primary/70 mb-4">
                    <Droplets size={40} />
                  </div>
                  <p class="text-lg font-medium text-kong-text-primary mb-2">
                    Connect your wallet to view your liquidity positions
                  </p>
                  <p class="text-sm text-kong-text-primary/60 max-w-md mb-6">
                    Provide liquidity to pools and earn trading fees and rewards
                  </p>
                  <button
                    class="px-6 py-2.5 bg-kong-primary text-white rounded-lg hover:bg-kong-primary-hover transition-all duration-200 flex items-center gap-2 shadow-md"
                    on:click={() => {
                      sidebarStore.open();
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <path d="M12 12h.01" />
                    </svg>
                    <span class="font-medium">Connect Wallet</span>
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

{#if $auth.isConnected && browser}
  <!-- Existing content -->
{:else}
  <div class="loading-state flex flex-col items-center justify-center h-64 gap-4">
    <div class="loading-animation">
      <Droplets size={32} class="animate-pulse text-kong-primary" />
    </div>
    <p class="loading-text text-base font-medium text-kong-text-primary/70">Loading pools...</p>
  </div>
{/if}
