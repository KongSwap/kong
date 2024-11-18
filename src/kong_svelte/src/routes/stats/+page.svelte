<!-- src/kong_svelte/src/routes/stats/+page.svelte -->
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

  // State management
  const searchQuery = writable("");
  const activeView = writable("tokens"); // tokens, pools
  const sortColumnStore = writable("formattedUsdValue");
  const sortDirectionStore = writable("desc");
  const copyStates = writable({});

  // Loading state
  const tokensLoading = derived(
    [tokenStore, poolStore, formattedTokens],
    ([$tokenStore, $poolStore, $formattedTokens]) => 
      $tokenStore.isLoading || 
      $poolStore.isLoading || 
      !$formattedTokens?.length
  );

  // Error state with null check
  const tokensError = derived(
    [tokenStore, poolStore],
    ([$tokenStore, $poolStore]) => $tokenStore.error || $poolStore.error
  );

  // Derived stores for filtered/sorted data
  const filteredSortedTokens = derived(
    [formattedTokens, searchQuery, sortColumnStore, sortDirectionStore],
    ([$formattedTokens, $searchQuery, $sortColumn, $sortDirection]) => {
      if (!$formattedTokens) return [];
      const filtered = filterTokens($formattedTokens, $searchQuery);
      return sortTableData(filtered, $sortColumn, $sortDirection);
    }
  );

  // Market stats
  const marketStats = derived([tokenStore, poolStore], ([$tokenStore, $poolStore]) => {
    const totalVolume = $poolStore.pools.reduce((acc, pool) => {
      const volume = Number(pool.rolling_24h_volume || 0n) / 1e8;
      return acc + volume;
    }, 0);
    
    const totalLiquidity = $poolStore.pools.reduce((acc, pool) => {
      const tvl = Number(pool.tvl || 0n) / 1e8;
      return acc + tvl;
    }, 0);
    
    const totalFees = $poolStore.pools.reduce((acc, pool) => {
      const fees = Number(pool.rolling_24h_lp_fee || 0n) / 1e8;
      return acc + fees;
    }, 0);
    
    return {
      totalVolume: formatToNonZeroDecimal(totalVolume),
      totalLiquidity: formatToNonZeroDecimal(totalLiquidity),
      totalFees: formatToNonZeroDecimal(totalFees)
    };
  });

  // Token stats
  const tokenStats = derived(tokenStore, ($tokenStore) => {
    const totalTokens = $tokenStore.tokens?.length || 0;
    const activeTokens = $tokenStore.tokens?.filter(token => 
      $tokenStore.balances[token.canister_id]?.in_tokens > 0n ||
      token.total_24h_volume > 0n
    ).length || 0;
    
    // Calculate total market cap
    const marketCap = $tokenStore.tokens?.reduce((acc, token) => {
      const price = $tokenStore.prices[token.canister_id] || 0;
      const supply = Number(token.total_supply || 0) / Math.pow(10, token.decimals || 8);
      return acc + (price * supply);
    }, 0) || 0;

    return {
      totalTokens,
      activeTokens,
      marketCap: formatToNonZeroDecimal(marketCap)
    };
  });

  // Additional stats
  const userStats = derived([tokenStore, poolStore], ([$tokenStore, $poolStore]) => {
    // Total users is the number of unique wallets that have interacted with the platform
    const totalUsers = $tokenStore.balances ? Object.keys($tokenStore.balances).length : 0;
    
    // Total LP positions is the number of unique liquidity positions
    const totalLpPositions = $poolStore.userPoolBalances?.length || 0;
    
    // Total transactions in 24h is the sum of all swaps across all pools
    const totalTx24h = $poolStore.pools.reduce((acc, pool) => {
      const swaps = Number(pool.rolling_24h_num_swaps || 0);
      return acc + swaps;
    }, 0);
    
    return {
      totalUsers,
      totalLpPositions,
      totalTx24h
    };
  });

  const poolStats = derived(poolStore, ($poolStore) => {
    const totalPools = $poolStore.pools.length;
    
    // Calculate weighted average APY based on pool TVL
    const poolsWithApy = $poolStore.pools.filter(pool => 
      pool.rolling_24h_apy && pool.tvl && pool.rolling_24h_apy > 0 && pool.tvl > 0
    );
    
    const totalTvl = poolsWithApy.reduce((acc, pool) => acc + Number(pool.tvl || 0), 0);
    const weightedApySum = poolsWithApy.reduce((acc, pool) => {
      const weight = Number(pool.tvl || 0) / totalTvl;
      return acc + (pool.rolling_24h_apy * weight);
    }, 0);
    
    const averageApy = totalTvl > 0 ? weightedApySum : 0;

    // Calculate lifetime metrics
    const lifetimeVolume = $poolStore.pools.reduce((acc, pool) => 
      acc + Number(pool.total_volume || 0) / 1e8, 0);
    
    const lifetimeFees = $poolStore.pools.reduce((acc, pool) => 
      acc + Number(pool.total_lp_fee || 0) / 1e8, 0);
    
    return {
      totalPools,
      averageApy: formatToNonZeroDecimal(averageApy),
      lifetimeVolume: formatToNonZeroDecimal(lifetimeVolume),
      lifetimeFees: formatToNonZeroDecimal(lifetimeFees)
    };
  });

  // Function to copy text to clipboard
  function copyToClipboard(tokenId: string) {
    navigator.clipboard.writeText(tokenId).then(
      () => {
        updateCopyState(tokenId, "Copied!");
      },
      (err) => {
        updateCopyState(tokenId, "Copy Failed!");
      }
    );
  }

  // Update the copy state for a specific token
  function updateCopyState(tokenId: string, text: string) {
    copyStates.update(states => {
      return { ...states, [tokenId]: text };
    });
    setTimeout(() => {
      copyStates.update(states => {
        return { ...states, [tokenId]: "Copy" };
      });
    }, 1000);
  }

  const debouncedSearch = debounce((value: string) => {
    searchQuery.set(value);
  }, 300);

  let sortedAndFilteredPools = derived(poolStore, ($poolStore) => {
    return [...$poolStore.pools].sort((a, b) => {
      const tvlA = Number(a.tvl || 0n);
      const tvlB = Number(b.tvl || 0n);
      return tvlB - tvlA; // Sort by TVL in descending order
    });
  });

  const poolsLoading = derived(poolStore, $store => $store.isLoading);
  const poolsError = derived(poolStore, $store => $store.error);
</script>

<Clouds />

<div class="stats-container">
  
  <Panel variant="green" type="main" className="market-stats-panel">
    <div class="market-stats-grid">
      <div class="stat-card">
        <div class="stat-icon-wrapper">
          <DollarSign class="stat-icon" />
        </div>
        <div class="stat-content">
          <h3>Total Volume (24h)</h3>
          <p>${$marketStats.totalVolume}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrapper">
          <Droplets class="stat-icon" />
        </div>
        <div class="stat-content">
          <h3>Total Liquidity</h3>
          <p>${$marketStats.totalLiquidity}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrapper">
          <DollarSign class="stat-icon" />
        </div>
        <div class="stat-content">
          <h3>Total Fees (24h)</h3>
          <p>${$marketStats.totalFees}</p>
        </div>
      </div>
    </div>

  </Panel>
  <Panel variant="green" type="main" className="content-panel">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-white/80 font-medium">Tokens</h3>
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
        {$tokensError}
      </div>
    {:else}
      <div class="table-container">
        <table class="data-table">
          <TableHeader {tokensTableHeaders} bind:sortColumn={$sortColumnStore} bind:sortDirection={$sortDirectionStore} />
          <tbody>
            {#each $filteredSortedTokens as token (token.canister_id)}
              <tr animate:flip={{ duration: 300 }}>
                <td class="token-cell">
                  <TokenImages tokens={[token]} containerClass="token-image" />
                  <div class="token-info">
                    <span class="token-name">{token.name}</span>
                    <span class="token-symbol">{token.symbol}</span>
                  </div>
                  <button 
                    class="copy-button" 
                    on:click={() => copyToClipboard(token.canister_id)}
                  >
                    {$copyStates[token.canister_id] || "Copy"}
                  </button>
                </td>
                <td class="price-cell">
                  ${formatToNonZeroDecimal(token.price)}
                </td>
                <td class="volume-cell">
                  ${formatToNonZeroDecimal(token.volume24h)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Panel>
  <!-- New Stats Panels -->
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
            {#each Array(7) as _, i}
              <div class="bar" style="height: {30 + Math.random() * 40}%"></div>
            {/each}
          </div>
          <div class="chart-labels">
            {#each Array(7) as _, i}
              <div class="label">D-{6-i}</div>
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
            {#each Array(5) as _, i}
              <circle
                cx={i * 75}
                cy={40 + Math.random() * 20}
                r="3"
                class="chart-point"
              />
            {/each}
          </svg>
          <div class="chart-labels">
            {#each Array(5) as _, i}
              <div class="label">D-{4-i}</div>
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
          <span class="stat-value">{$userStats.totalUsers}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">LP Positions</span>
          <span class="stat-value">{$userStats.totalLpPositions}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">24h Transactions</span>
          <span class="stat-value">{$userStats.totalTx24h}</span>
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
          <span class="stat-value">${$poolStats.lifetimeVolume}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Lifetime Fees</span>
          <span class="stat-value">${$poolStats.lifetimeFees}</span>
        </div>
      </div>
    </Panel>


  </div>
</div>

<style lang="postcss">
  .stats-container {
    @apply flex flex-col gap-6 p-4 relative z-10;
  }

  .market-stats-grid {
    @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3;
  }

  .stat-card {
    @apply flex items-center gap-4 p-4 rounded-lg bg-white/5;
  }

  .stat-icon-wrapper {
    @apply p-3 rounded-lg bg-white/10;
  }

  .stat-content {
    @apply flex flex-col;
  }

  .stat-content h3 {
    @apply text-sm text-white/60;
  }

  .stat-content p {
    @apply text-xl font-medium text-white;
  }

  .panels-grid {
    @apply grid gap-6;
  }

  .stats-panel {
    @apply p-6;
  }

  .panel-title {
    @apply text-lg font-medium text-white/80 mb-4;
  }

  .stats-grid {
    @apply grid grid-cols-2 md:grid-cols-4 gap-4;
  }

  .stat-item {
    @apply flex flex-col gap-1 p-4 rounded-lg bg-white/5;
  }

  .stat-label {
    @apply text-sm text-white/60;
  }

  .stat-value {
    @apply text-lg font-medium text-white;
  }

  .content-panel {
    @apply p-6;
  }

  .search-container {
    @apply relative;
  }

  .search-input {
    @apply w-64 px-4 py-2 rounded-lg bg-white/5 text-white placeholder-white/40
           border border-white/10 focus:border-white/20 focus:outline-none;
  }

  .table-container {
    @apply overflow-x-auto;
  }

  .data-table {
    @apply w-full;
  }

  .token-cell {
    @apply flex items-center gap-3;
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

  .copy-button {
    @apply ml-auto px-2 py-1 text-xs rounded bg-white/5 text-white/60
           hover:bg-white/10 hover:text-white transition-all duration-200;
  }

  .price-cell, .volume-cell {
    @apply text-right text-white font-medium;
  }

  .error-message {
    @apply text-red-400 text-center p-4;
  }

  .charts-grid {
    @apply grid grid-cols-1 md:grid-cols-2 gap-6;
  }

  .chart-panel {
    @apply p-6;
  }

  .chart-header {
    @apply flex justify-between items-center mb-4;
  }

  .chart-icon {
    @apply w-5 h-5 text-white/60;
  }

  .chart-placeholder {
    @apply h-48 flex flex-col;
  }

  .chart-bars {
    @apply flex-1 flex items-end justify-between gap-2 px-4;
  }

  .bar {
    @apply w-8 bg-gradient-to-t from-emerald-500/50 to-emerald-300/50 rounded-t-md transition-all duration-300 hover:from-emerald-500/70 hover:to-emerald-300/70;
  }

  .chart-labels {
    @apply flex justify-between px-4 py-2;
  }

  .label {
    @apply text-xs text-white/40;
  }

  .line-chart {
    @apply flex-1 text-emerald-400/50;
  }

  .chart-line {
    @apply transition-all duration-300;
  }

  .chart-point {
    @apply fill-emerald-400/50 transition-all duration-300;
  }

  .chart-panel:hover {
    .chart-line {
      @apply text-emerald-400/70;
    }
    .chart-point {
      @apply fill-emerald-400/70;
    }
  }

  .token-stats-grid {
    @apply grid grid-cols-2 gap-4;
  }

  .mini-stat-card {
    @apply flex flex-col gap-1 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors;
  }

  .stat-label {
    @apply text-sm text-white/60;
  }

  .stat-value {
    @apply text-lg font-medium text-white;
  }
</style>
