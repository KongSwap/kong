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
  import { page } from "$app/stores";
    import { tokens, type IndexerToken } from "$lib/services/indexer/api";

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
    [tokenStore, poolStore],
    ([$tokenStore, $poolStore]): boolean =>
      $tokenStore.isLoading || $poolStore.isLoading,
  );

  // Improved error handling with null checks
  const tokensError = derived(
    [tokenStore, poolStore],
    ([$tokenStore, $poolStore]): string | null =>
      $tokenStore.error || $poolStore.error || null,
  );

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


  // Debounced search with proper typing
  const debouncedSearch = debounce((value: string) => {
    searchQuery.set(value);
  }, DEBOUNCE_DELAY);


  onMount(async () => {
    await tokenStore.loadFavorites();
  });

  // Create a writable store for activeTab
  const activeTabStore = writable<"all" | "favorites">("all");

  // Initialize activeTab from URL query param
  $: activeTabStore.set($page.url.searchParams.get("tab") === "favorites" ? "favorites" : "all");

  // Update URL when tab changes
  $: {
    const currentTab = $activeTabStore;
    if (currentTab === "favorites") {
      goto(`?tab=favorites`, { replaceState: true });
    } else {
      goto(`?`, { replaceState: true });
    }
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
  async function toggleFavorite(token: IndexerToken, event: MouseEvent) {
    event.stopPropagation(); // Prevent row click
    await favoriteStore.toggleFavorite(token.address);
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
              <!-- ${formatToNonZeroDecimal($marketStats.totalVolume)} -->
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
              <!-- ${formatToNonZeroDecimal($marketStats.totalLiquidity)} -->
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
              <!-- ${formatToNonZeroDecimal($marketStats.totalFees)} -->
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
            <div class="tab-group">
              <button
                class="tab-button {$activeTabStore === 'all' ? 'active' : ''}"
                  on:click={() => activeTabStore.set("all")}
                >
                  All Tokens
                </button>
              {#if $auth.isConnected}
                <button
                  class="tab-button {$activeTabStore === 'favorites' ? 'active' : ''}"
                  on:click={() => activeTabStore.set("favorites")}
                >
                  Favorites ({$currentWalletFavorites.length})
                </button>
              {/if}
            </div>
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
                    label="Change (1D)"
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
                    column="marketCap"
                    label="Market Cap"
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
                {#each $tokens as token (token.address)}
                  {@const priceChangeClass =
                    token.metrics.priceChange24h > 0
                      ? "positive"
                      : token.metrics.priceChange24h < 0
                        ? "negative"
                        : ""}
                  <tr
                    class="token-row"
                    on:click={() => goto(`/stats/${token.address}`)}
                  >
                    {#if $auth.isConnected}
                      <td class="favorite-cell">
                        <button
                          class="favorite-button {$currentWalletFavorites.includes(
                            token.address
                          )
                            ? 'active'
                            : ''}"
                          on:click={(e) => toggleFavorite(token, e)}
                        >
                          {#if $currentWalletFavorites.includes(token.address)}
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
                        tokens={[]}
                        containerClass="token-image"
                        size={32}
                      />
                      <div class="token-info">
                        <span class="token-name">{token.name}</span>
                        <span class="token-symbol">{token.symbol}</span>
                      </div>
                    </td>
                    <td class="price-cell">
                      {#key token.metrics.price}
                        <span class={getPriceChangeClass(token, $previousPrices)}>
                          ${formatToNonZeroDecimal(token.metrics.price)}
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
                    <td class="change-cell text-right {priceChangeClass}">
                      {#key token.metrics.priceChange24h}
                        <span>
                          {token.metrics.priceChange24h.toFixed(2)}%
                        </span>
                      {/key}
                    </td>
                    <td class="text-right">
                      {#key token.metrics.volume24h}
                        <span>{formatUsdValue(token.metrics.volume24h)}</span>
                      {/key}
                    </td>
                    <td class="text-right">
                      {#key token.metrics.marketCap}
                        <span>{formatUsdValue(token.metrics.marketCap.toString())}</span>
                      {/key}
                    </td>
                    <td class="actions-cell">
                      <button
                        class="action-button"
                        on:click|stopPropagation={() =>
                          copyToClipboard(token.address)}
                      >
                        {$copyStates[token.address] || "Copy ID"}
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
