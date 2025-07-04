<script lang="ts">
  import Swap from "$lib/components/swap/Swap.svelte";
  import { themeStore } from "$lib/stores/themeStore";
  import {
    ChevronDown,
    TrendingUp,
    Lock,
    Zap,
    Activity,
    DollarSign,
    Globe,
    Brain,
    Vote,
  } from "lucide-svelte";
  import { fetchPoolTotals } from "$lib/api/pools";
  import { onMount } from "svelte";
  import { leaderboardStore } from "$lib/stores/leaderboardStore";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { getPredictionMarketStats, getAllMarkets } from "$lib/api/predictionMarket";
  import { fetchTokensByCanisterId } from "$lib/api/tokens/TokenApiClient";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

  let poolStats = $state<{
    total_volume_24h: number;
    total_tvl: number;
    total_fees_24h: number;
  }>({ total_volume_24h: 0, total_tvl: 0, total_fees_24h: 0 });

  let predictionStats = $state<{
    total_markets: bigint;
    total_bets: bigint;
    total_active_markets: bigint;
  } | null>(null);

  let kongToken = $state<Kong.Token | null>(null);
  let recentMarkets = $state<any[]>([]);

  let isLoadingStats = $state(true);

  function scrollToExplore() {
    document
      .getElementById("explore-section")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async function loadStats() {
    try {
      const [poolData, predictionData, kongData, marketsData] = await Promise.all([
        fetchPoolTotals(),
        getPredictionMarketStats(),
        fetchTokensByCanisterId([KONG_CANISTER_ID]),
        getAllMarkets({ 
          start: 0, 
          length: 3, 
          statusFilter: "Active", 
          sortOption: { type: "CreatedAt", direction: "Descending" } 
        }),
        leaderboardStore.loadLeaderboard("day"),
      ]);
      poolStats = poolData;
      predictionStats = predictionData;
      if (kongData && kongData.length > 0) {
        kongToken = kongData[0];
      }
      if (marketsData && Array.isArray(marketsData) && marketsData.length > 0) {
        recentMarkets = marketsData;
      } else if (marketsData && marketsData.markets && Array.isArray(marketsData.markets)) {
        recentMarkets = marketsData.markets;
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      isLoadingStats = false;
    }
  }

  onMount(() => {
    loadStats();
  });
</script>

<section class="relative h-[calc(100vh-100px)] flex flex-col">
  <!-- Swap Section with Explore Button -->
  <div class="flex-1 w-full flex flex-col">
    <div
      class="flex-1 w-full flex flex-col items-center p-2 md:p-0 mt-12 transition-all duration-200"
    >
      <Swap />
    </div>
    <!-- Explore Button -->
    <div class="w-full bg-gradient-to-t from-kong-bg-primary via-kong-bg-primary/80 to-transparent">
      <button onclick={scrollToExplore} class="w-full hover:bg-kong-bg-primary/20 transition-all duration-300 group">
        <span class="text-kong-text-secondary text-sm flex flex-col items-center justify-center gap-2 opacity-80 group-hover:opacity-100">
          Scroll to learn more
          <ChevronDown class="w-5 h-5 transition-transform group-hover:translate-y-1" />
        </span>
      </button>
    </div>
  </div>
</section>

<!-- Bento Boxes Section -->
<section
  id="explore-section"
  class="w-full px-4 py-24 bg-gradient-to-b from-kong-bg-primary to-kong-bg-secondary min-h-screen"
>
  <div class="max-w-7xl mx-auto">


    <!-- Bento Grid -->
    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-min"
    >
      <!-- Volume Box - Large -->
      <div
        class="md:col-span-2 lg:col-span-2 bg-gradient-to-br from-kong-bg-primary to-kong-bg-secondary
                    rounded-3xl p-6 border border-kong-border/50 hover:border-kong-primary/50
                    transition-all duration-300 group relative overflow-hidden"
      >
        <div
          class="absolute top-0 right-0 w-40 h-40 bg-kong-primary/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500"
        ></div>

        <div class="relative z-10 h-full flex flex-col">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-3xl font-bold text-kong-text-primary mb-2">
                Swap Stats
              </h3>
              <p class="text-kong-text-secondary text-base">
                Across all trading pairs
              </p>
            </div>
            <div
              class="p-3 bg-kong-primary/10 rounded-xl group-hover:bg-kong-primary/20 transition-colors"
            >
              <TrendingUp class="w-8 h-8 text-kong-primary" />
            </div>
          </div>

          <div class="flex-1">
            {#if isLoadingStats}
              <div class="grid grid-cols-2 gap-6">
                <div class="space-y-2">
                  <div class="h-4 w-24 bg-kong-bg-tertiary rounded animate-pulse"></div>
                  <div class="h-12 w-48 bg-kong-bg-tertiary rounded animate-pulse"></div>
                </div>
                <div class="space-y-2">
                  <div class="h-4 w-24 bg-kong-bg-tertiary rounded animate-pulse"></div>
                  <div class="h-12 w-32 bg-kong-bg-tertiary rounded animate-pulse"></div>
                </div>
              </div>
            {:else}
              <div class="grid grid-cols-2 gap-6">
              <!-- Volume -->
              <div class="space-y-2">
                <p class="text-kong-text-secondary text-sm uppercase tracking-wider">24h Volume</p>
                <div class="flex items-baseline gap-4">
                  <span class="text-4xl font-bold text-kong-text-primary"
                    >{formatUsdValue(poolStats.total_volume_24h)}</span
                  >
                  <span class="text-kong-success text-lg font-medium">+12.5%</span>
                </div>
              </div>
              
              <!-- Fees -->
              <div class="space-y-2">
                <p class="text-kong-text-secondary text-sm uppercase tracking-wider">24h Fees</p>
                <div class="flex items-baseline gap-4">
                  <span class="text-4xl font-bold text-kong-text-primary"
                    >{formatUsdValue(poolStats.total_fees_24h)}</span
                  >
                </div>
              </div>
            </div>
          {/if}
          </div>
        </div>
      </div>

      <!-- Kong Token & DAO Box -->
      <div
        class="md:col-span-2 lg:col-span-2 lg:row-span-2 bg-gradient-to-br from-kong-bg-primary to-kong-bg-secondary
                    rounded-3xl p-6 border border-kong-border/50 hover:border-orange-500/50
                    transition-all duration-300 group relative overflow-hidden"
      >
        <div
          class="absolute bottom-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500"
        ></div>
        <div
          class="absolute top-4 right-4 w-24 h-24 bg-orange-500/5 rounded-full blur-xl"
        ></div>

        <div class="relative z-10 h-full flex flex-col">
          <!-- Header Section -->
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-4">
              <!-- Token Image -->
              <div class="relative">
                <div class="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span class="text-2xl font-bold text-white">K</span>
                </div>
                <div class="absolute -bottom-1 -right-1 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  DAO
                </div>
              </div>
              
              <div>
                <h3 class="text-3xl font-bold text-kong-text-primary mb-1">
                  KONG Token
                </h3>
                <p class="text-kong-text-secondary text-base">
                  Community governance & rewards
                </p>
              </div>
            </div>
            
            <div class="flex flex-col items-end">
              <div class="flex items-baseline gap-2 mb-1">
                {#if kongToken}
                  <span class="text-2xl font-bold text-kong-text-primary">
                    ${formatToNonZeroDecimal(kongToken.metrics?.price || 0)}
                  </span>
                  <span
                    class="text-sm font-semibold px-1.5 py-0.5 rounded {Number(
                      kongToken.metrics?.price_change_24h || 0,
                    ) >= 0
                      ? 'text-kong-success bg-kong-success/10'
                      : 'text-kong-error bg-kong-error/10'}"
                  >
                    {Number(kongToken.metrics?.price_change_24h || 0) >= 0
                      ? "+"
                      : ""}{formatToNonZeroDecimal(
                      kongToken.metrics?.price_change_24h || 0,
                    )}%
                  </span>
                {:else if isLoadingStats}
                  <div class="h-7 w-24 bg-kong-bg-tertiary rounded animate-pulse"></div>
                  <div class="h-6 w-16 bg-kong-bg-tertiary rounded animate-pulse"></div>
                {/if}
              </div>
              <p class="text-xs text-kong-text-secondary">24h change</p>
            </div>
          </div>

          <!-- Stats Grid -->
          <div class="flex-1 flex gap-6 mb-4">
            <!-- Left Column - Basic Stats -->
            <div class="flex-1 space-y-3">
              <!-- Market Cap -->
              <div class="p-3 bg-kong-bg-tertiary/20 rounded-xl">
                <p class="text-sm text-kong-text-secondary uppercase tracking-wider mb-1">Market Cap</p>
                {#if kongToken}
                  <p class="text-xl font-bold text-kong-text-primary">
                    {formatUsdValue(kongToken.metrics?.market_cap || 0)}
                  </p>
                {:else if isLoadingStats}
                  <div class="h-6 w-24 bg-kong-bg-tertiary rounded animate-pulse"></div>
                {:else}
                  <p class="text-xl font-bold text-kong-text-primary">-</p>
                {/if}
              </div>

              <!-- 24h Volume -->
              <div class="p-3 bg-kong-bg-tertiary/20 rounded-xl">
                <p class="text-sm text-kong-text-secondary uppercase tracking-wider mb-1">24h Volume</p>
                {#if kongToken}
                  <p class="text-xl font-bold text-kong-text-primary">
                    {formatUsdValue(kongToken.metrics?.volume_24h || 0)}
                  </p>
                {:else if isLoadingStats}
                  <div class="h-6 w-24 bg-kong-bg-tertiary rounded animate-pulse"></div>
                {:else}
                  <p class="text-xl font-bold text-kong-text-primary">-</p>
                {/if}
              </div>

              <!-- Total Supply -->
              <div class="p-3 bg-kong-bg-tertiary/20 rounded-xl">
                <p class="text-sm text-kong-text-secondary uppercase tracking-wider mb-1">Total Supply</p>
                {#if kongToken}
                  <p class="text-xl font-bold text-kong-text-primary">
                    {formatToNonZeroDecimal(
                      Number(kongToken.metrics?.total_supply || 0) /
                        Math.pow(10, kongToken.decimals || 8),
                    )}
                  </p>
                {:else if isLoadingStats}
                  <div class="h-6 w-24 bg-kong-bg-tertiary rounded animate-pulse"></div>
                {:else}
                  <p class="text-xl font-bold text-kong-text-primary">-</p>
                {/if}
              </div>
            </div>

            <!-- Right Column - DAO Features -->
            <div class="flex-1">
              <div class="p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-xl border border-orange-500/20 h-full">
                <p class="text-sm text-orange-400 uppercase tracking-wider mb-3 font-medium">DAO Benefits</p>
                <ul class="space-y-2 text-base text-kong-text-secondary">
                  <li class="flex items-center gap-2">
                    <span class="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                    Vote on proposals
                  </li>
                  <li class="flex items-center gap-2">
                    <span class="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                    Earn rewards
                  </li>
                  <li class="flex items-center gap-2">
                    <span class="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                    Stake benefits
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Action Links -->
          <div class="flex flex-wrap gap-3 pt-3 border-t border-kong-border/20">
            <a
              href="https://dashboard.internetcomputer.org/sns/oypg6-faaaa-aaaaq-aadza-cai"
              target="_blank"
              rel="noopener noreferrer"
              class="flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg text-sm text-orange-400 hover:text-orange-300 transition-colors border border-orange-500/20"
            >
              <Vote class="w-4 h-4" />
              <span>DAO Dashboard</span>
            </a>
            <a
              href="/stats/{KONG_CANISTER_ID}"
              class="flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-4 py-2 bg-kong-bg-tertiary/20 hover:bg-kong-bg-tertiary/30 rounded-lg text-sm text-kong-text-primary hover:text-kong-text-primary transition-colors border border-kong-border/20"
            >
              <TrendingUp class="w-4 h-4" />
              <span>Token Stats</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Fast Swaps Box -->
      <div
        class="bg-gradient-to-br from-kong-bg-primary to-kong-bg-secondary
                    rounded-3xl p-6 border border-kong-border/50 hover:border-kong-warning/50
                    transition-all duration-300 group relative overflow-hidden"
      >
        <div
          class="absolute bottom-0 left-0 w-32 h-32 bg-kong-warning/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"
        ></div>

        <div class="relative z-10 h-full flex flex-col">
          <div class="flex items-center justify-between mb-4">
            <Zap class="w-6 h-6 text-kong-warning" />
            <Activity class="w-4 h-4 text-kong-warning animate-pulse" />
          </div>

          <div class="flex-1 flex flex-col justify-center">
            <h3 class="text-xl font-semibold text-kong-text-primary mb-2">
              Lightning Fast
            </h3>
            <span class="text-4xl font-bold text-kong-text-primary">~2s</span>
            <span class="text-base text-kong-text-secondary mt-1"
              >avg swap time</span
            >
          </div>
        </div>
      </div>

      <!-- Ecosystem Box -->
      <div
        class="bg-gradient-to-br from-kong-bg-primary to-kong-bg-secondary
                    rounded-3xl p-6 border border-kong-border/50 hover:border-kong-primary/50
                    transition-all duration-300 group relative overflow-hidden"
      >
        <div
          class="absolute top-0 right-0 w-32 h-32 bg-kong-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"
        ></div>

        <div class="relative z-10 h-full flex flex-col">
          <div class="flex items-center justify-between mb-4">
            <Globe class="w-6 h-6 text-kong-primary" />
            <div class="flex gap-1">
              <div
                class="w-1.5 h-1.5 bg-kong-primary rounded-full animate-pulse"
              ></div>
              <div
                class="w-1.5 h-1.5 bg-kong-primary rounded-full animate-pulse"
                style="animation-delay: 0.2s"
              ></div>
              <div
                class="w-1.5 h-1.5 bg-kong-primary rounded-full animate-pulse"
                style="animation-delay: 0.4s"
              ></div>
            </div>
          </div>

          <div class="flex-1 flex flex-col justify-center">
            <h3 class="text-xl font-semibold text-kong-text-primary mb-3">
              Growing Daily
            </h3>
            <div class="grid grid-cols-2 gap-3">
              <div class="text-center">
                <span class="text-3xl font-bold text-kong-text-primary block"
                  >50+</span
                >
                <span class="text-sm text-kong-text-secondary"
                  >Trading Pairs</span
                >
              </div>
              <div class="text-center">
                <span class="text-3xl font-bold text-kong-text-primary block"
                  >15+</span
                >
                <span class="text-sm text-kong-text-secondary">Tokens</span>
              </div>
            </div>
          </div>
        </div>
      </div>



      <!-- Prediction Markets Box -->
      <div
        class="md:col-span-2 lg:row-span-3 bg-gradient-to-br from-kong-bg-primary to-kong-bg-secondary
                    rounded-3xl p-8 border border-kong-border/50 hover:border-purple-500/50
                    transition-all duration-300 group relative overflow-hidden"
      >
        <div
          class="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500"
        ></div>

        <div class="relative z-10 h-full flex flex-col">
          <div class="flex items-start justify-between mb-6">
            <div>
              <h3 class="text-2xl font-bold text-kong-text-primary mb-2">
                Prediction Markets
              </h3>
              <p class="text-kong-text-secondary text-base">
                Trade on future outcomes
              </p>
            </div>
            <div
              class="p-3 bg-purple-500/10 rounded-xl group-hover:bg-purple-500/20 transition-colors"
            >
              <Brain class="w-6 h-6 text-purple-400" />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4 mb-6">
            <div>
              {#if isLoadingStats}
                <div
                  class="h-8 w-20 bg-kong-bg-tertiary rounded animate-pulse mb-1"
                ></div>
              {:else}
                <span class="text-3xl font-bold text-kong-text-primary"
                  >{predictionStats?.total_markets || 0}</span
                >
              {/if}
              <p class="text-sm text-kong-text-secondary mt-1">Total Markets</p>
            </div>
            <div>
              {#if isLoadingStats}
                <div
                  class="h-8 w-20 bg-kong-bg-tertiary rounded animate-pulse mb-1"
                ></div>
              {:else}
                <span class="text-3xl font-bold text-purple-400"
                  >{predictionStats?.total_active_markets || 0}</span
                >
              {/if}
              <p class="text-sm text-kong-text-secondary mt-1">Active Now</p>
            </div>
            <div>
              {#if isLoadingStats}
                <div
                  class="h-8 w-20 bg-kong-bg-tertiary rounded animate-pulse mb-1"
                ></div>
              {:else}
                <span class="text-3xl font-bold text-kong-text-primary"
                  >{predictionStats?.total_bets || 0}</span
                >
              {/if}
              <p class="text-sm text-kong-text-secondary mt-1">Predictions</p>
            </div>
          </div>

          <!-- Recent Markets Section -->
          <div class="flex-1 flex flex-col">
            <h4 class="text-sm font-medium text-kong-text-primary mb-3">Recent Markets</h4>
            <div class="flex-1 space-y-3">
              {#if isLoadingStats}
                <!-- Loading skeleton for recent markets -->
                {#each Array(3) as _, i}
                  <div class="p-3 bg-kong-bg-tertiary/20 rounded-lg">
                    <div class="h-4 w-3/4 bg-kong-bg-tertiary rounded animate-pulse mb-2"></div>
                    <div class="flex justify-between items-center">
                      <div class="h-3 w-16 bg-kong-bg-tertiary rounded animate-pulse"></div>
                      <div class="h-3 w-12 bg-kong-bg-tertiary rounded animate-pulse"></div>
                    </div>
                  </div>
                {/each}
                             {:else}
                 <!-- Real recent markets -->
                 {#if recentMarkets && recentMarkets.length > 0}
                   {#each recentMarkets as market}
                     <a href="/predict/{market.id}" class="block p-3 bg-kong-bg-tertiary/20 rounded-lg hover:bg-kong-bg-tertiary/30 transition-colors cursor-pointer">
                       <p class="text-sm text-kong-text-primary font-medium mb-1">{market.question}</p>
                       <div class="flex justify-between items-center">
                         <span class="text-xs text-kong-text-secondary">
                           {#if market.end_time}
                             {new Date(Number(market.end_time) / 1000000).toLocaleDateString()}
                           {:else}
                             Active
                           {/if}
                         </span>
                         <span class="text-xs text-purple-400 font-medium">
                           {#if market.outcomes && market.outcomes.length > 0}
                             {market.outcomes[0]?.name || "YES"} {Math.round(Number(market.outcomes[0]?.probability || 0) * 100)}%
                           {:else}
                             Active
                           {/if}
                         </span>
                       </div>
                     </a>
                   {/each}
                 {:else}
                   <div class="p-3 bg-kong-bg-tertiary/20 rounded-lg">
                     <p class="text-sm text-kong-text-secondary text-center">No recent markets available</p>
                   </div>
                 {/if}
               {/if}
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-kong-border/20">
            <a
              href="/predict"
              class="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              <span>Explore All Markets</span>
              <ChevronDown class="w-4 h-4 rotate-[-90deg]" />
            </a>
          </div>
        </div>
      </div>

      <!-- Security Box - Wide -->
      <div
        class="md:col-span-2 bg-gradient-to-br from-kong-bg-primary to-kong-bg-secondary
                    rounded-3xl p-8 border border-kong-border/50 hover:border-kong-error/50
                    transition-all duration-300 group relative overflow-hidden"
      >
        <div
          class="absolute top-0 left-0 w-40 h-40 bg-kong-error/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500"
        ></div>

        <div class="relative z-10">
          <div class="flex items-start justify-between mb-6">
            <div>
              <h3 class="text-2xl font-bold text-kong-text-primary mb-2">
                Built on Internet Computer
              </h3>
              <p class="text-kong-text-secondary text-base">
                100% on-chain, fully decentralized
              </p>
            </div>
            <div
              class="p-3 bg-kong-error/10 rounded-xl group-hover:bg-kong-error/20 transition-colors"
            >
              <Lock class="w-6 h-6 text-kong-error" />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div class="text-center">
              <span class="text-3xl font-bold text-kong-text-primary">100%</span
              >
              <p class="text-sm text-kong-text-secondary mt-1">Uptime</p>
            </div>
            <div class="text-center">
              <span class="text-3xl font-bold text-kong-text-primary">0</span>
              <p class="text-sm text-kong-text-secondary mt-1">
                Security Incidents
              </p>
            </div>
            <div class="text-center">
              <span class="text-3xl font-bold text-kong-text-primary"
                >Audited</span
              >
              <p class="text-sm text-kong-text-secondary mt-1">
                Smart Contracts
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</section>

<style>
  /* Add smooth scroll behavior */
  :global(html) {
    scroll-behavior: smooth;
  }

  /* Animate bento boxes on scroll */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Animate grid items */
  #explore-section > div > div:nth-child(2) > div {
    animation: fadeInUp 0.8s ease-out forwards;
    opacity: 0;
  }

  #explore-section > div > div:nth-child(2) > div:nth-child(1) {
    animation-delay: 0.1s;
  }
  #explore-section > div > div:nth-child(2) > div:nth-child(2) {
    animation-delay: 0.15s;
  }
  #explore-section > div > div:nth-child(2) > div:nth-child(3) {
    animation-delay: 0.2s;
  }
  #explore-section > div > div:nth-child(2) > div:nth-child(4) {
    animation-delay: 0.25s;
  }
  #explore-section > div > div:nth-child(2) > div:nth-child(5) {
    animation-delay: 0.3s;
  }
  #explore-section > div > div:nth-child(2) > div:nth-child(6) {
    animation-delay: 0.35s;
  }
  #explore-section > div > div:nth-child(2) > div:nth-child(7) {
    animation-delay: 0.4s;
  }

  /* Animate CTA box separately */
  #explore-section > div > div:nth-child(3) > div {
    animation: fadeInUp 0.8s ease-out forwards;
    animation-delay: 0.5s;
    opacity: 0;
  }

  /* Add hover glow effect */
  #explore-section > div > div:nth-child(2) > div,
  #explore-section > div > div:nth-child(3) > div {
    transition:
      transform 0.3s ease,
      box-shadow 0.3s ease;
  }

  #explore-section > div > div:nth-child(2) > div:hover,
  #explore-section > div > div:nth-child(3) > div:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.3);
  }
</style>
