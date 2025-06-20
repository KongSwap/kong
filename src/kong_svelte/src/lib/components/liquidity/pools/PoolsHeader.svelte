<script lang="ts">
  import { goto } from "$app/navigation";
  import { TrendingUp, PiggyBank, Flame, Plus, Droplets } from "lucide-svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";

  interface PoolsHeaderProps {
    poolTotals: {
      total_volume_24h: number;
      total_tvl: number;
      total_fees_24h: number;
    };
    highestAPY: number;
  }

  let { poolTotals, highestAPY }: PoolsHeaderProps = $props();
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
              {formatUsdValue(poolTotals.total_volume_24h)}
            </div>
            <div class="text-sm text-kong-success font-medium">
              = {formatUsdValue(poolTotals.total_volume_24h * 0.003)} in fees
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
              {formatUsdValue(poolTotals.total_tvl)}
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
              <span class="text-xs text-kong-success uppercase tracking-wider font-semibold">Top APR</span>
            </div>
            <div class="text-2xl font-bold text-kong-success mb-1">
              {highestAPY.toFixed(2)}%
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
              onclick={() => goto('/pools/add')}
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