<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import LoadingEllipsis from "$lib/components/common/LoadingEllipsis.svelte";
  import type { PortfolioHistory } from "$lib/utils/portfolio/portfolioHistory";
  import { WalletDataService, walletDataStore } from "$lib/services/wallet";
  import { getPortfolioHistory } from "$lib/utils/portfolio/portfolioHistory";
  import { calculatePerformanceMetrics } from "$lib/utils/portfolio/performanceMetrics";
  import { walletPoolListStore } from "$lib/stores/walletPoolListStore";

  let { isLoading, error, principal } = $props<{
    isLoading: boolean;
    error: string | null;
    principal: string;
  }>();
  
  let portfolioHistory = $state<PortfolioHistory[]>([]);
  let performanceMetrics = $state({
    dailyChange: 0,
    bestPerformer: { symbol: "", change: 0 }
  });

  // Get wallet data from the store
  let walletData = $derived($walletDataStore);
  
  // Subscribe to the pool list store
  let poolsData = $state({
    processedPools: [],
    loading: false,
    walletId: null
  });
  
  // Subscribe to the pool list store
  walletPoolListStore.subscribe(value => {
    poolsData = value;
  });

  // Augment isLoading to include both stores' loading states
  let isDataLoading = $derived(isLoading || walletData.isLoading || poolsData.loading);

  // Calculate token balances value
  let tokenValue = $derived(Object.values(walletData.balances)
    .reduce((total, balance) => total + Number(balance.in_usd), 0));
    
  // Calculate liquidity pool value
  let lpValue = $derived(poolsData.processedPools
    .reduce((total, pool) => total + Number(pool.usd_balance || 0), 0));
    
  // Calculate total portfolio value (tokens + liquidity pools)
  let portfolioValue = $derived((tokenValue + lpValue).toFixed(2));

  // Calculate 24hr PnL
  let dailyPnL = $derived(portfolioHistory.length >= 2 
    ? portfolioHistory[portfolioHistory.length - 1].totalValue - portfolioHistory[0].totalValue
    : 0);

  // Load history when wallet changes or balances update
  $effect(() => {
    const balances = walletData.balances;
    if (principal && Object.keys(balances).length > 0) {
      loadHistory();
    }
  });
  
  // Ensure liquidity pools are loaded when principal changes
  $effect(() => {
    if (principal && !poolsData.loading && 
        (!poolsData.walletId || poolsData.walletId !== principal)) {
      walletPoolListStore.fetchPoolsForWallet(principal);
    }
  });

  async function loadHistory() {
    try {
      // Load history data
      const history = getPortfolioHistory(principal, 1);

      // Only update if we have valid history data
      if (history && history.length >= 2) {
        portfolioHistory = history;
        performanceMetrics = calculatePerformanceMetrics(
          history,
          walletData.tokens,
        );
      } else {
        // If no history, set default values
        portfolioHistory = [];
        performanceMetrics = {
          dailyChange: 0,
          bestPerformer: { symbol: "", change: 0 }
        };
      }
    } catch (err) {
      console.error("Failed to load portfolio history:", err);
      // Reset values on error
      portfolioHistory = [];
      performanceMetrics = {
        dailyChange: 0,
        bestPerformer: { symbol: "", change: 0 }
      };
    }
  }
</script>

<Panel variant="transparent">
  <div class="space-y-2">
    <div>
      <h2 class="text-sm uppercase font-medium text-kong-text-primary mb-2">
        Total Portfolio Value
      </h2>
      {#if error}
        <div class="text-kong-error">{error}</div>
      {:else if isDataLoading}
        <!-- Loading indicator for portfolio value with bouncing ellipsis -->
        <div class="text-4xl font-bold text-kong-text-primary flex items-center">
          $<LoadingEllipsis color="text-kong-text-primary" size="text-4xl" />
        </div>
        <div class="text-base font-bold flex items-center">
          <LoadingEllipsis color="text-kong-text-primary" size="text-base" />
        </div>
      {:else}
        <p class="text-4xl font-bold text-kong-text-primary">
          {Number(portfolioValue).toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
          })}
        </p>
        <div
          class:text-kong-success={performanceMetrics.dailyChange > 0}
          class:text-kong-error={performanceMetrics.dailyChange < 0}
          class="text-base font-bold flex"
        >
          {dailyPnL.toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
          })} &nbsp; ({performanceMetrics.dailyChange.toFixed(2)}%)
        </div>
      {/if}
    </div>
  </div>
</Panel>
