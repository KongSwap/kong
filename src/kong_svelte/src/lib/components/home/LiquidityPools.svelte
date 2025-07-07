<script lang="ts">
  import { Droplets, Users, Coins } from "lucide-svelte";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import Card from "$lib/components/common/Card.svelte";

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
>
  <!-- Subtle gradient background -->
  <div class="absolute inset-0 overflow-hidden">
    <!-- Main gradient -->
    <div class="absolute inset-0 bg-gradient-to-br from-transparent via-blue-500/[0.02] to-blue-500/[0.05]"></div>
    
    <!-- Hover effect with enhanced gradient -->
    <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
      <!-- Enhanced gradient on hover -->
      <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-blue-400/10"></div>
      <!-- Dot pattern overlay -->
      <div class="absolute inset-0 opacity-10" 
           style="background-image: radial-gradient(circle, rgb(59 130 246) 1px, transparent 1px); background-size: 16px 16px;">
      </div>
    </div>
    
  </div>

  <div class="relative z-10">
    <div class="flex items-start justify-between mb-6">
      <div>
        <h3 class="text-2xl font-bold text-kong-text-primary mb-2">
          Liquidity Pools
        </h3>
        <p class="text-kong-text-secondary text-base">
          Provide liquidity, earn trading fees
        </p>
      </div>
      <div
        class="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors"
      >
        <Droplets class="w-6 h-6 text-blue-500" />
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div class="text-center">
        <span class="text-3xl font-bold text-kong-text-primary">
          {#if isLoadingStats}
            <div class="h-9 w-16 bg-kong-bg-tertiary rounded animate-pulse mx-auto"></div>
          {:else}
            {poolCount}
          {/if}
        </span>
        <p class="text-sm text-kong-text-secondary mt-1">Active Pools</p>
      </div>
      <div class="text-center">
        <span class="text-3xl font-bold text-kong-text-primary">
          {#if isLoadingStats}
            <div class="h-9 w-24 bg-kong-bg-tertiary rounded animate-pulse mx-auto"></div>
          {:else}
            {formatUsdValue(poolStats.total_tvl)}
          {/if}
        </span>
        <p class="text-sm text-kong-text-secondary mt-1">Total Value Locked</p>
      </div>
      <div class="text-center">
        <span class="text-3xl font-bold text-kong-text-primary">0.3%</span>
        <p class="text-sm text-kong-text-secondary mt-1">
          LP Fees
        </p>
      </div>
    </div>

    <div class="mt-6 pt-6 border-t border-kong-border/20">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <Users class="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p class="text-sm font-medium text-kong-text-primary">Earn passive income</p>
            <p class="text-xs text-kong-text-secondary">From every trade in your pool</p>
          </div>
        </div>
        <a
          href="/pools"
          class="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg text-sm text-blue-500 hover:text-blue-400 transition-colors border border-blue-500/20"
        >
          <Coins class="w-4 h-4" />
          <span>View Pools</span>
        </a>
      </div>
    </div>
  </div>
</Card>