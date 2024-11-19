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

  // Enhanced user stats with improved calculations
  const userStats = derived([tokenStore, poolStore], ([$tokenStore, $poolStore]) => {
    const calculateUniqueUsers = (balances: any): number => {
      return balances ? Object.keys(balances).length : 0;
    };

    const calculateTotalTransactions = (pools: any[]): number => {
      return pools.reduce((acc, pool) => {
        return acc + Number(pool.rolling_24h_num_swaps || 0);
      }, 0);
    };

    return {
      totalUsers: calculateUniqueUsers($tokenStore.balances),
      totalLpPositions: $poolStore.userPoolBalances?.length || 0,
      totalTx24h: calculateTotalTransactions($poolStore.pools)
    };
  });

  // Enhanced pool stats with better APY calculation
  const poolStats = derived(poolStore, ($poolStore) => {
    const calculateWeightedApy = (pools: any[]): number => {
      const poolsWithApy = pools.filter(pool => 
        pool.rolling_24h_apy && pool.tvl && 
        pool.rolling_24h_apy > 0 && pool.tvl > 0
      );
      
      const totalTvl = poolsWithApy.reduce((acc, pool) => 
        acc + Number(pool.tvl || 0), 0);
      
      const weightedApySum = poolsWithApy.reduce((acc, pool) => {
        const weight = Number(pool.tvl || 0) / totalTvl;
        return acc + (pool.rolling_24h_apy * weight);
      }, 0);
      
      return totalTvl > 0 ? weightedApySum : 0;
    };

    const calculateLifetimeMetrics = (pools: any[]) => {
      return pools.reduce((acc, pool) => ({
        volume: acc.volume + Number(pool.total_volume || 0) / 1e8,
        fees: acc.fees + Number(pool.total_lp_fee || 0) / 1e8
      }), { volume: 0, fees: 0 });
    };

    const lifetimeMetrics = calculateLifetimeMetrics($poolStore.pools);

    return {
      totalPools: $poolStore.pools.length,
      averageApy: formatToNonZeroDecimal(calculateWeightedApy($poolStore.pools)),
      lifetimeVolume: formatToNonZeroDecimal(lifetimeMetrics.volume),
      lifetimeFees: formatToNonZeroDecimal(lifetimeMetrics.fees)
    };
  });

  // Enhanced clipboard functionality with better error handling
  async function copyToClipboard(tokenId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(tokenId);
      updateCopyState(tokenId, "Copied!");
    } catch (error) {
      console.error("Copy failed:", error);
      updateCopyState(tokenId, "Copy Failed!");
    }
  }

  function updateCopyState(tokenId: string, text: string): void {
    copyStates.update(states => ({ ...states, [tokenId]: text }));
    setTimeout(() => {
      copyStates.update(states => ({ ...states, [tokenId]: "Copy" }));
    }, COPY_TIMEOUT);
  }

  // Debounced search with proper typing
  const debouncedSearch = debounce((value: string) => {
    searchQuery.set(value);
  }, DEBOUNCE_DELAY);

  // Enhanced pool sorting
  const sortedAndFilteredPools = derived(poolStore, ($poolStore) => {
    return [...$poolStore.pools].sort((a, b) => {
      const tvlA = Number(a.tvl || 0n);
      const tvlB = Number(b.tvl || 0n);
      return tvlB - tvlA;
    });
  });

  // Loading and error states for pools
  const poolsLoading = derived(poolStore, $store => $store.isLoading);
  const poolsError = derived(poolStore, $store => $store.error);

  // Derived store for filtered and sorted tokens with improved performance
  const filteredSortedTokens = derived(
    [formattedTokens, searchQuery, sortColumnStore, sortDirectionStore],
    ([$formattedTokens, $searchQuery, $sortColumn, $sortDirection]) => {
      if (!$formattedTokens) return [];
      
      const filtered = filterTokens($formattedTokens, $searchQuery);
      return sortTableData(filtered, $sortColumn, $sortDirection);
    }
  );
</script>

<Clouds />

<div class="stats-container">
  <!-- Market Overview Panel -->
  <Panel variant="green" type="main" className="market-stats-panel">
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
  <Panel variant="green" type="main" className="content-panel">
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
          <TableHeader 
            headers={tokensTableHeaders} 
            bind:sortColumn={$sortColumnStore} 
            bind:sortDirection={$sortDirectionStore} 
          />
          <tbody>
            {#each $filteredSortedTokens as token (token.canister_id)}
              <tr animate:flip={{ duration: ANIMATION_DURATION }}>
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
                  <button 
                    class="copy-button" 
                    on:click={() => copyToClipboard(token.canister_id)}
                    title="Copy token ID"
                  >
                    {$copyStates[token.canister_id] || "Copy ID"}
                  </button>
                </td>
                <td class="price-cell" title={formatToNonZeroDecimal(token.price)}>
                  {formatToNonZeroDecimal(token.price)}
                </td>
                <td class="price-change-cell" class:positive={token.price_change_24h > 0} class:negative={token.price_change_24h < 0}>
                  {token.price_change_24h > 0 ? '+' : ''}{token.price_change_24h?.toFixed(2)}%
                </td>
                <td class="volume-cell" title={formatToNonZeroDecimal(token.volume24h)}>
                  ${formatToNonZeroDecimal(token.volume24h)}
                </td>
                <td class="market-cap-cell" title={formatToNonZeroDecimal(token.market_cap)}>
                  ${formatToNonZeroDecimal(token.market_cap)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Panel>

  <!-- Additional Stats Panels -->
  <div class="panels-grid">
    <!-- Charts Section -->
    <div class="charts-grid">
      <!-- Volume Chart -->
      <Panel variant="green" type="main" className="chart-panel">
        <div class="chart-header">
          <h3 class="panel-title">Volume Trend</h3>
          <BarChart class="chart-icon" />
        </div>
        <div class="chart-placeholder">
          <div class="chart-bars">
            {#each Array(CHART_DAYS) as _, i}
              <div 
                class="bar" 
                style="height: {30 + Math.random() * 40}%"
                title={`Day ${i + 1}: $${formatToNonZeroDecimal(Math.random() * 1000000)}`}
              />
            {/each}
          </div>
          <div class="chart-labels">
            {#each Array(CHART_DAYS) as _, i}
              <div class="label">D-{CHART_DAYS - 1 - i}</div>
            {/each}
          </div>
        </div>
      </Panel>

      <!-- APY Chart -->
      <Panel variant="green" type="main" className="chart-panel">
        <div class="chart-header">
          <h3 class="panel-title">APY Trend</h3>
          <LineChart class="chart-icon" />
        </div>
        <div class="chart-placeholder">
          <svg class="line-chart" viewBox="0 0 300 100">
            <path
              d="M0,50 C60,40 140,80 300,30"
              class="chart-line"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            />
            {#each Array(CHART_POINTS) as _, i}
              <circle
                cx={i * 75}
                cy={40 + Math.random() * 20}
                r="3"
                class="chart-point"
                title={`Day ${i + 1}: ${(Math.random() * 100).toFixed(2)}% APY`}
              />
            {/each}
          </svg>
          <div class="chart-labels">
            {#each Array(CHART_POINTS) as _, i}
              <div class="label">D-{CHART_POINTS - 1 - i}</div>
            {/each}
          </div>
        </div>
      </Panel>
    </div>

    <!-- User Stats Panel -->
    <Panel variant="green" type="main" className="stats-panel">
      <h3 class="panel-title">User Statistics</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Total Users</span>
          <span class="stat-value">{$userStats.totalUsers.toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">LP Positions</span>
          <span class="stat-value">{$userStats.totalLpPositions.toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">24h Transactions</span>
          <span class="stat-value">{$userStats.totalTx24h.toLocaleString()}</span>
        </div>
      </div>
    </Panel>

    <!-- Pool Stats Panel -->
    <Panel variant="green" type="main" className="stats-panel">
      <h3 class="panel-title">Pool Statistics</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Total Pools</span>
          <span class="stat-value">{$poolStats.totalPools}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Average APY</span>
          <span class="stat-value">{$poolStats.averageApy}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Lifetime Volume</span>
          <span class="stat-value" title={formatToNonZeroDecimal($poolStats.lifetimeVolume)}>
            ${formatToNonZeroDecimal($poolStats.lifetimeVolume)}
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Lifetime Fees</span>
          <span class="stat-value" title={formatToNonZeroDecimal($poolStats.lifetimeFees)}>
            ${formatToNonZeroDecimal($poolStats.lifetimeFees)}
          </span>
        </div>
      </div>
    </Panel>
  </div>
</div>

<style lang="postcss">
  /* Container & Layout */
  .stats-container {
    @apply flex flex-col gap-6 p-4 relative z-10 max-w-[1440px] mx-auto;
  }

  /* Market Stats Section */
  .market-stats-grid {
    @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3;
  }

  .stat-card {
    @apply flex items-center gap-4 p-4 rounded-lg bg-white/5 
           backdrop-blur-sm hover:bg-white/10 transition-all duration-200
           border border-white/5;
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

  /* Main Content Panel */
  .content-panel {
    @apply p-6 backdrop-blur-sm border border-white/5;
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
           transition-colors duration-200;
  }

  .data-table td {
    @apply px-4 py-3 text-sm text-white/80;
  }

  /* Token Cell Styling */
  .token-cell {
    @apply flex items-center gap-3 min-w-[200px];
  }

  .token-info {
    @apply flex flex-col min-w-0;
  }

  .token-name {
    @apply text-white font-medium truncate;
  }

  .token-symbol {
    @apply text-sm text-white/60;
  }

  .token-image {
    @apply flex-shrink-0;
  }

  .copy-button {
    @apply ml-auto px-2 py-1 text-xs rounded bg-white/5 text-white/60
           hover:bg-white/10 hover:text-white transition-all duration-200
           focus:outline-none focus:ring-2 focus:ring-white/20;
  }

  /* Price & Volume Cells */
  .price-cell, .volume-cell, .market-cap-cell {
    @apply text-right text-white font-medium whitespace-nowrap
           font-mono tracking-tight;
  }

  .price-change-cell {
    @apply text-right font-medium whitespace-nowrap;
    &.positive { @apply text-green-400; }
    &.negative { @apply text-red-400; }
  }

  /* Error Message */
  .error-message {
    @apply text-red-400 text-center p-4 flex flex-col items-center gap-3;
  }

  .retry-button {
    @apply px-4 py-2 rounded-lg bg-white/10 text-white
           hover:bg-white/20 transition-all duration-200
           focus:outline-none focus:ring-2 focus:ring-white/20;
  }

  /* Charts Section */
  .panels-grid {
    @apply grid gap-6;
  }

  .charts-grid {
    @apply grid grid-cols-1 lg:grid-cols-2 gap-6;
  }

  .chart-panel {
    @apply p-6 backdrop-blur-sm border border-white/5;
  }

  .chart-header {
    @apply flex justify-between items-center mb-4;
  }

  .chart-icon {
    @apply w-5 h-5 text-white/60;
  }

  .panel-title {
    @apply text-lg font-medium text-white/80;
  }

  /* Bar Chart */
  .chart-placeholder {
    @apply h-48 flex flex-col;
  }

  .chart-bars {
    @apply flex-1 flex items-end justify-between gap-2 px-4;
  }

  .bar {
    @apply w-8 bg-gradient-to-t from-emerald-500/50 to-emerald-300/50 
           rounded-t-md transition-all duration-300 
           hover:from-emerald-500/70 hover:to-emerald-300/70 
           cursor-pointer;
  }

  /* Line Chart */
  .line-chart {
    @apply flex-1 text-emerald-400/50;
  }

  .chart-line {
    @apply transition-all duration-300;
  }

  .chart-point {
    @apply fill-emerald-400/50 transition-all duration-300
           cursor-pointer hover:fill-emerald-400;
  }

  .chart-labels {
    @apply flex justify-between px-4 py-2;
  }

  .label {
    @apply text-xs text-white/40;
  }

  /* Stats Panels */
  .stats-panel {
    @apply p-6 backdrop-blur-sm border border-white/5;
  }

  .stats-grid {
    @apply grid grid-cols-2 lg:grid-cols-4 gap-4;
  }

  .stat-item {
    @apply flex flex-col gap-1 p-4 rounded-lg bg-white/5
           hover:bg-white/10 transition-all duration-200
           border border-white/5;
  }

  .stat-label {
    @apply text-sm text-white/60;
  }

  .stat-value {
    @apply text-lg font-medium text-white font-mono tracking-tight;
  }

  /* Responsive Adjustments */
  @media (max-width: 1024px) {
    .stats-grid {
      @apply grid-cols-2;
    }
  }

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
  .chart-panel,
  .stats-panel {
    animation: fadeIn 0.3s ease-out forwards;
  }

  /* Hover Effects */
  .stat-card:hover .stat-icon-wrapper {
    @apply bg-white/15;
  }

  .stat-item:hover .stat-value {
    @apply text-emerald-400;
  }

  /* Loading State */
  .loading-indicator {
    @apply flex items-center justify-center p-8;
  }

  /* Tooltip Styles */
  [title] {
    @apply cursor-help;
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
