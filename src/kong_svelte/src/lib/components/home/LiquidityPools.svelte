<script lang="ts">
  import { Droplets, ChevronDown } from "lucide-svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import Card from "$lib/components/common/Card.svelte";
    import { goto } from "$app/navigation";

  interface Props {
    poolStats: {
      total_volume_24h: number;
      total_tvl: number;
      total_fees_24h: number;
    };
    poolCount: number;
    isLoadingStats: boolean;
  }

  let { poolStats, poolCount, isLoadingStats }: Props = $props();
</script>

<Card
  className="md:col-span-2 group relative"
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
      <!-- Dot pattern overlay -->
      <div class="absolute inset-0 opacity-10" 
           style="background-image: radial-gradient(circle, rgb(var(--brand-primary)) 1px, transparent 1px); background-size: 16px 16px;">
      </div>
    </div>
    
  </div>

  <div class="relative z-10">
    <div class="flex items-start justify-between mb-4 sm:mb-6">
      <div>
        <h3 class="text-lg sm:text-xl md:text-2xl font-bold text-kong-text-primary mb-1 sm:mb-2">
          Liquidity Pools
        </h3>
        <p class="text-kong-text-secondary text-sm sm:text-base">
          Provide liquidity, earn trading fees
        </p>
      </div>
      <div
        class="p-2 sm:p-2.5 md:p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors"
      >
        <Droplets class="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
      <div class="text-center">
        <span class="text-lg sm:text-2xl md:text-3xl font-bold text-kong-text-primary block">
          {#if isLoadingStats}
            <div class="h-6 sm:h-8 md:h-9 w-12 sm:w-14 md:w-16 bg-kong-bg-tertiary rounded animate-pulse mx-auto"></div>
          {:else}
            {poolCount}
          {/if}
        </span>
        <p class="text-xs sm:text-sm text-kong-text-secondary mt-0.5 sm:mt-1">Active Pools</p>
      </div>
      <div class="text-center">
        <span class="text-lg sm:text-2xl md:text-3xl font-bold text-kong-text-primary block">
          {#if isLoadingStats}
            <div class="h-6 sm:h-8 md:h-9 w-16 sm:w-20 md:w-24 bg-kong-bg-tertiary rounded animate-pulse mx-auto"></div>
          {:else}
            {formatUsdValue(poolStats.total_tvl)}
          {/if}
        </span>
        <p class="text-xs sm:text-sm text-kong-text-secondary mt-0.5 sm:mt-1">Total Value Locked</p>
      </div>
      <div class="text-center col-span-2 sm:col-span-1">
        <span class="text-lg sm:text-2xl md:text-3xl font-bold text-kong-text-primary block">0.3%</span>
        <p class="text-xs sm:text-sm text-kong-text-secondary mt-0.5 sm:mt-1">
          LP Fees
        </p>
      </div>
    </div>

    <div class="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-kong-border/20 text-right">
      <div
        onclick={() => {
          goto("/pools");
        }}
        class="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-kong-text-secondary hover:text-kong-primary transition-colors cursor-pointer"
      >
        <span>Explore All Pools</span>
        <ChevronDown class="w-3 h-3 sm:w-4 sm:h-4 rotate-[-90deg]" />
      </div>
    </div>
  </div>
</Card>