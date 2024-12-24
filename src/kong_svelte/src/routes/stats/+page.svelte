<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  import { writable, derived } from "svelte/store";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import Panel from "$lib/components/common/Panel.svelte";
  import { liveTokens } from "$lib/services/tokens/tokenStore";
  import { livePoolTotals } from "$lib/services/pools/poolStore";
  import { ArrowUp, ArrowDown, Star, ArrowUpDown, Flame } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/services/auth";
  import { browser } from "$app/environment";
  import StatsCards from "$lib/components/stats/StatsCards.svelte";
  import TokenCardMobile from "$lib/components/stats/TokenCardMobile.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import StatsTableRow from "$lib/components/stats/StatsTableRow.svelte";
  import { FavoriteService } from "$lib/services/tokens/favoriteService";

  // Optional: A simple search store to filter tokens locally
  const searchTerm = writable("");
  const showFavoritesOnly = writable(false);
  const activeStatsSection = writable<"tokens" | "marketStats">("tokens");
  const sortColumnStore = writable<string>("marketCap");
  const sortDirectionStore = writable<"asc" | "desc">("desc");

  // Create a reactive store for the favorite count
  const favoriteCount = writable(0);

  // Add a store for favorite token IDs
  const favoriteTokenIds = writable<string[]>([]);

  // Update favorite tokens when auth changes
  $: if ($auth.isConnected) {
    FavoriteService.getFavoriteCount().then(count => {
      favoriteCount.set(count);
    });
    FavoriteService.loadFavorites().then(favorites => {
      favoriteTokenIds.set(favorites);
    });
  } else {
    favoriteTokenIds.set([]);
    favoriteCount.set(0);
  }

  // Filter tokens by symbol/name/canister_id
  const filteredTokens = derived(
    [liveTokens, searchTerm, sortColumnStore, sortDirectionStore, showFavoritesOnly, favoriteTokenIds],
    ([$liveTokens, $search, $sortColumn, $sortDirection, $showFavoritesOnly, $favoriteTokenIds]) => {
      const s = $search.trim().toLowerCase();
      let filtered = [...$liveTokens];

      // Filter by favorites if enabled
      if ($showFavoritesOnly && $auth.isConnected) {
        filtered = filtered.filter(token => $favoriteTokenIds.includes(token.canister_id));
      }

      // Filter by search term
      if (s) {
        filtered = filtered.filter((token) => {
          const symbol = token.symbol?.toLowerCase() || "";
          const name = token.name?.toLowerCase() || "";
          const canisterID = token.canister_id.toLowerCase();
          return symbol.includes(s) || name.includes(s) || canisterID.includes(s);
        });
      }

      // First sort by market cap to determine ranks
      const rankedTokens = filtered.sort((a, b) => {
        const aMarketCap = Number(a.metrics?.market_cap || 0);
        const bMarketCap = Number(b.metrics?.market_cap || 0);
        return bMarketCap - aMarketCap;
      }).map((token, index) => ({
        ...token,
        marketCapRank: index + 1
      }));

      // Sort the filtered tokens
      const sortedTokens = rankedTokens.sort((a, b) => {
        let aValue, bValue;
        switch ($sortColumn) {
          case "marketCapRank":
            aValue = a.marketCapRank || 0;
            bValue = b.marketCapRank || 0;
            break;
          case "marketCap":
            aValue = Number(a.metrics?.market_cap || 0);
            bValue = Number(b.metrics?.market_cap || 0);
            break;
          case "volume_24h":
            aValue = Number(a.metrics?.volume_24h || 0);
            bValue = Number(b.metrics?.volume_24h || 0);
            break;
          case "tvl":
            aValue = Number(a.metrics?.tvl || 0);
            bValue = Number(b.metrics?.tvl || 0);
            break;
          case "price_change_24h":
            aValue = Number(a.metrics?.price_change_24h || 0);
            bValue = Number(b.metrics?.price_change_24h || 0);
            break;
          default:
            aValue = Number(a.metrics?.market_cap || 0);
            bValue = Number(b.metrics?.market_cap || 0);
        }
        return $sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      });

      // Always ensure KONG is at the top regardless of sort
      return sortedTokens.sort((a, b) => {
        if (a.canister_id === KONG_CANISTER_ID) return -1;
        if (b.canister_id === KONG_CANISTER_ID) return 1;
        return 0;
      });
    }
  );

  const isMobile = writable(false);

  onMount(() => {
    const checkMobile = () => {
      if (browser) {
        isMobile.set(window.innerWidth < 768);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  });

  $: if (browser) {
    isMobile.set(window.innerWidth < 768);
  }

  function toggleSort(column: string) {
    if ($sortColumnStore === column) {
      sortDirectionStore.update((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      sortColumnStore.set(column);
      sortDirectionStore.set("desc");
    }
  }

  function getSortIcon(column: string) {
    if ($sortColumnStore !== column) return ArrowUpDown;
    return $sortDirectionStore === "asc" ? ArrowUp : ArrowDown;
  }

  // Price change class functions
  function getPriceClass(token: FE.Token): string {
    const flashClass =
      token.metrics?.price > token.metrics?.previous_price
        ? "flash-green"
        : token.metrics?.price < token.metrics?.previous_price
          ? "flash-red"
          : "";

    return flashClass;
  }

  function getTrendClass(token: FE.Token): string {
    return token?.metrics?.price_change_24h
      ? Number(token.metrics.price_change_24h) > 0
        ? "positive"
        : Number(token.metrics.price_change_24h) < 0
          ? "negative"
          : ""
      : "";
  }

  const scrollY = writable(0);
  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    if (target) {
      scrollY.set(target.scrollTop);
    }
  }

  // Simple input handler
  function handleSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    searchTerm.set(input.value);
  }

  const ITEM_HEIGHT = 84; // height of each mobile card in pixels
  const visibleItems = derived([scrollY, filteredTokens], ([$scrollY, $tokens]) => {
    const start = Math.floor($scrollY / ITEM_HEIGHT);
    const end = Math.min(start + 20, $tokens.length); // Show 20 items at a time
    return $tokens.slice(start, end).map((token, index) => ({
      token,
      y: (start + index) * ITEM_HEIGHT
    }));
  });

  let tableBody: HTMLElement;
  let tableHeader: HTMLElement;
  
  onMount(() => {
    const syncHeaderScroll = () => {
      if (tableHeader && tableBody) {
        tableHeader.scrollLeft = tableBody.scrollLeft;
      }
    };
    
    if (tableBody) {
      tableBody.addEventListener('scroll', syncHeaderScroll);
    }
    
    return () => {
      if (tableBody) {
        tableBody.removeEventListener('scroll', syncHeaderScroll);
      }
    };
  });

  // Add this function to handle favorite toggle events
  function handleFavoriteToggle(event: CustomEvent) {
    const { canisterId, isFavorite } = event.detail;
    favoriteTokenIds.update(ids => {
      if (isFavorite) {
        return [...ids, canisterId];
      } else {
        return ids.filter(id => id !== canisterId);
      }
    });
  }

  onMount(() => {
    // Add event listener for favorite toggles
    window.addEventListener('favoriteToggled', handleFavoriteToggle as EventListener);
    
    // Initial load of favorites
    if ($auth.isConnected) {
      FavoriteService.loadFavorites().then(favorites => {
        favoriteTokenIds.set(favorites);
      });
    }

    return () => {
      window.removeEventListener('favoriteToggled', handleFavoriteToggle as EventListener);
    };
  });

  // Update favorite count whenever favoriteTokenIds changes
  $: favoriteCount.set($favoriteTokenIds.length);

  // Update the favorites button click handler
  async function handleFavoritesClick() {
    if (!$auth.isConnected) return;
    showFavoritesOnly.update(v => !v);
  }

  // Update StatsTableRow to pass the favorite status
  function isTokenFavorited(tokenId: string): boolean {
    return $favoriteTokenIds.includes(tokenId);
  }
</script>

<section class="flex flex-col w-full h-[100dvh] px-4">
  <div class="z-10 flex flex-col w-full h-full mx-auto gap-4 max-w-[1300px]">
    {#if $isMobile}
      <div class="flex gap-4 sticky top-0 z-30">
        <button
          class="flex-1 px-4 py-2 rounded-lg transition-colors duration-200
                 {$activeStatsSection === 'tokens'
            ? 'bg-kong-primary text-white'
            : 'bg-[#2a2d3d] text-[#8890a4]'}"
          on:click={() => activeStatsSection.set("tokens")}
        >
          Tokens
        </button>
        <button
          class="flex-1 px-4 py-2 rounded-lg transition-colors duration-200
                 {$activeStatsSection === 'marketStats'
            ? 'bg-kong-primary text-white'
            : 'bg-[#2a2d3d] text-[#8890a4]'}"
          on:click={() => activeStatsSection.set("marketStats")}
        >
          Market Stats
        </button>
      </div>
    {/if}

    {#if !$isMobile || ($isMobile && $activeStatsSection === "marketStats")}
      <StatsCards
        volume24h={Number($livePoolTotals[0]?.total_24h_volume ?? 0) / 1e6}
        totalLiquidity={Number($livePoolTotals[0]?.total_tvl ?? 0) / 1e6}
        totalFees={Number($livePoolTotals[0]?.total_24h_lp_fee ?? 0) / 1e6}
        isMobile={$isMobile}
      />
    {/if}

    {#if $activeStatsSection === "tokens"}
      <Panel
        variant="green"
        type="main"
        className="content-panel flex-1 !p-0 mt-2"
        height="100%"
      >
        <div class="flex flex-col h-full">
          <div class="flex flex-col gap-3 sm:gap-0 sticky top-0 z-10">
            <div
              class="hidden sm:flex items-center gap-3 pb-1 border-b border-[#2a2d3d] pt-2"
            >
              <div class="flex bg-transparent">
                <button
                  class="px-4 py-2 transition-colors duration-200 {$showFavoritesOnly
                    ? 'text-[#8890a4] hover:text-white'
                    : 'text-white'}"
                  on:click={() => showFavoritesOnly.set(false)}
                >
                  All Tokens
                </button>
                <button
                  class="px-4 py-2 transition-colors duration-200 {$showFavoritesOnly
                    ? 'text-white'
                    : 'text-[#8890a4] hover:text-white'}"
                  on:click={handleFavoritesClick}
                >
                  My Favorites
                  {#if $auth.isConnected}
                    <span
                      class="ml-1 px-2 py-0.5 text-white/80 bg-blue-400/60 rounded text-xs"
                    >
                      {$favoriteCount}
                    </span>
                  {/if}
                </button>
              </div>

              <div class="flex-1 px-4 py-2">
                <input
                  type="text"
                  placeholder={$isMobile
                    ? "Search tokens..."
                    : "Search tokens by name, symbol, or canister ID"}
                  class="w-full bg-transparent text-white placeholder-[#8890a4] focus:outline-none"
                  on:input={handleSearch}
                  disabled={$showFavoritesOnly}
                />
              </div>
            </div>
          </div>

          {#if $filteredTokens.length === 0}
            <div
              class="flex flex-col items-center justify-center h-64 text-center"
            >
              <p class="text-gray-400">
                No tokens found matching your search criteria
              </p>
            </div>
          {:else}
            <div
              class="flex-1 custom-scrollbar {$isMobile
                ? 'h-[calc(99vh-11rem)]'
                : 'h-[calc(100vh-1rem)]'}"
            >
              {#if !$isMobile}
                <!-- Desktop table view -->
                <div class="flex flex-col h-full">
                  <!-- Header outside scroll area -->
                  <table
                    bind:this={tableHeader}
                    class="w-full border-collapse min-w-[800px] md:min-w-0 sticky top-0 z-20"
                  >
                    <thead class="bg-[#1E1F2A] sticky top-0 z-20">
                      <tr class="h-10 border-b border-[#2a2d3d] bg-white/[0.02]">
                        <th
                          class="col-rank text-center py-2 text-no-wrap text-sm font-medium text-[#8890a4] text-nowrap cursor-pointer hover:bg-white/5 transition-colors duration-200"
                          on:click={() => toggleSort("marketCapRank")}
                        >
                          #
                          <svelte:component
                            this={getSortIcon("marketCapRank")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                        <th
                          class="col-token text-left py-2 pl-2 text-no-wrap text-sm font-medium text-[#8890a4] text-nowrap cursor-pointer hover:bg-white/5 transition-colors duration-200"
                          on:click={() => toggleSort("token_name")}
                        >
                          Token
                          <svelte:component
                            this={getSortIcon("token_name")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                        <th
                          class="col-price text-right py-2 text-no-wrap text-sm font-medium text-[#8890a4] text-nowrap cursor-pointer hover:bg-white/5 transition-colors duration-200"
                          on:click={() => toggleSort("price")}
                        >
                          Price
                          <svelte:component
                            this={getSortIcon("price")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                        <th
                          class="col-change text-right py-2 text-no-wrap text-sm font-medium text-[#8890a4] text-nowrap cursor-pointer hover:bg-white/5 transition-colors duration-200"
                          on:click={() => toggleSort("price_change_24h")}
                        >
                          24h
                          <svelte:component
                            this={getSortIcon("price_change_24h")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                        <th
                          class="col-volume text-right py-2 text-no-wrap text-sm font-medium text-[#8890a4] text-nowrap cursor-pointer hover:bg-white/5 transition-colors duration-200"
                          on:click={() => toggleSort("volume_24h")}
                        >
                          Vol
                          <svelte:component
                            this={getSortIcon("volume_24h")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                        <th
                          class="col-mcap text-right py-2 text-no-wrap text-sm font-medium text-[#8890a4] text-nowrap cursor-pointer hover:bg-white/5 transition-colors duration-200"
                          on:click={() => toggleSort("marketCap")}
                        >
                          MCap
                          <svelte:component
                            this={getSortIcon("marketCap")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                        <th
                          class="col-tvl text-right py-2 pr-3 text-no-wrap text-sm font-medium text-[#8890a4] text-nowrap cursor-pointer hover:bg-white/5 transition-colors duration-200"
                          on:click={() => toggleSort("tvl")}
                        >
                          TVL
                          <svelte:component
                            this={getSortIcon("tvl")}
                            class="inline w-3.5 h-3.5 ml-1"
                          />
                        </th>
                      </tr>
                    </thead>

                      <tbody class="!px-4"  bind:this={tableBody}>
                        {#each $filteredTokens as token (token.canister_id)}
                          <StatsTableRow
                            {token}
                            isConnected={$auth.isConnected}
                            isFavorite={isTokenFavorited(token.canister_id)}
                            priceClass={getPriceClass(token)}
                            trendClass={getTrendClass(token)}
                            kongCanisterId={KONG_CANISTER_ID}
                          />
                        {/each}
                      </tbody>
                    </table>
                </div>
              {:else}
                <!-- Mobile view with virtualization -->
                <div class="mobile-container">
                  {#if $isMobile}
                    <!-- Mobile sorting options -->
                    <div
                      class="flex items-center gap-2 mb-2 bg-[#1a1b23] p-4 z-10 border-b border-[#2a2d3d]"
                    >
                      <button
                        class="px-3 py-1.5 text-sm rounded {$sortColumnStore ===
                        'marketCap'
                          ? 'bg-primary-blue text-white'
                          : 'bg-[#2a2d3d] text-[#8890a4]'}"
                        on:click={() => toggleSort("marketCap")}
                      >
                        MCap
                        <svelte:component
                          this={getSortIcon("marketCap")}
                          class="inline w-3.5 h-3.5 ml-1"
                        />
                      </button>
                      <button
                        class="px-3 py-1.5 text-sm rounded {$sortColumnStore ===
                        'volume_24h'
                          ? 'bg-primary-blue text-white'
                          : 'bg-[#2a2d3d] text-[#8890a4]'}"
                        on:click={() => toggleSort("volume_24h")}
                      >
                        Vol
                        <svelte:component
                          this={getSortIcon("volume_24h")}
                          class="inline w-3.5 h-3.5 ml-1"
                        />
                      </button>
                      <button
                        class="px-3 py-1.5 text-sm rounded {$sortColumnStore ===
                        'tvl'
                          ? 'bg-primary-blue text-white'
                          : 'bg-[#2a2d3d] text-[#8890a4]'}"
                        on:click={() => toggleSort("tvl")}
                      >
                        TVL
                        <svelte:component
                          this={getSortIcon("tvl")}
                          class="inline w-3.5 h-3.5 ml-1"
                        />
                      </button>
                      <button
                        class="px-3 py-1.5 text-sm rounded {$sortColumnStore ===
                        'price_change_24h'
                          ? 'bg-primary-blue text-white'
                          : 'bg-[#2a2d3d] text-[#8890a4]'}"
                        on:click={() => toggleSort("price_change_24h")}
                      >
                        24h
                        <svelte:component
                          this={getSortIcon("price_change_24h")}
                          class="inline w-3.5 h-3.5 ml-1"
                        />
                      </button>
                    </div>
                  {/if}
                  <div class="mobile-scroll-container" on:scroll={handleScroll}>
                    <div class="relative" style="height: {$filteredTokens.length * ITEM_HEIGHT}px">
                      {#each $visibleItems as {token, y} (token.canister_id)}
                        <div
                          class="absolute w-full"
                          style="transform: translateY({y}px)"
                          on:click={() => goto(`/stats/${token.canister_id}`)}
                        >
                          <div class="mx-4">
                            <TokenCardMobile
                              {token}
                              isConnected={$auth.isConnected}
                              isFavorite={isTokenFavorited(token.canister_id)}
                              priceClass={getPriceClass(token)}
                              trendClass={getTrendClass(token)}
                            />
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </Panel>
    {/if}
  </div>
</section>

<style scoped lang="postcss">
  section {
    @apply h-[calc(100vh-6rem)];
  }

  .custom-scrollbar {
    @apply h-full overflow-auto;
  }

  .mobile-container {
    @apply flex flex-col h-full overflow-hidden;
  }

  .mobile-scroll-container {
    @apply flex-1 overflow-y-auto;
    -webkit-overflow-scrolling: touch;
  }

  thead tr {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
  }

  th {
    transition: background-color 0.2s;
  }

  th:hover {
    background: rgba(255, 255, 255, 0.05);
  }
</style>
