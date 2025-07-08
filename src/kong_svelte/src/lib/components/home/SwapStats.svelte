<script lang="ts">
  import { TrendingUp } from "lucide-svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import Card from "$lib/components/common/Card.svelte";

  interface Props {
    poolStats: {
      total_volume_24h: number;
      total_tvl: number;
      total_fees_24h: number;
    };
    isLoadingStats: boolean;
  }

  let { poolStats, isLoadingStats }: Props = $props();
</script>

<Card 
  className="md:col-span-2 lg:col-span-2 h-auto md:h-[200px] lg:h-[220px] relative group"
  isPadded={true}
>
  <!-- Subtle gradient background -->
  <div class="absolute inset-0 overflow-hidden">
    <!-- Main gradient -->
    <div class="absolute inset-0 bg-gradient-to-br from-transparent via-kong-primary/[0.02] to-kong-primary/[0.05]"></div>
    
    <!-- Hover effect with enhanced gradient -->
    <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
      <!-- Enhanced gradient on hover -->
      <div class="absolute inset-0 bg-gradient-to-br from-kong-primary/10 via-transparent to-kong-secondary/10"></div>
      <!-- Dot pattern overlay -->
      <div class="absolute inset-0 opacity-10" 
           style="background-image: radial-gradient(circle, rgb(var(--brand-primary)) 1px, transparent 1px); background-size: 16px 16px;">
      </div>
    </div>
  </div>

  <div class="relative z-10 h-full flex flex-col">
    <div class="flex items-start justify-between mb-3 sm:mb-4">
      <div>
        <h3 class="text-xl sm:text-2xl md:text-3xl font-bold text-kong-text-primary mb-1 sm:mb-2">
          Swap Stats
        </h3>
        <p class="text-kong-text-secondary text-xs sm:text-sm md:text-base">
          Across all trading pairs
        </p>
      </div>
      <div
        class="p-2 sm:p-2.5 md:p-3 bg-kong-primary/10 rounded-lg sm:rounded-xl group-hover:bg-kong-primary/20 transition-colors"
      >
        <TrendingUp class="w-4 h-4 sm:w-5 sm:h-5 md:w-8 md:h-8 text-kong-primary" />
      </div>
    </div>

    <div class="flex-1">
      {#if isLoadingStats}
        <div class="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          <div class="space-y-1 sm:space-y-2">
            <div class="h-3 sm:h-4 w-16 sm:w-20 md:w-24 bg-kong-bg-tertiary rounded animate-pulse"></div>
            <div class="h-8 sm:h-10 md:h-12 w-24 sm:w-32 md:w-48 bg-kong-bg-tertiary rounded animate-pulse"></div>
          </div>
          <div class="space-y-1 sm:space-y-2">
            <div class="h-3 sm:h-4 w-16 sm:w-20 md:w-24 bg-kong-bg-tertiary rounded animate-pulse"></div>
            <div class="h-8 sm:h-10 md:h-12 w-20 sm:w-28 md:w-32 bg-kong-bg-tertiary rounded animate-pulse"></div>
          </div>
        </div>
      {:else}
        <div class="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          <!-- Volume -->
          <div class="space-y-1 sm:space-y-2">
            <p class="text-kong-text-secondary text-[10px] sm:text-xs md:text-sm uppercase tracking-wider">24h Volume</p>
            <div class="flex items-baseline">
              <span class="text-xl sm:text-2xl md:text-4xl font-bold text-kong-text-primary break-all"
                >{formatUsdValue(poolStats.total_volume_24h)}</span
              >
            </div>
          </div>
          
          <!-- Fees -->
          <div class="space-y-1 sm:space-y-2">
            <p class="text-kong-text-secondary text-[10px] sm:text-xs md:text-sm uppercase tracking-wider">24h Fees</p>
            <div class="flex items-baseline">
              <span class="text-xl sm:text-2xl md:text-4xl font-bold text-kong-text-primary break-all"
                >{formatUsdValue(poolStats.total_fees_24h)}</span
              >
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</Card>