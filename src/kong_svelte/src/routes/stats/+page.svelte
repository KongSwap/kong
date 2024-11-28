<script lang="ts">
  import { writable, derived } from "svelte/store";
  import Panel from "$lib/components/common/Panel.svelte";
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
  import { poolStore, poolsList } from "$lib/services/pools/poolStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import debounce from "lodash-es/debounce";
  import {
    Droplets,
    DollarSign,
    LineChart,
    BarChart,
    ArrowUp,
    ArrowDown,
    Star,
  } from "lucide-svelte";
  import { onMount } from "svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import { goto } from "$app/navigation";
  import { fade } from "svelte/transition";
  import { auth } from "$lib/services/auth";
  import {
    favoriteStore,
    currentWalletFavorites,
  } from "$lib/services/tokens/favoriteStore";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";

  // Constants
  const DEBOUNCE_DELAY = 300;
  const COPY_TIMEOUT = 1000;
  const ANIMATION_DURATION = 300;
  const CHART_DAYS = 7;
  const CHART_POINTS = 5;

  // Store initialization with TypeScript types
  interface CopyStates {
    [key: string]: string;
  }

  interface MarketStats {
    totalVolume: string;
    totalLiquidity: string;
    totalFees: string;
  }

  // Base stores
  const searchQuery = writable<string>("");
  const sortColumnStore = writable<string>("volume24h");
  const sortDirectionStore = writable<"asc" | "desc">("desc");
  const copyStates = writable<CopyStates>({});
  const previousPrices = writable<{ [key: string]: number }>({});

  // Function to handle sorting
  function handleSort({
    column,
    direction,
  }: {
    column: string;
    direction: "asc" | "desc";
  }) {
    sortColumnStore.set(column);
    sortDirectionStore.set(direction);
  }

  // Enhanced loading state with type safety
  const tokensLoading = derived(
    [tokenStore, poolStore, formattedTokens],
    ([$tokenStore, $poolStore, $formattedTokens]): boolean =>
      $tokenStore.isLoading ||
      $poolStore.isLoading ||
      !$formattedTokens?.length,
  );

  // Improved error handling with null checks
  const tokensError = derived(
    [tokenStore, poolStore],
    ([$tokenStore, $poolStore]): string | null =>
      $tokenStore.error || $poolStore.error || null,
  );

  // Enhanced market stats calculation
  const marketStats = derived<
    [typeof tokenStore, typeof poolStore],
    MarketStats
  >([tokenStore, poolStore], ([$tokenStore, $poolStore]) => {
    const calculateVolume = (pools: any[]): string => {
      const total = pools.reduce((acc, pool) => {
        const volume = Number(pool?.rolling_24h_volume || 0n) / 1e6;
        return acc + volume;
      }, 0);
      return total.toString();
    };

    const calculateLiquidity = (pools: any[]): string => {
      const total = pools.reduce((acc, pool) => {
        const tvl = Number(pool.tvl);
        return acc + tvl;
      }, 0);
      return total.toString();
    };

    const calculateFees = (pools: any[]): string => {
      const total = pools.reduce((acc, pool) => {
        const fees = Number(pool.rolling_24h_lp_fee || 0n) / 1e6;
        return acc + fees;
      }, 0);
      return total.toString();
    };

    return {
      totalVolume: calculateVolume($poolStore.pools),
      totalLiquidity: calculateLiquidity($poolStore.pools),
      totalFees: calculateFees($poolStore.pools),
    };
  });

  // Enhanced token stats with better type safety
  const tokenStats = derived(tokenStore, ($tokenStore) => {
    const calculateActiveTokens = (tokens: any[], balances: any): number => {
      return (
        tokens?.filter(
          (token) =>
            balances[token.canister_id]?.in_tokens > 0n ||
            token.total_24h_volume > 0n,
        ).length || 0
      );
    };

    const calculateMarketCap = (tokens: any[], prices: any): number => {
      return (
        tokens?.reduce((acc, token) => {
          const price = prices[token.canister_id] || 0;
          const supply =
            Number(token.total_supply || 0) / Math.pow(10, token.decimals || 8);
          return acc + price * supply;
        }, 0) || 0
      );
    };

    return {
      totalTokens: $tokenStore.tokens?.length || 0,
      activeTokens: calculateActiveTokens(
        $tokenStore.tokens,
        $tokenStore.balances,
      ),
      marketCap: formatToNonZeroDecimal(
        calculateMarketCap($tokenStore.tokens, $tokenStore.prices),
      ),
    };
  });

  // Enhanced clipboard functionality with better error handling
  async function copyToClipboard(tokenId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(tokenId);
      copyStates.update((states) => ({ ...states, [tokenId]: "Copied!" }));
      setTimeout(() => {
        copyStates.update((states) => ({ ...states, [tokenId]: "" }));
      }, 2000);
    } catch (error) {
      console.error("Copy failed:", error);
      toastStore.error("Failed to copy token ID", 2000);
    }
  }

  // Handle swap button click
  async function handleSwap(token: FE.Token, event: MouseEvent) {
    event.stopPropagation(); // Prevent row click
    swapState.setPayToken(token);
    swapState.update((s) => ({
      ...s,
      showPayTokenSelector: false, // Don't show selector since we already picked a token
    }));
    await goto("/swap");
  }

  // Handle row click for token selection
  function handleTokenSelect(token: FE.Token) {
    swapState.setPayToken(token);
    swapState.update((s) => ({
      ...s,
      showPayTokenSelector: true,
    }));
  }

  // Debounced search with proper typing
  const debouncedSearch = debounce((value: string) => {
    searchQuery.set(value);
  }, DEBOUNCE_DELAY);

  // Subscribe to token store updates
  $: storeBalances = $tokenStore.balances;

  onMount(async () => {
    await tokenStore.loadFavorites();
  });

  // Create a writable store for activeTab
  const activeTabStore = writable<"all" | "favorites">("all");

  // Create a reactive statement to watch for price changes
  $: if ($formattedTokens) {
    previousPrices.update((prev) => {
      const next = { ...prev };
      $formattedTokens.forEach((token) => {
        const currentPrice = token.price;
        if (prev[token.canister_id] === undefined) {
          // Initialize price for first time
          next[token.canister_id] = currentPrice;
        } else if (currentPrice !== prev[token.canister_id]) {
          // Price has changed, keep the old price for animation
          next[token.canister_id] = prev[token.canister_id];
          // Schedule an update to store the new price after animation
          setTimeout(() => {
            previousPrices.update((p) => ({
              ...p,
              [token.canister_id]: currentPrice,
            }));
          }, 1500); // Match animation duration
        }
      });
      return next;
    });
  }

  // Update the filteredSortedTokens derived store
  const filteredSortedTokens = derived(
    [
      formattedTokens,
      searchQuery,
      sortColumnStore,
      sortDirectionStore,
      currentWalletFavorites,
      poolsList,
      tokenStore,
      activeTabStore,
      previousPrices
    ],
    ([
      $formattedTokens,
      $searchQuery,
      $sortColumn,
      $sortDirection,
      $currentWalletFavorites,
      $poolsList,
      $tokenStore,
      $activeTab,
      $previousPrices
    ]) => {
      if (!$formattedTokens) return [];

      // First filter tokens
      let filtered = $formattedTokens
        .filter((token) => {
          // First check favorites tab - only filter if in favorites tab
          if ($activeTab === "favorites" && !$currentWalletFavorites.includes(token.canister_id)) {
            return false;
          }

          // Then check search query
          if (!$searchQuery) return true;
          const searchLower = $searchQuery.toLowerCase();
          return (
            token.name?.toLowerCase().includes(searchLower) ||
            token.symbol?.toLowerCase().includes(searchLower) ||
            token.canister_id?.toLowerCase().includes(searchLower)
          );
        })
        .map((token) => {
          // Get all pools for this token
          const tokenPools = $poolsList.filter(pool => 
            pool.address_0 === token.canister_id || 
            pool.address_1 === token.canister_id
          );

          // Calculate TVL for this token
          const tvl = tokenPools.reduce((total, pool) => {
            const tokenPrice = $tokenStore.prices[token.canister_id] || 0;
            if (pool.address_0 === token.canister_id) {
              return total + (Number(pool.balance_0) * tokenPrice) / Math.pow(10, token.decimals);
            } else {
              return total + (Number(pool.balance_1) * tokenPrice) / Math.pow(10, token.decimals);
            }
          }, 0);

          // Calculate 24h volume
          let volume24h = 0;
          if (token.canister_id === process.env.CANISTER_ID_CKUSDT_LEDGER) {
            // For ckUSDT, sum up volume from all pools that include ckUSDT
            volume24h = $poolsList.reduce((total, pool) => {
              if (pool.address_0 === token.canister_id || pool.address_1 === token.canister_id) {
                return total + Number(pool.rolling_24h_volume || 0) / Math.pow(10, 6);
              }
              return total;
            }, 0);
          } else {
            // For other tokens, use total_24h_volume which is already in USD
            volume24h = Number(token.total_24h_volume) / Math.pow(10, 6);
          }

          // Calculate price change percentage
          const prevPrice = $previousPrices[token.canister_id] || token.price;
          const priceChange = ((token.price - prevPrice) / prevPrice) * 100;
          const price_change_24h = isNaN(priceChange) ? 0 : Number(priceChange.toFixed(2));

          return {
            ...token,
            tvl,
            volume24h,
            price_change_24h,
            isFavorite: $currentWalletFavorites.includes(token.canister_id),
            balance: BigInt(token.balance || "0") // Convert balance to BigInt to fix type error
          };
        });

      // Sort by the selected column
      return filtered.sort((a, b) => {
        switch ($sortColumn) {
          case 'tvl':
            return $sortDirection === 'desc' ? b.tvl - a.tvl : a.tvl - b.tvl;
          case 'volume24h':
            return $sortDirection === 'desc' ? b.volume24h - a.volume24h : a.volume24h - b.volume24h;
          case 'price':
            return $sortDirection === 'desc' ? b.price - a.price : a.price - b.price;
          case 'price_change_24h':
            return $sortDirection === 'desc' ? b.price_change_24h - a.price_change_24h : a.price_change_24h - b.price_change_24h;
          case 'name':
            return $sortDirection === 'desc' 
              ? b.name.localeCompare(a.name)
              : a.name.localeCompare(b.name);
          case 'favorite':
            return $sortDirection === 'desc' ? b.isFavorite - a.isFavorite : a.isFavorite - b.isFavorite;
          default:
            return b.tvl - a.tvl; // Default sort by TVL
        }
      });
    }
  );

  // Mock data for volume chart only
  const mockVolumeData = writable([
    { date: "11/20", value: 1250000 },
    { date: "11/21", value: 980000 },
    { date: "11/22", value: 1450000 },
    { date: "11/23", value: 2100000 },
    { date: "11/24", value: 1680000 },
    { date: "11/25", value: 1890000 },
    { date: "11/26", value: 2350000 },
  ]);

  // Replace the existing volumeData with mock data
  const volumeData = mockVolumeData;

  function handleTokenSelectClose() {
    swapState.update((s) => ({ ...s, showPayTokenSelector: false }));
  }

  // Update the getPriceChangeClass function to be more precise
  function getPriceChangeClass(
    token: any,
    $previousPrices: { [key: string]: number },
  ): string {
    const prevPrice = $previousPrices[token.canister_id];
    const currentPrice = token.price;

    if (prevPrice === undefined || currentPrice === prevPrice) {
      return "";
    }
    return currentPrice > prevPrice ? "price-up" : "price-down";
  }

  // Add this function near your other event handlers
  function handleSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    debouncedSearch(target.value);
  }

  // Update the toggleFavorite function
  async function toggleFavorite(token: FE.Token, event: MouseEvent) {
    event.stopPropagation(); // Prevent row click
    await favoriteStore.toggleFavorite(token.canister_id);
  }

  // Subscribe to tokenStore
  $: $tokenStore;
</script>

<section class="flex justify-center w-full px-4">
  <div class="z-10 flex justify-center w-full max-w-[1300px] mx-auto">
    <div class="flex flex-col w-full">
      <!-- Market Overview Panel -->
      <div class="earn-cards">
        <div class="earn-card">
          <div class="card-content">
            <h3>Total Volume (24h)</h3>
            <p>Trading activity in the last 24 hours</p>
            <div class="apy">
              ${formatToNonZeroDecimal($marketStats.totalVolume)}
            </div>
          </div>
          <div class="stat-icon-wrapper">
            <BarChart class="stat-icon" />
          </div>
        </div>

        <div class="earn-card">
          <div class="card-content">
            <h3>Total Liquidity</h3>
            <p>Total value locked in pools</p>
            <div class="apy">
              ${formatToNonZeroDecimal($marketStats.totalLiquidity)}
            </div>
          </div>
          <div class="stat-icon-wrapper">
            <Droplets class="stat-icon" />
          </div>
        </div>

        <div class="earn-card">
          <div class="card-content">
            <h3>Total Fees (24h)</h3>
            <p>Fees earned by liquidity providers</p>
            <div class="apy">
              ${formatToNonZeroDecimal($marketStats.totalFees)}
            </div>
          </div>
          <div class="stat-icon-wrapper">
            <DollarSign class="stat-icon" />
          </div>
        </div>
      </div>

      <!-- Tokens Panel -->
      <Panel variant="green" type="main" className="content-panel">
        <div class="flex justify-between items-center mb-4">
          <div class="flex items-center gap-4">
           
            {#if $auth.isConnected}
              <div class="tab-group">
                <button
                  class="tab-button {$activeTabStore === 'all' ? 'active' : ''}"
                  on:click={() => activeTabStore.set("all")}
                >
                  All Tokens
                </button>
                <button
                  class="tab-button {$activeTabStore === 'favorites' ? 'active' : ''}"
                  on:click={() => activeTabStore.set("favorites")}
                >
                  Favorites ({$currentWalletFavorites.length})
                </button>
              </div>
            {/if}
          </div>
          <div class="search-container">
            <input
              type="text"
              placeholder="Search tokens..."
              class="search-input"
              on:input={handleSearch}
            />
          </div>
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
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  {#if $auth.isConnected}
                    <TableHeader
                      column="favorite"
                      label=""
                      textClass="text-center w-12"
                      sortColumn={$sortColumnStore}
                      sortDirection={$sortDirectionStore}
                      onsort={handleSort}
                    />
                  {/if}
                  <TableHeader
                    column="name"
                    label="Token"
                    textClass="text-left min-w-[200px]"
                    sortColumn={$sortColumnStore}
                    sortDirection={$sortDirectionStore}
                    onsort={handleSort}
                  />
                  <TableHeader
                    column="price"
                    label="Price"
                    textClass="text-right min-w-[120px]"
                    sortColumn={$sortColumnStore}
                    sortDirection={$sortDirectionStore}
                    onsort={handleSort}
                  />
                  <TableHeader
                    column="price_change_24h"
                    label="Change"
                    textClass="text-right min-w-[100px]"
                    sortColumn={$sortColumnStore}
                    sortDirection={$sortDirectionStore}
                    onsort={handleSort}
                  />
                  <TableHeader
                    column="volume24h"
                    label="Volume"
                    textClass="text-right min-w-[120px]"
                    sortColumn={$sortColumnStore}
                    sortDirection={$sortDirectionStore}
                    onsort={handleSort}
                  />
                  <TableHeader
                    column="tvl"
                    label="TVL"
                    textClass="text-right min-w-[120px]"
                    sortColumn={$sortColumnStore}
                    sortDirection={$sortDirectionStore}
                    onsort={handleSort}
                  />
                  <TableHeader
                    column="actions"
                    label="Actions"
                    textClass="text-right min-w-[120px]"
                    sortColumn={$sortColumnStore}
                    sortDirection={$sortDirectionStore}
                    onsort={handleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {#each $filteredSortedTokens as token (token.canister_id)}
                  {@const priceChangeClass =
                    token.price_change_24h > 0
                      ? "positive"
                      : token.price_change_24h < 0
                        ? "negative"
                        : ""}
                  <tr
                    class="token-row"
                    on:click={() => handleTokenSelect(token)}
                  >
                    {#if $auth.isConnected}
                      <td class="favorite-cell">
                        <button
                          class="favorite-button {$currentWalletFavorites.includes(
                            token.canister_id,
                          )
                            ? 'active'
                            : ''}"
                          on:click={(e) => toggleFavorite(token, e)}
                        >
                          {#if $currentWalletFavorites.includes(token.canister_id)}
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
                      </td>
                    {/if}
                    <td class="token-cell">
                      <TokenImages
                        tokens={[token]}
                        containerClass="token-image"
                        size={32}
                      />
                      <div class="token-info">
                        <span class="token-name">{token.name}</span>
                        <span class="token-symbol">{token.symbol}</span>
                      </div>
                    </td>
                    <td
                      class="price-cell"
                      title={formatToNonZeroDecimal(token.price)}
                    >
                      {#key token.price}
                        <span class={getPriceChangeClass(token, $previousPrices)}>
                          ${formatToNonZeroDecimal(token.price)}
                          {#if getPriceChangeClass(token, $previousPrices) === "price-up"}
                            <div transition:fade={{ duration: 1500 }}>
                              <ArrowUp class="price-arrow up" size={14} />
                            </div>
                          {:else if getPriceChangeClass(token, $previousPrices) === "price-down"}
                            <div transition:fade={{ duration: 1500 }}>
                              <ArrowDown class="price-arrow down" size={14} />
                            </div>
                          {/if}
                        </span>
                      {/key}
                    </td>
                    <td
                      class="change-cell text-right {priceChangeClass}"
                      title={`${token.price_change_24h}%`}
                    >
                      {#key token.price_change_24h}
                        <span>
                          {token.price_change_24h}%
                        </span>
                      {/key}
                    </td>
                    <td class="text-right">
                      {#key token.volume24h}
                        {formatUsdValue(token.volume24h)}
                      {/key}
                    </td>
                    <td class="text-right">
                      {#key token.tvl}
                        {formatUsdValue(token.tvl.toString())}
                      {/key}
                    </td>
                    <td class="actions-cell">
                      <button
                        class="action-button"
                        on:click|stopPropagation={() =>
                          copyToClipboard(token.canister_id)}
                      >
                        {$copyStates[token.canister_id] || "Copy ID"}
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </Panel>
    </div>
  </div>
</section>

<style lang="postcss">
  /* Replace the existing market-stats styles with these */
  .earn-cards {
    @apply grid grid-cols-1 md:grid-cols-3 gap-4 mb-4;
  }

  .earn-card {
    @apply relative flex items-start justify-between p-4 rounded-lg transition-all duration-200
           bg-[#1a1b23]/60 border border-[#2a2d3d] text-left
           hover:shadow-sm hover:shadow-[#60A5FA]/5 backdrop-blur-sm;
  }

  .earn-card:hover {
    @apply bg-[#1e1f2a]/80 border-[#60A5FA]/30
           shadow-[0_0_10px_rgba(96,165,250,0.1)]
           transform scale-[1.01];
  }

  .card-content {
    @apply flex flex-col gap-1.5;
  }

  .card-content h3 {
    @apply text-lg text-white;
  }

  .card-content p {
    @apply text-[#8890a4] text-sm;
  }

  .apy {
    @apply text-[#60A5FA] font-medium mt-2 text-lg;
  }

  .stat-icon-wrapper {
    @apply p-3 rounded-lg bg-white/10 text-white/80;
  }

  /* Search Input */
  .search-container {
    @apply relative;
  }

  .search-input {
    @apply w-64 px-4 py-2 rounded-lg bg-white/5 text-white 
           placeholder-white/40 border border-white/10 
           focus:border-white/20 focus:outline-none
           transition-all duration-200;
  }

  /* Table Styling */
  .table-container {
    @apply overflow-x-auto rounded-lg;
  }

  .data-table {
    @apply w-full border-collapse;
  }

  .data-table thead th {
    @apply px-4 py-3 text-sm font-medium text-white/60
           border-b border-white/10 whitespace-nowrap;
    height: 48px;
    vertical-align: bottom;
  }

  .data-table tbody tr {
    @apply border-b border-white/5 hover:bg-white/5
           transition-colors duration-200 cursor-pointer;
  }

  .token-row {
    @apply relative;
  }

  .token-row::after {
    content: "Click to copy ID";
    @apply absolute right-2 top-1/2 -translate-y-1/2 
           text-xs text-white/40 opacity-0 transition-opacity duration-200
           md:hidden;
  }

  .token-row:active::after {
    @apply opacity-100;
  }

  .data-table td {
    @apply px-4 py-3 text-sm text-white/80;
  }

  /* Token Cell Styling */
  .token-cell {
    @apply flex items-center gap-3 relative;
  }

  .token-info {
    @apply flex-grow;
  }

  .token-name {
    @apply text-white font-medium;
  }

  .token-symbol {
    @apply text-sm text-white/60;
  }

  /* Price Cells */
  .price-cell {
    @apply text-right text-white font-medium whitespace-nowrap
           font-mono tracking-tight;
  }

  .price-change-cell {
    @apply text-right font-medium whitespace-nowrap;
    &.positive {
      @apply text-green-400;
    }
    &.negative {
      @apply text-red-400;
    }
  }

  .actions-cell {
    @apply text-right min-w-[180px];
  }

  .action-button {
    @apply px-3 py-1.5 text-xs rounded 
           transition-all duration-200
           focus:outline-none focus:ring-2 focus:ring-white/20;
  }

  .action-button:not(.swap-button) {
    @apply bg-white/5 text-white/60
           hover:bg-white/10 hover:text-white;
  }

  .action-button.swap-button {
    @apply bg-[#60A5FA]/20 text-[#60A5FA]
           hover:bg-[#60A5FA]/30 hover:text-[#60A5FA]/90;
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .actions-header {
      @apply !table-cell;
    }

    .actions-cell {
      @apply !table-cell min-w-[140px];
    }

    .action-button {
      @apply px-2 py-1 text-xs;
    }
  }

  @media (max-width: 640px) {
    .actions-header,
    .actions-cell {
      @apply !hidden;
    }
  }

  /* Responsive Adjustments */
  @media (max-width: 768px) {
    .market-stats-grid {
      @apply grid-cols-1;
    }

    .search-input {
      @apply w-full max-w-[200px];
    }

    .data-table {
      @apply text-sm;
    }

    .token-name {
      @apply text-sm;
    }

    .token-symbol {
      @apply text-xs;
    }
  }

  @media (max-width: 640px) {
    .data-table td,
    .data-table th {
      @apply px-2 py-2;
    }

    .copy-button {
      @apply hidden;
    }
  }

  /* Animations */
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .stat-card {
    animation: fadeIn 0.3s ease-out forwards;
  }

  /* Hover Effects */
  .stat-card:hover .stat-icon-wrapper {
    @apply bg-white/15;
  }

  /* Custom Scrollbar */
  .table-container {
    @apply overflow-x-auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .table-container::-webkit-scrollbar {
    @apply h-1.5;
  }

  .table-container::-webkit-scrollbar-track {
    @apply bg-transparent;
  }

  .table-container::-webkit-scrollbar-thumb {
    @apply bg-white/20 rounded-full hover:bg-white/30;
  }

  /* Update the price animation styles */
  .price-up {
    animation: flash-green 1.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .price-down {
    animation: flash-red 1.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes flash-green {
    0% {
      background-color: rgba(34, 197, 94, 0.2);
    }
    30% {
      background-color: rgba(34, 197, 94, 0.15);
    }
    100% {
      background-color: transparent;
    }
  }

  @keyframes flash-red {
    0% {
      background-color: rgba(239, 68, 68, 0.2);
    }
    30% {
      background-color: rgba(239, 68, 68, 0.15);
    }
    100% {
      background-color: transparent;
    }
  }

  /* Make sure the price cell spans have proper padding and transition */
  .price-cell span {
    @apply inline-flex items-center gap-1 justify-end rounded px-2 py-1;
    position: relative;
    transition: background-color 0.3s ease;
  }

  .price-arrow {
    @apply absolute right-0 transform translate-x-4;
    opacity: 0;
    animation: slide-fade 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  .price-arrow.up {
    @apply text-green-400;
  }

  .price-arrow.down {
    @apply text-red-400;
  }

  @keyframes slide-fade {
    0% {
      opacity: 0;
      transform: translate-x-2;
    }
    20% {
      opacity: 1;
      transform: translate-x-4;
    }
    80% {
      opacity: 1;
      transform: translate-x-4;
    }
    100% {
      opacity: 0;
      transform: translate-x-6;
    }
  }

  /* Add smooth transitions for table rows */
  .token-row {
    @apply transition-all duration-300 ease-in-out;
  }

  .token-row td {
    @apply transition-colors duration-300;
  }

  /* Optimize table updates */
  tbody {
    @apply relative;
    contain: content;
  }

  /* Add will-change for better performance */
  .price-cell span,
  .change-cell span {
    will-change: transform, opacity, background-color;
  }

  .favorite-button {
    @apply flex items-center justify-center;
    @apply w-8 h-8 rounded-lg;
    @apply hover:bg-white/10;
    @apply transition-colors;
  }

  .favorite-button .star-icon {
    @apply text-white/40;
    @apply transition-colors;
  }

  .favorite-button:hover .star-icon {
    @apply text-white/60;
  }

  .favorite-button.active .star-icon.filled {
    @apply text-yellow-400;
  }

  .favorite-cell {
    @apply w-12 px-2;
  }

  .tab-group {
    @apply flex gap-2 ml-4 text-base;
  }

  .tab-button {
    @apply px-3 py-1.5 rounded-lg text-sm font-medium
           transition-all duration-200
           hover:bg-white/10;
  }

  .tab-button.active {
    @apply bg-white/10 text-white;
  }

  .tab-button:not(.active) {
    @apply text-white/60;
  }

  /* Change Cell Specific Styling */
  .change-cell {
    @apply text-right whitespace-nowrap;
  }

  .change-cell.positive {
    @apply text-green-400;
  }

  .change-cell.negative {
    @apply text-red-400;
  }

  /* Ensure consistent header alignment */
  thead tr {
    @apply h-12 align-bottom;
  }

  th[data-column="price_change_24h"] {
    @apply text-right align-bottom;
  }

  /* Table Header Styling */
  .data-table thead th {
    @apply px-4 py-3 text-sm font-medium text-white/60
           border-b border-white/10 whitespace-nowrap;
    height: 48px;
    vertical-align: bottom;
  }

  /* Ensure all header cells have consistent height and alignment */
  .data-table th {
    @apply relative;
  }

  .data-table th :global(span) {
    @apply absolute bottom-3;
  }

  /* Right-aligned headers */
  .data-table th.text-right :global(span) {
    @apply right-4;
  }

  /* Left-aligned headers */
  .data-table th.text-left :global(span) {
    @apply left-4;
  }

  /* Change Cell Specific Styling */
  .change-cell {
    @apply text-right whitespace-nowrap;
  }

  .change-cell.positive {
    @apply text-green-400;
  }

  .change-cell.negative {
    @apply text-red-400;
  }
</style>
