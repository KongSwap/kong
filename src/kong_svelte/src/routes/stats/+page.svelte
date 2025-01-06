<script lang="ts">
  import { tooltip } from "$lib/actions/tooltip";
  import { writable, derived } from "svelte/store";
  import {
    CKUSDT_CANISTER_ID,
    ICP_CANISTER_ID,
    KONG_CANISTER_ID,
  } from "$lib/constants/canisterConstants";
  import Panel from "$lib/components/common/Panel.svelte";
  import { liveTokens } from "$lib/services/tokens/tokenStore";
  import { livePoolTotals } from "$lib/services/pools/poolStore";
  import {
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    TrendingUp,
    Flame,
    ChevronDown,
  } from "lucide-svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/services/auth";
  import { browser } from "$app/environment";
  import TokenCardMobile from "$lib/components/stats/TokenCardMobile.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { FavoriteService } from "$lib/services/tokens/favoriteService";
  import { sidebarStore } from "$lib/stores/sidebarStore";
  import PageHeader from "$lib/components/common/PageHeader.svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import DataTable from "$lib/components/common/DataTable.svelte";
  import TokenCell from "$lib/components/stats/TokenCell.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

  const ITEMS_PER_PAGE = 100;
  const currentPage = writable(1);

  // Local state
  let isMobile = false;
  let searchTerm = "";
  let showFavoritesOnly = false;
  let sortBy = "market_cap";
  let sortDirection: "asc" | "desc" = "desc";

  // Favorites state - needs to be a store since it's shared with other components
  const favoriteTokenIds = writable<string[]>([]);
  const favoriteCount = writable(0);

  // Update favorite tokens when auth changes
  $: if ($auth.isConnected) {
    FavoriteService.getFavoriteCount().then((count) => {
      favoriteCount.set(count);
    });
    FavoriteService.loadFavorites().then((favorites) => {
      favoriteTokenIds.set(favorites);
    });
  } else {
    favoriteTokenIds.set([]);
    favoriteCount.set(0);
  }

  // Filter tokens
  $: filteredTokens = derived(
    [liveTokens, favoriteTokenIds],
    ([$liveTokens, $favoriteTokenIds]) => {
      const s = searchTerm.trim().toLowerCase();
      let filtered = [...$liveTokens];

      // Add volume ranks
      filtered = filtered
        .sort((a, b) => {
          const aVolume = Number(a.metrics?.volume_24h || 0);
          const bVolume = Number(b.metrics?.volume_24h || 0);
          return bVolume - aVolume;
        })
        .map((token, index) => ({
          ...token,
          volumeRank: index + 1,
        }));

      // Add TVL ranks
      filtered = filtered
        .sort((a, b) => {
          const aTvl = Number(a.metrics?.tvl || 0);
          const bTvl = Number(b.metrics?.tvl || 0);
          return bTvl - aTvl;
        })
        .map((token, index) => ({
          ...token,
          tvlRank: index + 1,
        }));

      // Add price change ranks (for gainers and losers)
      const gainers = filtered
        .filter(token => Number(token.metrics?.price_change_24h || 0) > 0)
        .sort((a, b) => Number(b.metrics?.price_change_24h || 0) - Number(a.metrics?.price_change_24h || 0))
        .map((token, index) => ({
          ...token,
          priceChangeRank: index + 1,
        }));

      const losers = filtered
        .filter(token => Number(token.metrics?.price_change_24h || 0) < 0)
        .sort((a, b) => Number(a.metrics?.price_change_24h || 0) - Number(b.metrics?.price_change_24h || 0))
        .map((token, index) => ({
          ...token,
          priceChangeRank: index + 1,
        }));

      const unchanged = filtered
        .filter(token => Number(token.metrics?.price_change_24h || 0) === 0)
        .map(token => ({
          ...token,
          priceChangeRank: null,
        }));

      filtered = [...gainers, ...unchanged, ...losers].map(token => ({
        ...token,
        totalTokens: gainers.length + losers.length + unchanged.length
      }));

      // Filter by favorites if enabled
      if (showFavoritesOnly) {
        filtered = filtered.filter((token) =>
          $favoriteTokenIds.includes(token.canister_id),
        );
      }

      // Filter by search term
      if (s) {
        filtered = filtered.filter((token) => {
          const symbol = token.symbol?.toLowerCase() || "";
          const name = token.name?.toLowerCase() || "";
          const canisterID = token.canister_id.toLowerCase();
          return (
            symbol.includes(s) || name.includes(s) || canisterID.includes(s)
          );
        });
      }

      // Add market cap ranks
      filtered = filtered
        .sort((a, b) => {
          const aMarketCap = Number(a.metrics?.market_cap || 0);
          const bMarketCap = Number(b.metrics?.market_cap || 0);
          return bMarketCap - aMarketCap;
        })
        .map((token, index) => ({
          ...token,
          marketCapRank: index + 1,
        }));

      return filtered;
    }
  );

  $: sortedTokens = derived(
    [filteredTokens],
    ([$filteredTokens]) => {
      let sorted = [...$filteredTokens];
      
      // First separate KONG from other tokens
      const kongToken = sorted.find(t => t.canister_id === KONG_CANISTER_ID);
      const otherTokens = sorted.filter(t => t.canister_id !== KONG_CANISTER_ID);
      
      // Sort the other tokens
      switch (sortBy) {
        case "market_cap":
          otherTokens.sort((a, b) => {
            const aValue = Number(a.metrics?.market_cap || 0);
            const bValue = Number(b.metrics?.market_cap || 0);
            return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
          });
          break;
        case "volume":
          otherTokens.sort((a, b) => {
            const aValue = Number(a.metrics?.volume_24h || 0);
            const bValue = Number(b.metrics?.volume_24h || 0);
            return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
          });
          break;
        case "price_change":
          otherTokens.sort((a, b) => {
            const aValue = Number(a.metrics?.price_change_24h || 0);
            const bValue = Number(b.metrics?.price_change_24h || 0);
            return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
          });
          break;
      }

      // Return KONG at the top followed by sorted tokens
      return kongToken ? [kongToken, ...otherTokens] : otherTokens;
    }
  );

  $: paginatedTokens = derived(
    [sortedTokens, currentPage],
    ([$sortedTokens, $currentPage]) => {
      const start = ($currentPage - 1) * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      return $sortedTokens.slice(start, end);
    }
  );

  $: totalPages = derived(filteredTokens, ($filteredTokens) => 
    Math.ceil($filteredTokens.length / ITEMS_PER_PAGE)
  );

  function getTrendClass(token: FE.Token): string {
    return token?.metrics?.price_change_24h
      ? Number(token.metrics.price_change_24h) > 0
        ? "text-kong-accent-green"
        : Number(token.metrics.price_change_24h) < 0
          ? "text-kong-accent-red"
          : ""
      : "";
  }

  function isTopVolume(token: FE.Token): boolean {
    if (
      token.canister_id === CKUSDT_CANISTER_ID ||
      token.canister_id === ICP_CANISTER_ID
    )
      return false;
    return (
      token.volumeRank &&
      token.volumeRank <= 7 &&
      Number(token.metrics?.volume_24h || 0) > 0
    );
  }

  function nextPage() {
    if ($currentPage < $totalPages) {
      currentPage.update(n => n + 1);
    }
  }

  function previousPage() {
    if ($currentPage > 1) {
      currentPage.update(n => n - 1);
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= $totalPages) {
      currentPage.set(page);
    }
  }

  function toggleSort(newSortBy: string) {
    if (sortBy === newSortBy) {
      sortDirection = sortDirection === "desc" ? "asc" : "desc";
    } else {
      sortBy = newSortBy;
      sortDirection = "desc";
    }
  }

  onMount(() => {
    if (browser) {
      isMobile = window.innerWidth < 768;
      const handleResize = () => (isMobile = window.innerWidth < 768);
      window.addEventListener("resize", handleResize);
    }

    return () => {
      if (browser) {
        const handleResize = () => (isMobile = window.innerWidth < 768);
        window.removeEventListener("resize", handleResize);
      }
    };
  });
</script>

<PageHeader
  title="Market Stats"
  description="Track token performance and market activity"
  icon={TrendingUp}
  stats={[
    {
      label: "Volume 24H",
      value: `${formatUsdValue(Number($livePoolTotals[0]?.total_24h_volume ?? 0) / 1e6)}`,
      icon: TrendingUp,
    },
    {
      label: "TVL",
      value: `${formatUsdValue(Number($livePoolTotals[0]?.total_tvl ?? 0) / 1e6)}`,
      icon: TrendingUp,
    },
    {
      label: "Fees 24H",
      value: `${formatUsdValue(Number($livePoolTotals[0]?.total_24h_lp_fee ?? 0) / 1e6)}`,
      icon: TrendingUp,
      hideOnMobile: true,
    },
  ]}
/>

<section class="flex flex-col w-full px-2 max-h-[calc(100vh-15rem)] mt-4">
  <div
    class="z-10 flex flex-col lg:flex-row w-full mx-auto gap-4 max-w-[1300px] h-[calc(100vh-15rem)]"
  >
    <Panel
      variant="transparent"
      type="main"
      className="content-panel flex-1 !p-0"
      height="100%"
    >
      <div class="flex flex-col h-full">
        <!-- Header -->
        <div class="flex flex-col gap-3 sm:gap-0 sticky top-0 z-10">
          <div
            class="hidden sm:flex items-center gap-3 py-1 border-b border-kong-border"
          >
            <div class="flex bg-transparent">
              <button
                class="px-4 py-1 transition-colors duration-200 {!showFavoritesOnly
                  ? 'text-kong-text-primary'
                  : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                on:click={() => (showFavoritesOnly = false)}
              >
                All Tokens
              </button>
              <button
                class="px-4 py-2 transition-colors duration-200 {showFavoritesOnly
                  ? 'text-kong-text-primary'
                  : 'text-kong-text-secondary hover:text-kong-text-primary'}"
                on:click={() => (showFavoritesOnly = true)}
              >
                My Favorites
                {#if $auth.isConnected}
                  <span
                    class="ml-1 px-2 py-0.5 text-kong-text-primary/80 bg-kong-primary/60 rounded text-xs"
                  >
                    {$favoriteCount}
                  </span>
                {/if}
              </button>
            </div>

            <div class="flex-1 px-4 py-2">
              <input
                type="text"
                placeholder={isMobile
                  ? "Search tokens..."
                  : "Search tokens by name, symbol, or canister ID"}
                class="w-full bg-transparent text-kong-text-primary placeholder-[#8890a4] focus:outline-none"
                on:input={(e) => (searchTerm = e.currentTarget.value)}
                disabled={showFavoritesOnly}
              />
            </div>
          </div>
        </div>

        <!-- Content -->
        {#if $filteredTokens.length === 0}
          <div
            class="flex flex-col items-center justify-center h-64 text-center"
          >
            {#if showFavoritesOnly && !$auth.isConnected}
              <p class="text-gray-400 mb-4">
                Connect your wallet to view and manage your favorite tokens
              </p>
              <ButtonV2
                variant="solid"
                theme="primary"
                on:click={() => sidebarStore.open()}
              >
                Connect Wallet
              </ButtonV2>
            {:else}
              <p class="text-gray-400">
                No tokens found matching your search criteria
              </p>
            {/if}
          </div>
        {:else}
          <div
            class="flex-1 custom-scrollbar {isMobile
              ? 'h-[calc(100vh-8rem)]'
              : 'h-[calc(100vh-1rem)]'}"
          >
            {#if !isMobile}
              <DataTable
                data={$filteredTokens}
                rowKey="canister_id"
                columns={[
                  {
                    key: 'marketCapRank',
                    title: '#',
                    align: 'center',
                    sortable: true,
                    width: '60px',
                    formatter: (row) => {
                      const rank = row.marketCapRank || '-';
                      return rank === '-' ? rank : `#${rank}`;
                    }
                  },
                  {
                    key: 'token',
                    title: 'Token',
                    align: 'left',
                    component: TokenCell,
                    sortable: true
                  },
                  {
                    key: 'price',
                    title: 'Price',
                    align: 'right',
                    sortable: true,
                    formatter: (row) => "$" + formatToNonZeroDecimal(row.metrics?.price || 0)
                  },
                  {
                    key: 'price_change_24h',
                    title: '24h',
                    align: 'right',
                    sortable: true,
                    formatter: (row) => {
                      const value = row.metrics?.price_change_24h || 0;
                      return `${value > 0 ? '+' : ''}${formatToNonZeroDecimal(value)}%`;
                    }
                  },
                  {
                    key: 'volume_24h',
                    title: 'Vol',
                    align: 'right',
                    sortable: true,
                    formatter: (row) => formatUsdValue(row.metrics?.volume_24h || 0)
                  },
                  {
                    key: 'market_cap',
                    title: 'MCap',
                    align: 'right',
                    sortable: true,
                    formatter: (row) => formatUsdValue(row.metrics?.market_cap || 0)
                  },
                  {
                    key: 'tvl',
                    title: 'TVL',
                    align: 'right',
                    sortable: true,
                    formatter: (row) => formatUsdValue(row.metrics?.tvl || 0)
                  }
                ]}
                itemsPerPage={100}
                defaultSort={{ column: 'market_cap', direction: 'desc' }}
                onRowClick={(row) => goto(`/stats/${row.canister_id}`)}
                isKongRow={(row) => row.canister_id === KONG_CANISTER_ID}
              />
            {:else}
              <div class="flex flex-col h-full overflow-hidden">
                <!-- Mobile filters -->
                <div class="sticky top-0 z-30 bg-kong-bg-dark border-b border-kong-border">
                  <div class="flex gap-2 px-3 py-2 justify-between">
                    <button
                      class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm {sortBy === 'market_cap' ? 'bg-kong-primary text-white' : 'bg-kong-background-secondary'}"
                      on:click={() => toggleSort("market_cap")}
                    >
                      MCap
                      <ChevronDown
                        size={16}
                        class="transition-transform {sortDirection === 'asc' && sortBy === 'market_cap' ? 'rotate-180' : ''}"
                      />
                    </button>
                    <button
                      class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm {sortBy === 'volume' ? 'bg-kong-primary text-white' : 'bg-kong-background-secondary'}"
                      on:click={() => toggleSort("volume")}
                    >
                      Volume
                      <ChevronDown
                        size={16}
                        class="transition-transform {sortDirection === 'asc' && sortBy === 'volume' ? 'rotate-180' : ''}"
                      />
                    </button>
                    <button
                      class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm {sortBy === 'price_change' ? 'bg-kong-primary text-white' : 'bg-kong-background-secondary'}"
                      on:click={() => toggleSort("price_change")}
                    >
                      24h %
                      <ChevronDown
                        size={16}
                        class="transition-transform {sortDirection === 'asc' && sortBy === 'price_change' ? 'rotate-180' : ''}"
                      />
                    </button>
                  </div>
                </div>

                <!-- Scrollable content -->
                <div class="flex-1 overflow-auto">
                  <div class="space-y-2.5 px-2 py-2">
                    {#each $paginatedTokens as token, index (token.canister_id)}
                      <button
                        class="w-full"
                        on:click={() => goto(`/stats/${token.canister_id}`)}
                      >
                        <TokenCardMobile
                          {token}
                          isConnected={$auth.isConnected}
                          isFavorite={$favoriteTokenIds.includes(token.canister_id)}
                          trendClass={getTrendClass(token)}
                          showHotIcon={isTopVolume(token)}
                          priceClass={getTrendClass(token)}
                        />
                      </button>
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </Panel>
  </div>
</section>

<style scoped lang="postcss">
  section {
    @apply h-[calc(100vh-6rem)];
  }

  .custom-scrollbar {
    @apply h-full overflow-auto;
  }

  th {
    transition: background-color 0.2s;
  }

  th:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  button:disabled {
    @apply opacity-50 cursor-not-allowed;
  }
</style>
