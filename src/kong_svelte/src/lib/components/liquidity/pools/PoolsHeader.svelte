<script lang="ts">
  import { goto } from "$app/navigation";
  import { TrendingUp, PiggyBank, Flame, Plus, Droplets } from "lucide-svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { fetchPoolTotals, fetchPools } from "$lib/api/pools";
  import { onMount, onDestroy } from "svelte";

  const DEFAULT_POOL_URL = "/pools/ryjl3-tyaaa-aaaaa-aaaba-cai_cngnf-vqaaa-aaaar-qag4q-cai"

  // Internal state for fetched data
  let poolTotals = $state({
    total_volume_24h: 0,
    total_tvl: 0,
    total_fees_24h: 0,
  });
  let highestAPY = $state(0);
  let isLoading = $state(true);
  let refreshInterval: NodeJS.Timeout | null = null;

  // Function to fetch data
  async function fetchData() {
    try {
      // Fetch pool totals
      const totalsResult = await fetchPoolTotals();
      poolTotals = totalsResult;

      // Fetch first page of pools to calculate highest APY
      const poolsResult = await fetchPools({ page: 1, limit: 100 });
      if (poolsResult.pools && poolsResult.pools.length > 0) {
        highestAPY = Math.max(...poolsResult.pools.map((p) => Number(p.rolling_24h_apy)), 0);
      }
    } catch (error) {
      console.error("Error fetching pool header data:", error);
    } finally {
      isLoading = false;
    }
  }

  // Fetch data on mount and set up refresh interval
  onMount(() => {
    fetchData();
    
    // Refresh data every 30 seconds
    refreshInterval = setInterval(fetchData, 30000);
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
</script>

<div class="px-4">
  <div class="sm:w-3/4 mx-auto overflow-hidden relative">
    <div class="relative z-10 md:pb-4">
      <div class="max-w-7xl mx-auto">
        <!-- Main headline -->
        <div class="text-center mb-4">
          <h1 class="text-4xl md:text-4xl font-bold text-kong-text-primary mb-4">
            Keep <span
              class="text-transparent font-black bg-clip-text bg-gradient-to-r from-kong-primary to-kong-accent-blue animate-shine"
              >100%</span
            > of Liquidity Fees
          </h1>
          <p class="text-lg md:text-base text-kong-text-secondary !max-w-xl mx-auto">
            Provide liquidity and keep every penny. No protocol fees. Auto-compounding.
            <span class="text-kong-text-primary font-semibold"
              >Pure yield for your wallet.</span
            >
          </p>
        </div>

        <!-- Stats showcase -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-xl mx-auto">
          <!-- Total Volume -->
          <div
            class="bg-kong-bg-secondary {$panelRoundness} px-5 py-3.5 border border-kong-border/50 hover:border-kong-primary/50 transition-all duration-300 group"
          >
            <div class="flex items-center justify-between mb-2">
              <TrendingUp class="w-7 h-7 text-kong-primary group-hover:animate-bounce" />
              <span class="text-xs text-kong-text-secondary uppercase tracking-wider">24H Volume</span>
            </div>
            <div class="text-2xl font-bold text-kong-text-primary mb-1">
              {#if isLoading}
                <div class="h-8 w-32 bg-kong-bg-light rounded animate-pulse"></div>
              {:else}
                {formatUsdValue(poolTotals.total_volume_24h)}
              {/if}
            </div>
            <div class="text-sm text-kong-success font-medium">
              {#if isLoading}
                <div class="h-5 w-24 bg-kong-bg-light rounded animate-pulse"></div>
              {:else}
                = {formatUsdValue(poolTotals.total_volume_24h * 0.003)} in fees
              {/if}
            </div>
          </div>

          <!-- Total TVL -->
          <div
            class="bg-kong-bg-secondary {$panelRoundness} px-5 py-3.5 border border-kong-border/50 hover:border-kong-accent-blue/50 transition-all duration-300 group"
          >
            <div class="flex items-center justify-between mb-2">
              <PiggyBank class="w-7 h-7 text-kong-accent-blue group-hover:animate-bounce" />
              <span class="text-xs text-kong-text-secondary uppercase tracking-wider">Total Locked</span>
            </div>
            <div class="text-2xl font-bold text-kong-text-primary mb-1">
              {#if isLoading}
                <div class="h-8 w-32 bg-kong-bg-light rounded animate-pulse"></div>
              {:else}
                {formatUsdValue(poolTotals.total_tvl)}
              {/if}
            </div>
            <div class="text-sm text-kong-text-secondary">
              Earning fees 24/7
            </div>
          </div>

          <!-- Highest APY -->
          <div
            class="bg-kong-bg-secondary bg-gradient-to-br from-kong-success/10 to-kong-bg-primary/50 {$panelRoundness} px-5 py-3.5 border border-kong-success/30 hover:border-kong-success/50 transition-all duration-300 group"
          >
            <div class="flex items-center justify-between mb-2">
              <Flame class="w-7 h-7 text-kong-success group-hover:animate-pulse" />
              <span class="text-xs text-kong-success uppercase tracking-wider font-semibold">Top APY</span>
            </div>
            <div class="text-2xl font-bold text-kong-success mb-1">
              {#if isLoading}
                <div class="h-8 w-24 bg-kong-success/20 rounded animate-pulse"></div>
              {:else}
                {highestAPY.toFixed(2)}%
              {/if}
            </div>
            <div class="text-sm text-kong-text-secondary">
              Best performing pool
            </div>
          </div>
        </div>

        <!-- CTA section -->
        <div class="mt-8 text-center">
          <div class="flex items-center justify-center gap-4 text-sm text-kong-text-secondary">
            <div class="flex items-center gap-1">
              <Droplets class="w-4 h-4 text-kong-primary" />
              <span>200+ Active Pools</span>
            </div>  
            <div class="hidden sm:block w-px h-4 bg-kong-border"></div>
            <div class="flex items-center gap-1">
              <span class="text-kong-success">●</span>
              <span>0.3% Swap Fee</span>
            </div>
            <div class="hidden sm:block w-px h-4 bg-kong-border"></div>
            <button
              onclick={() => goto(DEFAULT_POOL_URL)}
              class="flex items-center gap-1.5 px-3 py-1.5 text-base bg-kong-primary/10 hover:bg-kong-primary/20 text-kong-primary rounded-lg transition-all duration-200"
            >
              <Plus class="w-4 h-4" />
              <span class="font-medium">Add Liquidity</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>