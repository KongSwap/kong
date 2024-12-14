<script lang="ts">
  import { writable, derived } from "svelte/store";
  import Panel from "$lib/components/common/Panel.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import { poolStore } from "$lib/services/pools";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import debounce from "lodash-es/debounce";
  import {
    Droplets,
    DollarSign,
    BarChart,
    ArrowUp,
    ArrowDown,
    Star,
    ArrowUpDown,
  } from "lucide-svelte";
  import { onMount } from "svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/services/auth";
  import {
    favoriteStore,
    currentWalletFavorites,
  } from "$lib/services/tokens/favoriteStore";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";

  let isMobile = false;
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

  // Store for toggling between all tokens and favorites only
  const showFavoritesOnly = writable(false);
  const activeStatsSection = writable<"tokens" | "marketStats">("tokens");
  const DEBOUNCE_DELAY = 300;
  const searchQuery = writable<string>("");
  const sortColumnStore = writable<string>("marketCap");
  const sortDirectionStore = writable<"asc" | "desc">("desc");
  const previousPrices = writable<{ [key: string]: number }>({});

  const KONG_CANISTER_ID = 'o7oak-iyaaa-aaaaq-aadzq-cai';

  onMount(async () => {
    await tokenStore.loadFavorites();
  });

  const tokensLoading = derived(
    [tokenStore, poolStore],
    ([$tokenStore, $poolStore]) => {
      return $poolStore.isLoading || 
             $tokenStore.isLoading || 
             !$tokenStore.tokens || 
             $tokenStore.tokens.length === 0;
    }
  );

  const tokensError = derived<[typeof tokenStore, typeof poolStore], string | null>(
    [tokenStore, poolStore],
    ([$tokenStore, $poolStore]) => {
      return $tokenStore.error || $poolStore.error || null;
    }
  );

  const debouncedSearch = debounce((value: string) => {
    searchQuery.set(value);
  }, DEBOUNCE_DELAY);

  function handleSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    debouncedSearch(target.value);
  }

  async function toggleFavorite(token: FE.Token, event: MouseEvent) {
    event.stopPropagation();
    await favoriteStore.toggleFavorite(token.canister_id);
  }

  const filteredTokens = derived(
    [
      tokenStore,
      searchQuery,
      sortColumnStore,
      sortDirectionStore,
      showFavoritesOnly,
      currentWalletFavorites,
      auth
    ],
    ([
      $tokenStore,
      $searchQuery,
      $sortColumn,
      $sortDirection,
      $showFavoritesOnly,
      $currentWalletFavorites,
      $auth
    ]) => {
      let tokens = [...$tokenStore.tokens];

      // If showing favorites only:
      if ($showFavoritesOnly) {
        if (!$auth.isConnected) {
          return { tokens: [], showFavoritesPrompt: true };
        }

        tokens = tokens.filter((token) =>
          $currentWalletFavorites.includes(token.canister_id)
        );

        if (tokens.length === 0) {
          return { tokens: [], noFavorites: true };
        }
      } else {
        if ($searchQuery) {
          const query = $searchQuery.toLowerCase();
          tokens = tokens.filter(
            (token) =>
              token.name.toLowerCase().includes(query) ||
              token.symbol.toLowerCase().includes(query)
          );
        }
      }

      // Apply sorting
      tokens = tokens.sort((a, b) => {
        // Always put Kong token first
        if (a.canister_id === KONG_CANISTER_ID) return -1;
        if (b.canister_id === KONG_CANISTER_ID) return 1;

        let aValue, bValue;

        switch ($sortColumn) {
          case "price":
            aValue = Number(a?.metrics?.price) || 0;
            bValue = Number(b?.metrics?.price) || 0;
            break;
          case "price_change_24h":
            aValue = Number(a?.metrics?.price_change_24h) || 0;
            bValue = Number(b?.metrics?.price_change_24h) || 0;
            break;
          case "volume_24h":
            aValue = Number(a?.metrics?.volume_24h?.replace(/[^0-9.-]+/g, "")) || 0;
            bValue = Number(b?.metrics?.volume_24h?.replace(/[^0-9.-]+/g, "")) || 0;
            break;
          case "marketCap":
            aValue = Number(a?.metrics?.market_cap) || 0;
            bValue = Number(b?.metrics?.market_cap) || 0;
            break;
          case "name":
            return $sortDirection === "asc"
              ? a.name.localeCompare(b.name)
              : b.name.localeCompare(a.name);
          default:
            aValue = a[$sortColumn] || 0;
            bValue = b[$sortColumn] || 0;
        }

        return $sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      });

      // Sort by market cap for ranking
      const tokensByMarketCap = [...tokens].sort((a, b) => {
        const aVal = Number(a?.metrics?.market_cap) || 0;
        const bVal = Number(b?.metrics?.market_cap) || 0;
        return bVal - aVal;
      });

      const marketCapRankings = new Map(
        tokensByMarketCap.map((token, index) => [token.canister_id, index + 1])
      );

      tokens = tokens.map(token => ({
        ...token,
        marketCapRank: marketCapRankings.get(token.canister_id)
      }));

      return { tokens };
    }
  );

  function toggleSort(column: string) {
    if ($sortColumnStore === column) {
      sortDirectionStore.update(d => d === "asc" ? "desc" : "asc");
    } else {
      sortColumnStore.set(column);
      sortDirectionStore.set("desc");
    }
  }

  function getSortIcon(column: string) {
    if ($sortColumnStore !== column) return ArrowUpDown;
    return $sortDirectionStore === "asc" ? ArrowUp : ArrowDown;
  }

  function getPriceChangeClass(
    token: any,
    $previousPrices: { [key: string]: number },
  ): string {
    const prevPrice = $previousPrices[token.canister_id];
    const currentPrice = token.metrics.price;

    if (prevPrice === undefined || currentPrice === prevPrice) {
      return "";
    }
    return currentPrice > prevPrice ? "price-up" : "price-down";
  }

  function toggleShowFavorites() {
    showFavoritesOnly.update(v => !v);
  }

  $: {
    if($auth.isConnected) {
      poolStore.loadUserPoolBalances();
    }
  }
</script>

<section class="flex flex-col w-full h-full px-4">
  <div class="z-10 flex flex-col w-full h-full mx-auto gap-4 max-w-[1300px]">

    {#if isMobile && $activeStatsSection === 'marketStats'}
      <h2 class="text-xl font-semibold text-white mt-4 mb-2">Market Overview</h2>
    {/if}

    {#if (!isMobile) || (isMobile && $activeStatsSection === 'marketStats')}
      <div class="earn-cards">
        <div class="earn-card">
          <div class="card-content">
            <h3>Total Volume (24h)</h3>
            <div class="apy">
              ${formatToNonZeroDecimal($poolStore.totals.rolling_24h_volume)}
            </div>
          </div>
          <div class="stat-icon-wrapper">
            <BarChart class="stat-icon" />
          </div>
        </div>

        <div class="earn-card">
          <div class="card-content">
            <h3>Total Liquidity</h3>
            <div class="apy">
              ${formatToNonZeroDecimal($poolStore.totals.tvl)}
            </div>
          </div>
          <div class="stat-icon-wrapper">
            <Droplets class="stat-icon" />
          </div>
        </div>

        <div class="earn-card">
          <div class="card-content">
            <h3>Total Fees (24h)</h3>
            <div class="apy">
              ${formatToNonZeroDecimal($poolStore.totals.fees_24h)}
            </div>
          </div>
          <div class="stat-icon-wrapper">
            <DollarSign class="stat-icon" />
          </div>
        </div>
      </div>
    {/if}

    {#if (!isMobile) || (isMobile && $activeStatsSection === 'tokens')}
      <Panel variant="green" type="main" className="content-panel flex-1">
        <div class="h-full overflow-hidden flex flex-col">
          <div class="flex items-center justify-between mb-4">
            <input
              type="text"
              placeholder="Search tokens..."
              class="flex-1 bg-transparent border-b border-[#2a2d3d] text-white placeholder-gray-400 focus:outline-none focus:ring-0 py-2 mr-4 min-w-0"
              on:input={handleSearch}
              disabled={$showFavoritesOnly} 
            />
            <button
              class="px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0
                     {$showFavoritesOnly
                       ? 'bg-[#60A5FA] text-white'
                       : 'bg-[#2a2d3d] text-[#8890a4] hover:bg-[#2a2d3d]/80'}"
              on:click={toggleShowFavorites}
            >
              <span class="hidden sm:inline">My Favorites</span>
              <span class="sm:hidden">Favorites</span>
              {#if $auth.isConnected && $currentWalletFavorites.length > 0}
                <span class="ml-1 sm:ml-2 px-2 py-0.5 bg-[#2a2d3d] rounded-full text-xs">
                  {$currentWalletFavorites.length}
                </span>
              {/if}
            </button>
          </div>

          {#if $tokensLoading}
            <LoadingIndicator />
          {:else if $tokensError}
            <div class="error-message">
              <p>Error loading tokens: {$tokensError}</p>
              <button
                class="retry-button"
                on:click={() => {
                  tokenStore.loadTokens();
                  poolStore.loadPools();
                }}
              >
                Retry
              </button>
            </div>
          {:else}
            {#if $filteredTokens.showFavoritesPrompt}
              <div class="flex flex-col items-center justify-center h-64 text-center">
                <p class="text-gray-400 mb-4">Connect your wallet to view your favorite tokens</p>
                <button
                  class="px-6 py-2 bg-[#60A5FA] text-white rounded-lg hover:bg-[#60A5FA]/90 transition-colors duration-200"
                  on:click={() => {
                    toastStore.info('Connect your wallet to view your favorite tokens', undefined, 'Connect Wallet');
                  }}
                >
                  Connect Wallet
                </button>
              </div>
            {:else if $filteredTokens.noFavorites}
              <div class="flex flex-col items-center justify-center h-64 text-center">
                <p class="text-gray-400 mb-4">You have no favorite tokens yet. Mark some tokens as favorites to view them here.</p>
              </div>
            {:else}
              <div class="overflow-auto flex-1 custom-scrollbar">
                <div class="overflow-auto flex-1 {isMobile ? 'max-h-[calc(100vh-15.9rem)]' : 'max-h-[calc(100vh-20.9rem)]'} custom-scrollbar">
                  {#if !isMobile}
                    <!-- Desktop table view -->
                    <table class="data-table">
                      <thead class="sticky top-0 bg-[#1a1b23] z-10">
                        <tr class="h-10 border-b border-[#2a2d3d]">
                          <th class="text-center px-4 py-2 text-sm font-medium text-[#8890a4] w-12">Rank</th>
                          <th class="text-left px-4 py-2 text-sm font-medium text-[#8890a4] w-[200px]">Token</th>
                          <th class="text-right px-4 py-2 text-sm font-medium text-[#8890a4] cursor-pointer w-[120px]" on:click={() => toggleSort("price")}>
                            Price
                            <svelte:component this={getSortIcon("price")} class="inline w-3.5 h-3.5 ml-1" />
                          </th>
                          <th class="text-right px-4 py-2 text-sm font-medium text-[#8890a4] cursor-pointer w-[100px]" on:click={() => toggleSort("price_change_24h")}>
                            24h
                            <svelte:component this={getSortIcon("price_change_24h")} class="inline w-3.5 h-3.5 ml-1" />
                          </th>
                          <th class="text-right px-4 py-2 text-sm font-medium text-[#8890a4] cursor-pointer w-[120px]" on:click={() => toggleSort("volume_24h")}>
                            Vol
                            <svelte:component this={getSortIcon("volume_24h")} class="inline w-3.5 h-3.5 ml-1" />
                          </th>
                          <th class="text-right px-4 py-2 text-sm font-medium text-[#8890a4] cursor-pointer w-[120px]" on:click={() => toggleSort("marketCap")}>
                            MCap
                            <svelte:component this={getSortIcon("marketCap")} class="inline w-3.5 h-3.5 ml-1" />
                          </th>
                          <th class="text-right px-4 py-2 text-sm font-medium text-[#8890a4] w-[140px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody class="text-base">
                        {#each $filteredTokens.tokens as token, index (token.canister_id)}
                          {@const enrichedToken = {
                            ...token,
                            metrics: {
                              ...token.metrics,
                              price: token.metrics.price.toString(),
                            },
                            marketCapRank: token.marketCapRank
                          } as unknown as FE.Token}
                          {@const priceChangeClass = enrichedToken?.metrics
                            ?.price_change_24h
                            ? Number(enrichedToken.metrics.price_change_24h) > 0
                              ? "positive"
                              : "negative"
                            : ""}
                          <tr
                            class:kong-special-row={token.canister_id === KONG_CANISTER_ID}
                            class="transition-all duration-200 hover:bg-secondary/10 cursor-pointer"
                            on:click={() => goto(`/stats/${enrichedToken.canister_id}`)}
                          >
                            <td class="text-center text-[#8890a4]">#{enrichedToken.marketCapRank}</td>
                            <td class="token-cell">
                              <div class="token-info flex items-center gap-2">
                                {#if $auth.isConnected}
                                  <button
                                    class="favorite-button {$currentWalletFavorites.includes(enrichedToken.canister_id) ? 'active' : ''}"
                                    on:click={(e) => toggleFavorite(enrichedToken, e)}
                                  >
                                    {#if $currentWalletFavorites.includes(enrichedToken.canister_id)}
                                      <Star
                                        class="star-icon filled"
                                        size={16}
                                        color="yellow"
                                        fill="yellow"
                                      />
                                    {:else}
                                      <Star class="star-icon" size={16} />
                                    {/if}
                                  </button>
                                {/if}
                                <TokenImages
                                  tokens={[enrichedToken]}
                                  containerClass="token-image"
                                  size={24}
                                />
                                <span class="token-name">{enrichedToken.name}</span>
                                <span class="token-symbol">{enrichedToken.symbol}</span>
                              </div>
                            </td>
                            <td class="price-cell text-right">
                              <span
                                class={getPriceChangeClass(
                                  enrichedToken,
                                  $previousPrices,
                                )}
                              >
                                ${formatToNonZeroDecimal(
                                  enrichedToken?.price || enrichedToken?.metrics?.price,
                                )}
                                {#if getPriceChangeClass(enrichedToken, $previousPrices) === "price-up"}
                                  <div>
                                    <ArrowUp class="price-arrow up" size={14} />
                                  </div>
                                {:else if getPriceChangeClass(enrichedToken, $previousPrices) === "price-down"}
                                  <div>
                                    <ArrowDown class="price-arrow down" size={14} />
                                  </div>
                                {/if}
                              </span>
                            </td>
                            <td class="change-cell text-right {priceChangeClass}">
                              {#if enrichedToken?.metrics?.price_change_24h === null || enrichedToken?.metrics?.price_change_24h === "n/a"}
                                <span class="text-slate-400">0.00%</span>
                              {:else if Number(enrichedToken?.metrics?.price_change_24h) === 0}
                                <span class="text-slate-400">0.00%</span>
                              {:else}
                                <span>
                                  {Number(enrichedToken?.metrics?.price_change_24h) > 0 ? '+' : ''}{formatToNonZeroDecimal(enrichedToken?.metrics?.price_change_24h)}%
                                </span>
                              {/if}
                            </td>
                            <td class="text-right">
                              <span>{formatUsdValue(enrichedToken?.metrics?.volume_24h)}</span>
                            </td>
                            <td class="text-right">
                              <span>{formatUsdValue(enrichedToken?.metrics?.market_cap)}</span>
                            </td>
                            <td class="actions-cell text-right">
                              <button
                                class="action-button ml-auto"
                                on:click|stopPropagation={() => goto(`/stats/${enrichedToken.canister_id}`)}
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  {:else}
                    <!-- Mobile sorting options - Fixed at top -->
                    <div class="flex items-center gap-2 mb-2 sticky top-0 bg-[#1a1b23] p-2 z-10 border-b border-[#2a2d3d]">
                      <button 
                        class="px-3 py-1.5 text-sm rounded {$sortColumnStore === 'marketCap' ? 'bg-[#60A5FA] text-white' : 'bg-[#2a2d3d] text-[#8890a4]'}"
                        on:click={() => toggleSort("marketCap")}
                      >
                        MCap
                        <svelte:component this={getSortIcon("marketCap")} class="inline w-3.5 h-3.5 ml-1" />
                      </button>
                      <button 
                        class="px-3 py-1.5 text-sm rounded {$sortColumnStore === 'volume_24h' ? 'bg-[#60A5FA] text-white' : 'bg-[#2a2d3d] text-[#8890a4]'}"
                        on:click={() => toggleSort("volume_24h")}
                      >
                        Vol
                        <svelte:component this={getSortIcon("volume_24h")} class="inline w-3.5 h-3.5 ml-1" />
                      </button>
                      <button 
                        class="px-3 py-1.5 text-sm rounded {$sortColumnStore === 'price_change_24h' ? 'bg-[#60A5FA] text-white' : 'bg-[#2a2d3d] text-[#8890a4]'}"
                        on:click={() => toggleSort("price_change_24h")}
                      >
                        24h
                        <svelte:component this={getSortIcon("price_change_24h")} class="inline w-3.5 h-3.5 ml-1" />
                      </button>
                    </div>

                    <!-- Mobile token cards -->
                    <div class="space-y-2">
                      {#each $filteredTokens.tokens as token}
                        {@const enrichedToken = {
                          ...token,
                          metrics: {
                            ...token.metrics,
                            price: token.metrics.price.toString(),
                          },
                          marketCapRank: token.marketCapRank
                        } as unknown as FE.Token}
                        <div 
                          class="token-card {token.canister_id === KONG_CANISTER_ID ? 'kong-special-card' : ''}"
                          on:click={() => goto(`/stats/${token.canister_id}`)}
                        >
                          <span class="token-rank">#{token.marketCapRank}</span>
                          <div class="token-card-main">
                            <!-- Left section: Favorite, Token Icon, Symbol -->
                            <div class="token-card-left">
                              {#if $auth.isConnected}
                                <button
                                  class="favorite-button-mobile"
                                  on:click={(e) => toggleFavorite(token, e)}
                                >
                                  {#if $currentWalletFavorites.includes(token.canister_id)}
                                    <Star class="star-icon filled" size={14} color="yellow" fill="yellow" />
                                  {:else}
                                    <Star class="star-icon" size={14} />
                                  {/if}
                                </button>
                              {/if}
                              <TokenImages tokens={[token]} size={24} />
                              <div class="token-info-mobile">
                                <span class="token-symbol-mobile">{token.symbol}</span>
                                <div class="token-metrics-row">
                                  <span>MCap: {formatUsdValue(token?.metrics?.market_cap)}</span>
                                  <span class="separator">|</span>
                                  <span>Vol: {formatUsdValue(token?.metrics?.volume_24h)}</span>
                                </div>
                              </div>
                            </div>

                            <div class="token-card-right">
                              <span class="token-price">${formatToNonZeroDecimal(enrichedToken?.price || enrichedToken?.metrics?.price)}</span>
                              {#if token?.metrics?.price_change_24h === null || token?.metrics?.price_change_24h === "NEW"}
                                <span class="token-change new">NEW</span>
                              {:else if token?.metrics?.price_change_24h === 0 || !token?.metrics?.price_change_24h}
                                <span class="token-change neutral">0.00%</span>
                              {:else}
                                {@const priceChange = Number(token?.metrics?.price_change_24h)}
                                {#if isNaN(priceChange)}
                                  <span class="token-change neutral">0.00%</span>
                                {:else}
                                  <span class="token-change {priceChange > 0 ? 'positive' : 'negative'}">
                                    {priceChange > 0 ? '+' : ''}{formatToNonZeroDecimal(priceChange)}%
                                  </span>
                                {/if}
                              {/if}
                            </div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          {/if}
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
        class:active={$activeStatsSection === 'tokens'}
        on:click={() => activeStatsSection.set('tokens')}
      >
        <span class="nav-icon">🪙</span>
        <span class="nav-label">Tokens</span>
      </button>

      <button 
        class="mobile-nav-item"
        class:active={$activeStatsSection === 'marketStats'}
        on:click={() => activeStatsSection.set('marketStats')}
      >
        <span class="nav-icon">📊</span>
        <span class="nav-label">Market Stats</span>
      </button>
    </div>
  </nav>
{/if}

<style scoped lang="postcss">
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

  .card-content h3 {
    @apply text-[#8890a4] text-sm font-medium;
  }

  .apy {
    @apply text-[#60A5FA] font-medium text-2xl mt-2;
  }

  .stat-icon-wrapper {
    @apply p-4 rounded-lg bg-[#2a2d3d] text-[#60A5FA];
  }

  .stat-icon {
    @apply w-5 h-5;
  }

  .data-table {
    @apply w-full border-collapse min-w-[800px] md:min-w-0;
  }

  .data-table tbody tr {
    @apply border-b border-white/5 hover:bg-white/5
           transition-colors duration-200 cursor-pointer;
  }

  .data-table td {
    @apply px-3 md:px-4 py-3 text-sm text-white/80;
  }

  .token-cell {
    @apply flex items-center gap-2 md:gap-3 relative min-w-[180px];
  }

  .token-info {
    @apply flex-grow truncate;
  }

  .token-name {
    @apply text-white font-medium truncate max-w-[120px] md:max-w-none;
  }

  .token-symbol {
    @apply text-xs md:text-sm text-white/60 hidden sm:inline;
  }

  .price-arrow.up {
    @apply text-green-400;
  }

  .price-arrow.down {
    @apply text-red-400;
  }

  .favorite-button {
    @apply flex items-center justify-center w-6 h-6 rounded-lg hover:bg-white/10 transition-none;
  }

  .favorite-button-mobile {
    @apply flex items-center justify-center w-6 h-6 rounded-lg 
           hover:bg-white/5 active:bg-white/10 transition-colors duration-150;
  }

  .change-cell.positive {
    @apply text-green-400;
  }

  .change-cell.negative {
    @apply text-red-400;
  }

  .retry-button {
    @apply px-4 py-2 bg-[#2a2d3d] text-white rounded-lg hover:bg-[#2a2d3d]/90 transition-colors duration-200;
  }

  .action-button {
    @apply px-4 py-1.5 text-sm rounded
           bg-white/5 text-white/60 hover:bg-white/10 hover:text-white
           focus:outline-none focus:ring-2 focus:ring-white/20
           min-w-[80px];
  }

  .mobile-nav {
    @apply fixed bottom-0 left-0 right-0 bg-[#1a1b23]/90 border-t border-[#2a2d3d] z-50 backdrop-blur-md;
  }

  .mobile-nav-container {
    @apply grid grid-cols-2 h-16;
  }

  .mobile-nav-item {
    @apply flex flex-col items-center justify-center gap-0.5 text-[#8890a4] transition-colors duration-200;
  }

  .mobile-nav-item.active {
    @apply text-[#60A5FA];
  }

  .nav-icon {
    @apply text-xl;
  }

  .nav-label {
    @apply text-xs font-medium;
  }

  table th {
    @apply font-medium;
  }

  .actions-cell {
    @apply flex justify-end px-4;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: #1a1b23;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #60A5FA;
    border-radius: 4px;
    border: 2px solid #1a1b23;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #3b82f6;
  }

  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #60A5FA #1a1b23;
  }

  .token-card {
    @apply flex items-center justify-between p-3 rounded-lg relative;
    background: #1a1b23;
    border: 1px solid #2a2d3d;

    &.kong-special-card {
      background: rgba(0, 255, 128, 0.02);
      border-left: 2px solid #00ff8033;
      
      .token-symbol-mobile {
        font-weight: 500;
      }
    }
  }

  .token-rank {
    @apply absolute top-1 left-2 text-xs text-[#8890a4]/70;
  }

  .token-card-main {
    @apply flex items-center justify-between w-full mt-2;
  }

  .token-card-left {
    @apply flex items-center gap-2 flex-1 min-w-0;
  }

  .token-info-mobile {
    @apply flex flex-col justify-center min-w-0;
  }

  .token-symbol-mobile {
    @apply text-sm text-white font-medium;
  }

  .token-metrics-row {
    @apply flex items-center gap-2 text-[10px] text-[#8890a4] mt-0.5;
  }

  .separator {
    @apply text-[#8890a4]/50 mx-0.5;
  }

  .token-card-right {
    @apply flex flex-col items-end justify-center ml-2;
  }

  .token-price {
    @apply font-medium text-white text-sm;
  }

  .token-change {
    @apply text-xs font-medium mt-0.5;
  }

  .token-change.positive {
    @apply text-green-400;
  }

  .token-change.negative {
    @apply text-red-400;
  }

  .token-change.new {
    @apply text-purple-400;
  }

  .token-change.neutral {
    @apply text-[#8890a4];
  }

  .kong-special-row {
    background: rgba(0, 255, 128, 0.02);
    border-left: 2px solid #00ff8033;
    
    &:hover {
      background: rgba(0, 255, 128, 0.04);
    }

    td {
      font-weight: 500;
    }
  }
</style>
