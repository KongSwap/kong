<script lang="ts">
  import { formatBalance, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
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
  import { fetchPools } from "$lib/api/pools";
  import { page } from '$app/stores';
  import UserPoolList from "$lib/components/earn/UserPoolList.svelte";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import { PoolService } from "$lib/services/pools/PoolService";

  // Navigation state
  const activeSection = writable("pools");
  const activePoolView = writable("all");
  let isMobile = writable(false);
  let searchQuery = $page.url.searchParams.get('search') || '';
  let pageQuery = parseInt($page.url.searchParams.get('page') || '1');
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

  // Subscribe to auth changes and fetch user pools when authenticated
  $: if ($auth.isConnected && browser) {
    fetchUserPools();
  }

  onMount(() => {
    isLoading.set(true);
    fetchPools({
      page: pageQuery,
      limit: pagination.limit,
      search: searchQuery
    })
    .then((result) => {
      const poolsArray = result.pools ? result.pools : [];
      livePools.set(poolsArray);
      pagination.totalItems = result.total_count;
      pagination.totalPages = result.total_pages;
      pagination.currentPage = result.page;
      pagination.limit = result.limit;
    })
    .catch((error) => {
      console.error('Error fetching pools:', error);
      livePools.set([]);
    })
    .finally(() => {
      isLoading.set(false);
    });

    window.addEventListener("resize", checkMobile);
    checkMobile();
    cleanup = () => {
      window.removeEventListener("resize", checkMobile);
    };
    return cleanup;
  });

  // Update the reactive statement with debounce
  $: {
    clearTimeout(urlChangeDebounceTimer);
    urlChangeDebounceTimer = setTimeout(() => {
      const newSearch = $page.url.searchParams.get('search') || '';
      const newPage = parseInt($page.url.searchParams.get('page') || '1');
      
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
          search: newSearch
        })
        .then((result) => {
          const poolsArray = result.pools ? result.pools : [];
          livePools.set(poolsArray);
          pagination.totalItems = result.total_count;
          pagination.totalPages = result.total_pages;
          pagination.currentPage = result.page;
          pagination.limit = result.limit;
        })
        .catch((error) => {
          console.error('Error fetching pools:', error);
          livePools.set([]);
        })
        .finally(() => {
          isLoading.set(false);
        });
      }
    }, 100); // 100ms debounce
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
          replaceState: true
        });

        isLoading.set(true);
        try {
          const result = await fetchPools({ 
            page: 1, 
            limit: pagination.limit,
            search: searchValue
          });
          livePools.set(result.pools || []);
          pagination.totalItems = result.total_count;
          pagination.totalPages = result.total_pages;
          pagination.currentPage = result.page;
          pagination.limit = result.limit;
        } catch (error) {
          console.error('Error searching pools:', error);
        } finally {
          isLoading.set(false);
        }
      }
    }, 300);
  }

  const checkMobile = () => {
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
      const result = await PoolService.fetchUserPoolBalances(true);

      // Casting liveUserPools to any to call set
      $liveUserPools = result as unknown as BE.Pool[];
    } catch (error) {
      console.error('Error fetching user pools:', error);
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
        replaceState: true
      });

      const result = await fetchPools({ 
        page, 
        limit: pagination.limit,
        search: searchTerm
      });
      livePools.set(result.pools || []);
      pagination.totalItems = result.total_count;
      pagination.totalPages = result.total_pages;
      pagination.currentPage = result.page;
      pagination.limit = result.limit;
    } catch (error) {
      console.error('Error fetching pools:', error);
    } finally {
      isLoading.set(false);
    }
  }

  function handlePoolClick(event: CustomEvent) {
    console.log('Pool clicked', event.detail);
  }
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
          ($livePools || []).reduce((acc, pool) => acc + Number(pool.rolling_24h_volume), 0),
          0,
          2
        )
      )}`,
      icon: TrendingUp,
    },
    {
      label: "TVL",
      value: `${formatUsdValue(
        formatBalance(
          ($livePools || []).reduce((acc, pool) => acc + Number(pool.tvl), 0),
          0,
          2
        )
      )}`,
      icon: PiggyBank,
    },
    {
      label: "Highest APY",
      value: `${Math.max(...($livePools || []).map(pool => Number(pool.rolling_24h_apy))).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
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
                      on:click={() => { $activePoolView = "user"; fetchUserPools(); }}
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
                          on:click={() => { $activePoolView = "user"; fetchUserPools(); }}
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
                        bind:value={searchInput}
                        on:input={handleSearch}
                      />
                    </div>
                  </div>
                </div>

                <button
                  class="-mt-2 -mb-1 flex items-center gap-2 rounded-none !rounded-tr-lg px-6 py-2 text-white bg-kong-primary/20 hover:bg-kong-primary hover:text-white hover:border-[#60A5FA]/30 hover:drop-shadow-[0_0_8px_rgba(96,165,250,0.3)] transition-all duration-200"
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
                <!-- Desktop Table View -->
                <div class="hidden sm:flex sm:flex-col h-full">
                  <DataTable
                    data={$livePools}
                    rowKey="pool_id"
                    columns={[
                      {
                        key: 'pool_name',
                        title: 'Pool',
                        align: 'left',
                        width: '30%',
                        sortable: true,
                        component: PoolRow,
                        componentProps: {},
                        sortValue: (row) => `${row.symbol_0}/${row.symbol_1}`,
                      },
                      {
                        key: 'price',
                        title: 'Price',
                        align: 'right',
                        width: '17.5%',
                        sortable: true,
                        sortValue: (row) => Number(getPoolPriceUsd(row)),
                        formatter: (row) => formatToNonZeroDecimal(getPoolPriceUsd(row))
                      },
                      {
                        key: 'tvl',
                        title: 'TVL',
                        align: 'right',
                        width: '17.5%',
                        sortable: true,
                        sortValue: (row) => Number(row.tvl),
                        formatter: (row) => formatUsdValue(Number(row.tvl))
                      },
                      {
                        key: 'rolling_24h_volume',
                        title: 'Vol 24H',
                        align: 'right',
                        width: '17.5%',
                        sortable: true,
                        sortValue: (row) => Number(row.rolling_24h_volume),
                        formatter: (row) => formatUsdValue(Number(row.rolling_24h_volume))
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
                    itemsPerPage={pagination.limit}
                    totalItems={pagination.totalItems}
                    currentPage={pagination.currentPage}
                    defaultSort={{ column: 'rolling_24h_volume', direction: 'desc' }}
                    onPageChange={handlePageChange}
                    onRowClick={(row) => goto(`/pools/add?token0=${row.address_0}&token1=${row.address_1}`)}
                    isKongRow={(row) => row.address_0 === KONG_CANISTER_ID || row.address_1 === KONG_CANISTER_ID}
                    isLoading={$isLoading}
                  ></DataTable>
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
                <div class="flex flex-col items-center justify-center h-64 text-center">
                  <p class="text-gray-400 mb-4">
                    Connect your wallet to view your liquidity positions
                  </p>
                  <button
                    class="px-6 py-2 bg-kong-primary text-white rounded-lg hover:bg-[#60A5FA]/90 transition-colors duration-200"
                    on:click={() => { sidebarStore.open(); }}
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