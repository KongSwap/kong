<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import type { PortfolioHistory } from "$lib/services/portfolio/portfolioHistory";
  import { userTokens } from "$lib/stores/userTokens";
  import { walletBalancesStore, currentWalletStore } from "$lib/stores/walletBalancesStore";
  import { getPortfolioHistory } from "$lib/services/portfolio/portfolioHistory";
  import { calculatePerformanceMetrics } from "$lib/services/portfolio/performanceMetrics";

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

  // Calculate total portfolio value
  let portfolioValue = $derived(Object.values($walletBalancesStore)
    .reduce((total, balance) => total + Number(balance.in_usd), 0)
    .toFixed(2));

  // Calculate 24hr PnL
  let dailyPnL = $derived(portfolioHistory.length >= 2 
    ? portfolioHistory[portfolioHistory.length - 1].totalValue - portfolioHistory[0].totalValue
    : 0);

  // Load history when wallet changes or balances update
  $effect(() => {
    const balances = $walletBalancesStore;
    if (principal && Object.keys(balances).length > 0) {
      loadHistory();
    }
  });

  async function loadHistory() {
    try {
      // Load history data
      const history = getPortfolioHistory(principal, 1);
      console.log('Portfolio history loaded:', history);

      // Only update if we have valid history data
      if (history && history.length >= 2) {
        portfolioHistory = history;
        performanceMetrics = calculatePerformanceMetrics(
          history,
          $userTokens.tokens,
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

{#if isLoading && Object.keys($walletBalancesStore).length === 0}
  <Panel variant="transparent" className="flex items-center justify-center min-h-[200px]">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-kong-primary"></div>
  </Panel>
{:else if error}
  <Panel variant="transparent">
    <div class="text-kong-accent-red">{error}</div>
  </Panel>
{:else}
  <Panel variant="transparent">
    <div class="space-y-2">
      <div>
        <h2 class="text-sm uppercase font-medium text-kong-text-primary mb-2">
          Total Portfolio Value
        </h2>
        <p class="text-4xl font-bold text-kong-text-primary">
          {Number(portfolioValue).toLocaleString(undefined, {
            style: "currency",
            currency: "USD",
          })}
        </p>
      </div>
      <div
        class:text-kong-text-accent-green={performanceMetrics.dailyChange > 0}
        class:text-kong-accent-red={performanceMetrics.dailyChange < 0}
        class="text-base font-bold flex"
      >
        {dailyPnL.toLocaleString(undefined, {
          style: "currency",
          currency: "USD",
        })} &nbsp; ({performanceMetrics.dailyChange.toFixed(2)}%)
      </div>
    </div>
  </Panel>
{/if}
