<script lang="ts">
  import { Zap, Activity, TrendingUp } from "lucide-svelte";
  import Card from "$lib/components/common/Card.svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { onMount } from "svelte";
  
  interface Props {
    poolStats?: {
      total_volume_24h: number;
      total_tvl: number;
      total_fees_24h: number;
    };
    isLoadingStats?: boolean;
  }
  
  let { poolStats, isLoadingStats = false }: Props = $props();
  
  let swapTime = $state(2.5);
  let isAnimating = $state(false);
  
  // Simulate real-time swap time updates
  onMount(() => {
    const interval = setInterval(() => {
      swapTime = 2.5; // Random between 1.8-2.4
      isAnimating = true;
      setTimeout(() => isAnimating = false, 300);
    }, 5000);
    
    return () => clearInterval(interval);
  });
</script>

<Card
  className="group relative overflow-hidden"
  isPadded={true}
  isTransparent={true}
>
  <!-- Subtle gradient background -->
  <div class="absolute inset-0 overflow-hidden">
    <!-- Main gradient -->
    <div class="absolute inset-0 bg-gradient-to-br from-transparent via-kong-primary/[0.02] to-kong-primary/[0.05]"></div>
    
    <!-- Hover effect with enhanced gradient -->
    <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
      <!-- Enhanced gradient on hover -->
      <div class="absolute inset-0 bg-gradient-to-br from-kong-primary/10 via-transparent to-kong-secondary/10"></div>
    </div>
  </div>

  <div class="relative z-10 h-full flex flex-col justify-between">
    <div class="flex items-start justify-between mb-2 sm:mb-4">
      <div>
        <h3 class="text-base sm:text-xl font-semibold text-kong-text-primary mb-0.5 sm:mb-1">
          Lightning Fast
        </h3>
        <p class="text-xs sm:text-sm text-kong-text-secondary">
          Execute swaps in seconds
        </p>
      </div>
      <div class="p-1.5 sm:p-2.5 bg-kong-primary/10 rounded-lg sm:rounded-xl group-hover:bg-kong-primary/20 transition-colors">
        <Zap class="w-4 h-4 sm:w-6 sm:h-6 text-kong-primary" />
      </div>
    </div>

      <!-- Main metric display -->
      <div class="bg-kong-bg-tertiary rounded-lg px-3 py-2 sm:p-4 min-h-[60px] sm:min-h-[80px] flex items-center justify-center">
        <div class="flex items-center gap-4">
          <div class="text-center">
            <span class="text-3xl sm:text-4xl font-bold text-kong-text-primary transition-all duration-300 {isAnimating ? 'scale-105' : ''}">
              {swapTime.toFixed(1)}s
            </span>
            <span class="text-xs sm:text-sm text-kong-text-secondary block mt-0.5 sm:mt-1">Average swap time</span>
          </div>
        </div>
      </div>
      
      <!-- Stats -->
      <div class="grid grid-cols-2 gap-1.5 sm:gap-2">
        <div class="text-center p-1.5 sm:p-2 bg-kong-bg-tertiary/10 rounded-md sm:rounded-lg">
          <div class="flex items-center justify-center gap-0.5 sm:gap-1">
            <TrendingUp class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-kong-success" />
            <span class="text-base sm:text-xl font-bold text-kong-success">99.9%</span>
          </div>
          <span class="text-[10px] sm:text-xs text-kong-text-secondary block">Success rate</span>
        </div>
        <div class="text-center p-1.5 sm:p-2 bg-kong-bg-tertiary/10 rounded-md sm:rounded-lg">
          {#if isLoadingStats}
            <div class="h-5 sm:h-6 w-16 sm:w-20 bg-kong-bg-tertiary rounded animate-pulse mx-auto mb-0.5"></div>
          {:else}
            <span class="text-base sm:text-xl font-bold text-kong-warning">{formatUsdValue(poolStats?.total_tvl || 0)}</span>
          {/if}
          <span class="text-[10px] sm:text-xs text-kong-text-secondary block">Liquidity</span>
        </div>
    </div>
  </div>
</Card>