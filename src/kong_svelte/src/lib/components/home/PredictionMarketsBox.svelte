<script lang="ts">
  import { Brain, ChevronDown } from "lucide-svelte";
  import { getPredictionMarketStats, getAllMarkets } from "$lib/api/predictionMarket";
  import { onMount } from "svelte";
  import Card from "$lib/components/common/Card.svelte";
    import { formatBalance } from "$lib/utils/numberFormatUtils";
    import { userTokens } from "$lib/stores/userTokens";
    import TokenImages from "../common/TokenImages.svelte";

  let predictionStats = $state<{
    total_markets: bigint;
    total_bets: bigint;
    total_active_markets: bigint;
  } | null>(null);

  let recentMarkets = $state<any[]>([]);
  let isLoadingStats = $state(true);


  async function loadStats() {
    try {
      const [predictionData, marketsData] = await Promise.all([
        getPredictionMarketStats(),
        getAllMarkets({ 
          start: 0, 
          length: 3, 
          statusFilter: "Active", 
          sortOption: { type: "CreatedAt", direction: "Descending" } 
        }),
      ]);
      
      predictionStats = predictionData;
      
      if (marketsData && Array.isArray(marketsData) && marketsData.length > 0) {
        recentMarkets = marketsData;
      } else if (marketsData && marketsData.markets && Array.isArray(marketsData.markets)) {
        recentMarkets = marketsData.markets;
      }
      console.log(recentMarkets)
    } catch (error) {
      console.error("Error loading prediction market stats:", error);
    } finally {
      isLoadingStats = false;
    }
  }

  onMount(() => {
    loadStats();
  });
</script>

<Card
  className="md:col-span-2 lg:row-span-3 group relative"
  isPadded={true}
>
  <!-- Subtle gradient background -->
  <div class="absolute inset-0 overflow-hidden">
    <!-- Main gradient -->
    <div class="absolute inset-0 bg-gradient-to-br from-transparent via-kong-secondary/[0.00] to-kong-secondary/[0.02]"></div>
    
    <!-- Hover effect with enhanced gradient -->
    <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
      <!-- Enhanced gradient on hover -->
      <div class="absolute inset-0 bg-gradient-to-br from-kong-secondary/5 via-transparent to-kong-transparent"></div>
    </div>
    
  </div>

  <div class="relative z-10 h-full flex flex-col">
    <div class="flex items-start justify-between mb-4 sm:mb-6">
      <div>
        <h3 class="text-xl sm:text-2xl font-bold text-kong-text-primary mb-1 sm:mb-2">
          Prediction Markets
        </h3>
        <p class="text-kong-text-secondary text-sm sm:text-base">
          Trade on future outcomes
        </p>
      </div>
      <div
        class="p-2 sm:p-3 bg-kong-secondary/10 rounded-xl group-hover:bg-kong-secondary/20 transition-colors"
      >
        <Brain class="w-5 h-5 sm:w-6 sm:h-6 text-kong-secondary" />
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
      <div>
        {#if isLoadingStats}
          <div
            class="h-6 sm:h-8 w-16 sm:w-20 bg-kong-bg-tertiary rounded animate-pulse mb-1"
          ></div>
        {:else}
          <span class="text-xl sm:text-3xl font-bold text-kong-text-primary"
            >{predictionStats?.total_markets || 0}</span
          >
        {/if}
        <p class="text-xs sm:text-sm text-kong-text-secondary mt-0.5 sm:mt-1">Total Markets</p>
      </div>
      <div>
        {#if isLoadingStats}
          <div
            class="h-6 sm:h-8 w-16 sm:w-20 bg-kong-bg-tertiary rounded animate-pulse mb-1"
          ></div>
        {:else}
          <span class="text-xl sm:text-3xl font-bold text-kong-secondary"
            >{predictionStats?.total_active_markets || 0}</span
          >
        {/if}
        <p class="text-xs sm:text-sm text-kong-text-secondary mt-0.5 sm:mt-1">Active Now</p>
      </div>
      <div>
        {#if isLoadingStats}
          <div
            class="h-6 sm:h-8 w-16 sm:w-20 bg-kong-bg-tertiary rounded animate-pulse mb-1"
          ></div>
        {:else}
          <span class="text-xl sm:text-3xl font-bold text-kong-text-primary"
            >{predictionStats?.total_bets || 0}</span
          >
        {/if}
        <p class="text-xs sm:text-sm text-kong-text-secondary mt-0.5 sm:mt-1">Predictions</p>
      </div>
    </div>

    <!-- Recent Markets Section -->
    <div class="flex-1 flex flex-col min-h-0">
      <h4 class="text-xs sm:text-sm font-medium text-kong-text-primary mb-2 sm:mb-3">Recent Markets</h4>
      <div class="flex-1 space-y-2 sm:space-y-3 overflow-y-auto">
        {#if isLoadingStats}
          <!-- Loading skeleton for recent markets -->
          {#each Array(3) as _}
            <div class="p-2 sm:p-3 bg-kong-bg-tertiary/20 rounded-lg">
              <div class="h-3 sm:h-4 w-3/4 bg-kong-bg-tertiary rounded animate-pulse mb-1.5 sm:mb-2"></div>
              <div class="flex justify-between items-center">
                <div class="h-2.5 sm:h-3 w-14 sm:w-16 bg-kong-bg-tertiary rounded animate-pulse"></div>
                <div class="h-2.5 sm:h-3 w-10 sm:w-12 bg-kong-bg-tertiary rounded animate-pulse"></div>
              </div>
            </div>
          {/each}
        {:else}
          <!-- Real recent markets -->
          {#if recentMarkets && recentMarkets.length > 0}
            {#each recentMarkets as market}
            {@const token = $userTokens.tokens.find(t => t.address === market.token_id)}
              <a href="/predict/{market.id}" class="block p-2 sm:p-3 bg-kong-bg-tertiary/20 rounded-lg hover:bg-kong-bg-tertiary/30 transition-colors cursor-pointer">
                <p class="text-xs sm:text-sm text-kong-text-primary font-medium mb-2 line-clamp-2">{market.question}</p>
                
                <!-- Pool size display -->
                <div class="flex justify-between items-center">
                  <div class="text-[10px] sm:text-xs text-kong-text-secondary inline-flex items-center gap-1">
                    <span class="mr-1">Pool:</span> <TokenImages tokens={[token]} size={16} /> {(market.total_pool && token?.decimals !== undefined ? formatBalance(market.total_pool, token.decimals) : market.total_pool ? market.total_pool : '0.00')}
                  </div>
                  
                  <!-- End date -->
                  <div class="text-[10px] sm:text-xs text-kong-text-secondary">
                    {#if market.end_time}
                      Ends {new Date(Number(market.end_time) / 1000000).toLocaleDateString()}
                    {:else}
                      Active
                    {/if}
                  </div>
                </div>
              </a>
            {/each}
          {:else}
            <div class="p-2 sm:p-3 bg-kong-bg-tertiary/20 rounded-lg">
              <p class="text-xs sm:text-sm text-kong-text-secondary text-center">No recent markets available</p>
            </div>
          {/if}
        {/if}
      </div>
    </div>

    <div class="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-kong-border/20">
      <a
        href="/predict"
        class="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-kong-secondary hover:text-purple-300 transition-colors"
      >
        <span>Explore All Markets</span>
        <ChevronDown class="w-3 h-3 sm:w-4 sm:h-4 rotate-[-90deg]" />
      </a>
    </div>
  </div>
</Card> 