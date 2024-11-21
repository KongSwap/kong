<script lang="ts">
  import { writable, derived } from "svelte/store";
  import { t } from "$lib/services/translations";
  import Panel from "$lib/components/common/Panel.svelte";
  import TableHeader from "$lib/components/common/TableHeader.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Clouds from "$lib/components/stats/Clouds.svelte";
  import { formattedTokens, tokenStore } from "$lib/services/tokens/tokenStore";
  import { poolStore } from "$lib/services/pools/poolStore";
  import { walletStore } from "$lib/services/wallet/walletStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { filterTokens, sortTableData } from "$lib/utils/statsUtils";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import { flip } from "svelte/animate";
  import debounce from "lodash-es/debounce";
  import { ArrowUpDown, TrendingUp, Droplets, DollarSign, LineChart, BarChart, Coins } from 'lucide-svelte';
  import { tokensTableHeaders } from "$lib/constants/statsConstants";
  import { onMount } from "svelte";
  import { formatDate } from "$lib/utils/dateUtils";
  import { toastStore } from "$lib/stores/toastStore";
  import Toast from "$lib/components/common/Toast.svelte";

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
  const activeView = writable<"tokens" | "pools">("tokens");
  const sortColumnStore = writable<string>("formattedUsdValue");
  const sortDirectionStore = writable<"asc" | "desc">("desc");
  const copyStates = writable<CopyStates>({});

  // Enhanced loading state with type safety
  const tokensLoading = derived(
    [tokenStore, poolStore, formattedTokens],
    ([$tokenStore, $poolStore, $formattedTokens]): boolean => 
      $tokenStore.isLoading || 
      $poolStore.isLoading || 
      !$formattedTokens?.length
  );

  // Improved error handling with null checks
  const tokensError = derived(
    [tokenStore, poolStore],
    ([$tokenStore, $poolStore]): string | null => 
      $tokenStore.error || $poolStore.error || null
  );

  // Enhanced market stats calculation
  const marketStats = derived<[typeof tokenStore, typeof poolStore], MarketStats>(
    [tokenStore, poolStore], 
    ([$tokenStore, $poolStore]) => {
      const calculateVolume = (pools: any[]): number => {
        return pools.reduce((acc, pool) => {
          const volume = Number(pool.rolling_24h_volume || 0n) / 1e8;
          return acc + volume;
        }, 0);
      };

      const calculateLiquidity = (pools: any[]): number => {
        return pools.reduce((acc, pool) => {
          const tvl = Number(pool.tvl || 0n) / 1e8;
          return acc + tvl;
        }, 0);
      };

      const calculateFees = (pools: any[]): number => {
        return pools.reduce((acc, pool) => {
          const fees = Number(pool.rolling_24h_lp_fee || 0n) / 1e8;
          return acc + fees;
        }, 0);
      };

      return {
        totalVolume: formatToNonZeroDecimal(calculateVolume($poolStore.pools)),
        totalLiquidity: formatToNonZeroDecimal(calculateLiquidity($poolStore.pools)),
        totalFees: formatToNonZeroDecimal(calculateFees($poolStore.pools))
      };
    }
  );

  // Enhanced token stats with better type safety
  const tokenStats = derived(tokenStore, ($tokenStore) => {
    const calculateActiveTokens = (tokens: any[], balances: any): number => {
      return tokens?.filter(token => 
        balances[token.canister_id]?.in_tokens > 0n ||
        token.total_24h_volume > 0n
      ).length || 0;
    };

    const calculateMarketCap = (tokens: any[], prices: any): number => {
      return tokens?.reduce((acc, token) => {
        const price = prices[token.canister_id] || 0;
        const supply = Number(token.total_supply || 0) / Math.pow(10, token.decimals || 8);
        return acc + (price * supply);
      }, 0) || 0;
    };

    return {
      totalTokens: $tokenStore.tokens?.length || 0,
      activeTokens: calculateActiveTokens($tokenStore.tokens, $tokenStore.balances),
      marketCap: formatToNonZeroDecimal(calculateMarketCap($tokenStore.tokens, $tokenStore.prices))
    };
  });

  // Enhanced clipboard functionality with better error handling
  async function copyToClipboard(tokenId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(tokenId);
      toastStore.success("Token ID copied to clipboard!", 2000);
    } catch (error) {
      console.error("Copy failed:", error);
      toastStore.error("Failed to copy token ID", 2000);
    }
  }

  // Debounced search with proper typing
  const debouncedSearch = debounce((value: string) => {
    searchQuery.set(value);
  }, DEBOUNCE_DELAY);

  // Derived store for filtered and sorted tokens with improved performance
  const filteredSortedTokens = derived(
    [formattedTokens, searchQuery, sortColumnStore, sortDirectionStore],
    ([$formattedTokens, $searchQuery, $sortColumn, $sortDirection]) => {
      if (!$formattedTokens) return [];
      
      const filtered = filterTokens($formattedTokens, $searchQuery);
      return sortTableData(filtered, $sortColumn, $sortDirection);
    }
  );

  // Mock data for volume chart only
  const mockVolumeData = writable([
    { date: '11/20', value: 1250000 },
    { date: '11/21', value: 980000 },
    { date: '11/22', value: 1450000 },
    { date: '11/23', value: 2100000 },
    { date: '11/24', value: 1680000 },
    { date: '11/25', value: 1890000 },
    { date: '11/26', value: 2350000 },
  ]);

  // Replace the existing volumeData with mock data
  const volumeData = mockVolumeData;

  onMount(() => {
    // fetchHistoricalData();
  });
</script>

<Clouds />

<div class="stats-container">
  <!-- Market Overview Panel -->
  <Panel variant="green" type="main" className="market-stats-panel glass-panel">
    <div class="market-stats-grid">
      <div class="stat-card">
        <div class="stat-icon-wrapper">
          <BarChart class="stat-icon" />
        </div>
        <div class="stat-content">
          <h3>Total Volume (24h)</h3>
          <p>${formatToNonZeroDecimal($marketStats.totalVolume)}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrapper">
          <Droplets class="stat-icon" />
        </div>
        <div class="stat-content">
          <h3>Total Liquidity</h3>
          <p>${formatToNonZeroDecimal($marketStats.totalLiquidity)}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrapper">
          <DollarSign class="stat-icon" />
        </div>
        <div class="stat-content">
          <h3>Total Fees (24h)</h3>
          <p>${formatToNonZeroDecimal($marketStats.totalFees)}</p>
        </div>
      </div>
    </div>
  </Panel>

  <!-- Tokens Panel -->
  <Panel variant="green" type="main" className="content-panel glass-panel">
    <div class="flex justify-between items-center mb-4">
      <div class="flex items-center gap-4">
        <h3 class="text-white/80 font-medium">Tokens</h3>
        {#if $tokenStats.totalTokens}
          <span class="text-sm text-white/50">({$tokenStats.totalTokens} total)</span>
        {/if}
      </div>
      <div class="search-container">
        <input
          type="text"
          placeholder="Search tokens..."
          class="search-input"
          on:input={(e) => debouncedSearch(e.target.value)}
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
            tokenStore.refresh();
            poolStore.refresh();
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
              <th class="text-left">Token</th>
              <th class="text-right">Price</th>
              <th class="text-right">24h Change</th>
              <th class="text-right actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each $filteredSortedTokens as token (token.canister_id)}
              <tr 
                animate:flip={{ duration: ANIMATION_DURATION }}
                on:click={() => copyToClipboard(token.canister_id)}
                class="token-row"
                title="Click to copy token ID"
              >
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
                <td class="price-cell" title={formatToNonZeroDecimal(token.price)}>
                  ${formatToNonZeroDecimal(token.price)}
                </td>
                <td class="price-change-cell" class:positive={token.price_change_24h > 0} class:negative={token.price_change_24h < 0}>
                  {token.price_change_24h > 0 ? '+' : ''}{token.price_change_24h?.toFixed(2)}%
                </td>
                <td class="actions-cell">
                  <button 
                    class="copy-button" 
                    on:click|stopPropagation={() => copyToClipboard(token.canister_id)}
                    title="Copy token ID"
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

  <!-- Volume Chart Panel -->
  <Panel variant="green" type="main" className="chart-panel glass-panel">
    <div class="chart-header">
      <h3 class="panel-title">Volume Trend</h3>
      <BarChart class="chart-icon" />
    </div>
    <div class="chart-content">
      <div class="chart-bars">
        {#each $volumeData as day}
          {@const maxVolume = Math.max(...$volumeData.map(d => d.value))}
          {@const height = (day.value / maxVolume * 100)}
          <div class="bar-wrapper">
            <div 
              class="bar" 
              style="height: {height}%"
              title="${formatToNonZeroDecimal(day.value)}"
            >
              <span class="bar-value">${formatToNonZeroDecimal(day.value)}</span>
            </div>
            <span class="bar-label">{day.date}</span>
          </div>
        {/each}
      </div>
    </div>
  </Panel>
</div>

<style lang="postcss">
  /* Container & Layout */
  .stats-container {
    @apply flex flex-col gap-6 relative z-10 mx-auto;
  }

  /* Market Stats Section */
  .market-stats-grid {
    @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3;
  }

  .stat-card {
    @apply flex items-center gap-4 p-4 rounded-lg bg-black/20 
           backdrop-blur-sm hover:bg-black/30 transition-all duration-200
           border border-white/10;
  }

  .stat-icon-wrapper {
    @apply p-3 rounded-lg bg-white/10 text-white/80;
  }

  .stat-content {
    @apply flex flex-col;
  }

  .stat-content h3 {
    @apply text-sm text-white/60 font-medium;
  }

  .stat-content p {
    @apply text-xl font-medium text-white;
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
    @apply flex items-center gap-3;
    min-width: 180px;
  }

  @media (max-width: 640px) {
    .token-cell {
      min-width: 140px;
    }
  }

  .token-info {
    @apply flex flex-col;
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
    &.positive { @apply text-green-400; }
    &.negative { @apply text-red-400; }
  }

  .actions-cell {
    @apply text-right;
  }

  .copy-button {
    @apply px-3 py-1.5 text-xs rounded bg-white/5 text-white/60
           hover:bg-white/10 hover:text-white transition-all duration-200
           focus:outline-none focus:ring-2 focus:ring-white/20;
  }

  @media (max-width: 768px) {
    .actions-header,
    .actions-cell {
      @apply hidden;
    }

    .token-name {
      @apply text-sm;
    }

    .token-symbol {
      @apply text-xs;
    }

    .price-cell,
    .price-change-cell {
      @apply text-sm;
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
    .stats-container {
      @apply p-2;
    }

    .content-panel {
      @apply p-3;
    }

    .data-table td, 
    .data-table th {
      @apply px-2 py-2;
    }

    .copy-button {
      @apply hidden;
    }

    .chart-panel {
      @apply p-4;
    }
  }

  /* Animations */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .stat-card,
  .content-panel,
  .chart-panel {
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
</style>
