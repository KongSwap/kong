<script lang="ts">
  import { writable, derived } from "svelte/store";
  import { t } from "$lib/services/translations";
  import Panel from "$lib/components/common/Panel.svelte";
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
  import { poolStore } from "$lib/services/pools/poolStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { filterTokens, sortTableData } from "$lib/utils/statsUtils";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import { flip } from "svelte/animate";
  import debounce from "lodash-es/debounce";
  import {
    ArrowUpDown,
    TrendingUp,
    Droplets,
    DollarSign,
    LineChart,
    BarChart,
    Coins,
    ArrowUp,
    ArrowDown,
    Star,
  } from "lucide-svelte";
  import { onMount } from "svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import Toast from "$lib/components/common/Toast.svelte";
  import { swapState } from "$lib/services/swap/SwapStateService";
  import { goto } from "$app/navigation";
  import { fade } from "svelte/transition";
  import { auth } from "$lib/services/auth";
  import {
    favoriteStore,
    currentWalletFavorites,
  } from "$lib/services/tokens/favoriteStore";

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
  const sortColumnStore = writable<string>("formattedUsdValue");
  const sortDirectionStore = writable<"asc" | "desc">("desc");
  const copyStates = writable<CopyStates>({});

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

  // Derived store for filtered and sorted tokens with improved performance
  const filteredSortedTokens = derived(
    [
      formattedTokens,
      searchQuery,
      sortColumnStore,
      sortDirectionStore,
      currentWalletFavorites,
    ],
    ([
      $formattedTokens,
      $searchQuery,
      $sortColumn,
      $sortDirection,
      $currentWalletFavorites,
    ]) => {
      if (!$formattedTokens) return [];

      // First filter tokens
      const filtered = $formattedTokens
        .filter((token) => {
          if (!$searchQuery) return true;

          const searchLower = $searchQuery.toLowerCase();
          return (
            token.name?.toLowerCase().includes(searchLower) ||
            token.symbol?.toLowerCase().includes(searchLower) ||
            token.canister_id?.toLowerCase().includes(searchLower)
          );
        })
        .map((token) => ({
          ...token,
          isFavorite: $currentWalletFavorites.includes(token.canister_id),
        }));

      // Then sort the filtered results
      return sortTableData(filtered, $sortColumn, $sortDirection);
    },
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

  // Update the previousPrices store initialization
  const previousPrices = writable<{ [key: string]: number }>({});

  // Create a reactive statement to watch for price changes
  $: if ($formattedTokens) {
    previousPrices.update((prev) => {
      const next = { ...prev };
      $formattedTokens.forEach((token) => {
        // Only update if we have a previous price and it's different
        if (
          prev[token.canister_id] !== undefined &&
          token.price !== prev[token.canister_id]
        ) {
          next[token.canister_id] = prev[token.canister_id]; // Keep the old price
        } else if (prev[token.canister_id] === undefined) {
          // Initialize price for first time
          next[token.canister_id] = token.price;
        }
      });
      return next;
    });
  }

  // Update the getPriceChangeClass function to be more precise
  function getPriceChangeClass(
    token: any,
    $previousPrices: { [key: string]: number },
  ): string {
    const prevPrice = $previousPrices[token.canister_id];
    const currentPrice = token.price;

    // Only return a class if we have both prices and they're different
    if (prevPrice !== undefined && currentPrice !== prevPrice) {
      return currentPrice > prevPrice ? "price-up" : "price-down";
    }
    return "";
  }

  // Add this function near your other event handlers
  function handleSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    debouncedSearch(target.value);
  }

  // Toggle favorite button
  function toggleFavorite(token: FE.Token, event: MouseEvent) {
    event.stopPropagation(); // Prevent row click
    tokenStore.toggleFavorite(token.canister_id);
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
            <h3 class="text-white/80 font-medium">Tokens</h3>
            {#if $tokenStats.totalTokens}
              <span class="text-sm text-white/50"
                >({$tokenStats.totalTokens} total)</span
              >
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
                      textClass="text-left"
                      sortColumn={$sortColumnStore}
                      sortDirection={$sortDirectionStore}
                      onsort={handleSort}
                    />
                  {/if}
                  <TableHeader
                    column="name"
                    label="Token"
                    textClass="text-left"
                    sortColumn={$sortColumnStore}
                    sortDirection={$sortDirectionStore}
                    onsort={handleSort}
                  />
                  <TableHeader
                    column="price"
                    label="Price"
                    textClass="text-right"
                    sortColumn={$sortColumnStore}
                    sortDirection={$sortDirectionStore}
                    onsort={handleSort}
                  />
                  <TableHeader
                    column="price_change_24h"
                    label="24h Change"
                    textClass="text-right"
                    sortColumn={$sortColumnStore}
                    sortDirection={$sortDirectionStore}
                    onsort={handleSort}
                  />
                  <TableHeader
                    column="actions"
                    label="Actions"
                    textClass="text-right"
                    sortColumn={$sortColumnStore}
                    sortDirection={$sortDirectionStore}
                    onsort={handleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {#each $filteredSortedTokens as token}
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
                          class="favorite-button {token.isFavorite
                            ? 'active'
                            : ''}"
                          on:click={(e) => toggleFavorite(token, e)}
                        >
                          {#if token.isFavorite}
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
                      <span class={getPriceChangeClass(token, $previousPrices)}>
                        ${formatToNonZeroDecimal(token.price)}
                        {#key token.price}
                          {#if getPriceChangeClass(token, $previousPrices) === "price-up"}
                            <div transition:fade={{ duration: 1500 }}>
                              <ArrowUp class="price-arrow up" size={14} />
                            </div>
                          {:else if getPriceChangeClass(token, $previousPrices) === "price-down"}
                            <div transition:fade={{ duration: 1500 }}>
                              <ArrowDown class="price-arrow down" size={14} />
                            </div>
                          {/if}
                        {/key}
                      </span>
                    </td>
                    <td
                      class="change-cell text-right {priceChangeClass}"
                      title={`${token.price_change_24h}%`}
                    >
                      <span>
                        {token.price_change_24h}%
                      </span>
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
    @apply px-4 py-3 text-left text-sm font-medium text-white/60
           border-b border-white/10 whitespace-nowrap;
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
    animation: flash-green 1.5s ease-out;
  }

  .price-down {
    animation: flash-red 1.5s ease-out;
  }

  @keyframes flash-green {
    0% {
      background-color: rgba(34, 197, 94, 0.5);
    }
    50% {
      background-color: rgba(34, 197, 94, 0.35);
    }
    100% {
      background-color: transparent;
    }
  }

  @keyframes flash-red {
    0% {
      background-color: rgba(239, 68, 68, 0.5);
    }
    50% {
      background-color: rgba(239, 68, 68, 0.35);
    }
    100% {
      background-color: transparent;
    }
  }

  /* Make sure the price cell spans have proper padding and transition */
  .price-cell span {
    @apply inline-flex items-center gap-1 justify-end;
    position: relative;
  }

  .price-arrow {
    @apply ml-1;
  }

  .price-arrow.up {
    @apply text-green-400;
    animation: arrow-up 1.5s ease-out;
  }

  .price-arrow.down {
    @apply text-red-400;
    animation: arrow-down 1.5s ease-out;
  }

  @keyframes arrow-up {
    0% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-2px);
    }
    80% {
      transform: translateY(-1px);
    }
    100% {
      transform: translateY(0);
    }
  }

  @keyframes arrow-down {
    0% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(2px);
    }
    80% {
      transform: translateY(1px);
    }
    100% {
      transform: translateY(0);
    }
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
</style>
