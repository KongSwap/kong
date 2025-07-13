<script lang="ts">
  import BetBarChart from "./BetBarChart.svelte";
  import ChanceLineChart from "./ChanceLineChart.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Card from "$lib/components/common/Card.svelte";
  import { formatBalance, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import type { Market } from "$lib/types/predictionMarket";
  import { userTokens } from "$lib/stores/userTokens";
  import { isAdmin } from "$lib/api/predictionMarket";
  import IconifyIcon from "@iconify/svelte";
  import {
    shareToTwitter,
    shareToFacebook,
    shareToReddit,
    shareToTikTok,
    shareToTelegram,
  } from "$lib/utils/socialShareUtils";

  let {
    market,
    loading = false,
    marketBets = [],
    selectedTab = 'percentageChance',
    onTabChange,
    tokenInfo,
  } = $props<{
    market: Market;
    loading?: boolean;
    marketBets?: any[];
    selectedTab?: string;
    onTabChange?: (tab: string) => void;
    tokenInfo?: any;
  }>();
  
  // Only derive what we actually need multiple times
  let isMarketResolved = $derived(market?.status?.Closed !== undefined);
  let marketEndTime = $derived(
    market?.end_time ? Number(market.end_time) / 1_000_000 : null
  );
  // Calculate time left dynamically
  let timeLeft = $derived(() => {
    if (!market?.end_time || !marketEndTime) return "";
    
    // Force recalculation when currentTime changes
    const now = currentTime;
    const diff = marketEndTime - now;
    
    if (diff <= 0) return "Ended";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  });

  let isCreatorAdmin = $state(false);
  let checkingAdmin = $state(true);
  let currentTime = $state(Date.now());

  // Update current time every second for countdown
  $effect(() => {
    const isActive = !isMarketResolved && 
                    market?.status?.Voided === undefined && 
                    marketEndTime && 
                    marketEndTime > Date.now();
    
    if (isActive) {
      const interval = setInterval(() => {
        currentTime = Date.now();
      }, 1000);

      return () => clearInterval(interval);
    }
  });

  // Check if the market creator is an admin
  $effect(() => {
    if (market?.creator) {
      checkingAdmin = true;
      isAdmin(market.creator.toText())
        .then((result) => {
          isCreatorAdmin = result;
        })
        .catch((error) => {
          console.error("Error checking admin status:", error);
          isCreatorAdmin = false;
        })
        .finally(() => {
          checkingAdmin = false;
        });
    }
  });

  const token = $derived(
    tokenInfo || $userTokens.tokens.find((t) => t.address === market?.token_id)
  );

  const marketStats = $derived(() => {
    const totalBets = market?.bet_counts?.reduce((a, b) => a + Number(b), 0) || 0;
    
    return [
      {
        label: "Total Pool",
        value: (() => {
          const totalPool = market?.total_pool ? 
            (typeof market.total_pool === 'string' ? market.total_pool : market.total_pool.toString()) 
            : '0';
          
          if (token && token.decimals !== undefined && token.symbol) {
            return `${formatBalance(Number(totalPool), token.decimals)} ${token.symbol}`;
          }
          return 'Loading...';
        })(),
        token: token,
      },
      {
        label: "Time Left",
        value: isMarketResolved ? "Market Closed" : timeLeft(),
        token: null,
      },
      {
        label: "Total Predictions",
        value: `${totalBets.toLocaleString()}`,
        token: null,
      },
    ];
  });

  // Build market URL
  const marketUrl = $derived(() => {
    if (typeof window !== "undefined" && market) {
      return `${window.location.origin}/predict/${market.id}`;
    }
    return "";
  });

  // Check if there's chart data available
  const hasChartData = $derived(marketBets && marketBets.length > 0);
  
  // Track error states for charts
  let betChartError = $state(false);
  let chanceChartError = $state(false);
  let marketBetsSnapshot = $state<any[]>([]);

  // When marketBets changes, update the snapshot and reset chart errors
  $effect(() => {
    if (marketBets) {
      // Create a new array to break any reactivity issues
      marketBetsSnapshot = [...marketBets];
      // Reset error states when data changes
      betChartError = false;
      chanceChartError = false;
    }
  });

  // Error handler functions
  function handleBetChartError() {
    betChartError = true;
  }

  function handleChanceChartError() {
    chanceChartError = true;
  }
</script>

<Card hasHeader={false}>
  <!-- Tabs at the top -->
  <div class="flex border-b border-kong-border overflow-x-auto scrollbar-none">
    <button
      onclick={() => onTabChange?.("percentageChance")}
      class="px-4 py-2.5 focus:outline-none transition-colors relative whitespace-nowrap flex-1 {selectedTab ===
      'percentageChance'
        ? 'text-kong-primary font-semibold'
        : 'text-kong-text-secondary hover:text-kong-text-primary'}"
      disabled={!hasChartData}
    >
      <span>Odds</span>
      {#if selectedTab === "percentageChance"}
        <div
          class="absolute bottom-0 left-0 w-full h-0.5 bg-kong-primary rounded-t-full"
        ></div>
      {/if}
    </button>
    <button
      onclick={() => onTabChange?.("betHistory")}
      class="px-4 py-2.5 focus:outline-none transition-colors relative whitespace-nowrap flex-1 {selectedTab ===
      'betHistory'
        ? 'text-kong-primary font-semibold'
        : 'text-kong-text-secondary hover:text-kong-text-primary'}"
      disabled={!hasChartData}
    >
      <span>History</span>
      {#if selectedTab === "betHistory"}
        <div
          class="absolute bottom-0 left-0 w-full h-0.5 bg-kong-primary rounded-t-full"
        ></div>
      {/if}
    </button>
    <button
      onclick={() => onTabChange?.("rules")}
      class="px-4 py-2.5 focus:outline-none transition-colors relative whitespace-nowrap flex-1 {selectedTab ===
      'rules'
        ? 'text-kong-primary font-semibold'
        : 'text-kong-text-secondary hover:text-kong-text-primary'}"
    >
      <span>Rules</span>
      {#if selectedTab === "rules"}
        <div
          class="absolute bottom-0 left-0 w-full h-0.5 bg-kong-primary rounded-t-full"
        ></div>
      {/if}
    </button>
  </div>

  <!-- Chart Content -->
  <div class="px-4 py-3">
    {#if selectedTab === "percentageChance"}
      {#if market && marketBetsSnapshot.length > 0}
        {#if chanceChartError}
          <div
            class="h-[200px] flex items-center justify-center bg-kong-bg-primary/20 rounded"
          >
            <p class="text-kong-text-secondary text-xs">
              Unable to display chart
            </p>
          </div>
        {:else}
          <div class="chart-wrapper h-[200px]">
            <ChanceLineChart
              {market}
              marketBets={marketBetsSnapshot}
              on:error={handleChanceChartError}
            />
          </div>
        {/if}
      {:else}
        <div
          class="h-[200px] flex items-center justify-center bg-kong-bg-primary/20 rounded"
        >
          <p class="text-kong-text-secondary text-xs">No data available</p>
        </div>
      {/if}
    {:else if selectedTab === "betHistory"}
      {#if market && marketBetsSnapshot.length > 0}
        {#if betChartError}
          <div
            class="h-[200px] flex items-center justify-center bg-kong-bg-primary/20 rounded"
          >
            <p class="text-kong-text-secondary text-xs">
              Unable to display history
            </p>
          </div>
        {:else}
          <div class="chart-wrapper h-[200px]">
            <BetBarChart
              {market}
              marketBets={marketBetsSnapshot}
              on:error={handleBetChartError}
            />
          </div>
        {/if}
      {:else}
        <div
          class="h-[200px] flex items-center justify-center bg-kong-bg-primary/20 rounded"
        >
          <p class="text-kong-text-secondary text-xs">No history data available</p>
        </div>
      {/if}
    {:else if selectedTab === "rules"}
      <div class="h-[200px] overflow-y-auto !text-kong-text-primary">
        {#if market && market.rules}
          <div class="prose prose-invert max-w-none">
            <p class="text-sm text-kong-text-secondary whitespace-pre-wrap">{market.rules}</p>
          </div>
        {:else}
          <p class="text-kong-text-secondary text-center">
            No specific rules are available for this market.
          </p>
        {/if}
      </div>
    {/if}
  </div>
  
  <!-- Details Section (Always Visible) -->
  <div class="px-4 pb-4 pt-2 border-t border-kong-border/20">
    {#if loading}
      <!-- Loading State -->
      <div class="space-y-0">
        {#each Array(5) as _, i}
          <div class="flex items-center justify-between py-2">
            <div class="flex items-center gap-2">
              <div
                class="w-4 h-4 bg-kong-bg-secondary/30 rounded animate-pulse"
              ></div>
              <div
                class="h-4 w-20 bg-kong-bg-secondary/30 rounded animate-pulse"
              ></div>
            </div>
            <div
              class="h-4 w-24 bg-kong-bg-secondary/30 rounded animate-pulse"
            ></div>
          </div>
        {/each}

        <!-- Loading Creator Section -->
        <div class="pt-3 border-t border-kong-border/20">
          <div class="flex items-center justify-between">
            <div
              class="h-4 w-16 bg-kong-bg-secondary/30 rounded animate-pulse"
            ></div>
            <div
              class="h-4 w-32 bg-kong-bg-secondary/30 rounded animate-pulse"
            ></div>
          </div>
        </div>

        <!-- Loading Share Section -->
        <div class="flex items-center justify-between py-2">
          <div
            class="h-4 w-12 bg-kong-bg-secondary/30 rounded animate-pulse"
          ></div>
          <div class="flex items-center gap-1">
            {#each Array(6) as _}
              <div
                class="w-7 h-7 bg-kong-bg-secondary/30 rounded animate-pulse"
              ></div>
            {/each}
          </div>
        </div>
      </div>
    {:else}
      <!-- Actual Content -->
      <div class="space-y-0">
        <!-- Market Status -->
        <div class="flex items-center justify-between py-2">
          <div class="flex items-center gap-2 text-kong-text-secondary">
            <span>Status</span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            {#if isMarketResolved}
              <span
                class="px-2 py-0.5 bg-kong-success/20 text-kong-success rounded-full font-medium"
              >
                Resolved
              </span>
            {:else if market?.status?.Voided !== undefined}
              <span
                class="px-2 py-0.5 bg-kong-error/20 text-kong-error rounded-full font-medium"
              >
                Voided
              </span>
            {:else if !isMarketResolved && marketEndTime && marketEndTime < Date.now()}
              <span
                class="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded-full font-medium"
              >
                Pending Resolution
              </span>
            {:else if market?.status?.Active !== undefined}
              <span
                class="px-2 py-0.5 bg-kong-accent-blue/20 text-kong-accent-blue rounded-full font-medium"
              >
                Active
              </span>
            {:else if market?.status?.PendingActivation !== undefined}
              <span
                class="px-2 py-0.5 bg-kong-accent-blue/20 text-kong-accent-blue rounded-full font-medium"
              >
                Pending Activation
              </span>
            {/if}
          </div>
        </div>

        {#each marketStats() as stat}
          <div class="flex items-center justify-between py-2">
            <div class="flex items-center gap-2 text-kong-text-secondary">
              <span>{stat.label}</span>
            </div>
            <div class="flex items-center gap-1.5">
              {#if stat.token}
                <TokenImages tokens={[stat.token]} size={16} />
              {/if}
              <span class="font-medium text-kong-text-primary">
                {stat.value}
              </span>
            </div>
          </div>
        {/each}

        <!-- Social Share -->
        <div class="flex items-center justify-center">
          <div class="flex items-center gap-1">
            <button
              onclick={() => shareToTwitter(marketUrl(), market.question)}
              class="p-1.5 rounded hover:bg-kong-bg-secondary text-kong-text-secondary/70 hover:text-kong-text-primary transition-colors"
              aria-label="Share on X"
            >
              <IconifyIcon icon="ri:twitter-x-fill" class="w-6 h-6" />
            </button>
            <button
              onclick={() => shareToTelegram(marketUrl(), market.question)}
              class="p-1.5 rounded hover:bg-kong-bg-secondary text-kong-text-secondary/70 hover:text-kong-text-primary transition-colors"
              aria-label="Share on Telegram"
            >
              <IconifyIcon icon="ri:telegram-fill" class="w-6 h-6" />
            </button>
            <button
              onclick={() => shareToTikTok(marketUrl())}
              class="p-1.5 rounded hover:bg-kong-bg-secondary text-kong-text-secondary/70 hover:text-kong-text-primary transition-colors"
              aria-label="Share on TikTok"
            >
              <IconifyIcon icon="ri:tiktok-fill" class="w-6 h-6" />
            </button>
            <button
              onclick={() => shareToFacebook(marketUrl())}
              class="p-1.5 rounded hover:bg-kong-bg-secondary text-kong-text-secondary/70 hover:text-kong-text-primary transition-colors"
              aria-label="Share on Facebook"
            >
              <IconifyIcon icon="ri:facebook-fill" class="w-6 h-6" />
            </button>
            <button
              onclick={() => shareToReddit(marketUrl(), market.question)}
              class="p-1.5 rounded hover:bg-kong-bg-secondary text-kong-text-secondary/70 hover:text-kong-text-primary transition-colors"
              aria-label="Share on Reddit"
            >
              <IconifyIcon icon="ri:reddit-fill" class="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</Card>

<style lang="postcss">
  .scrollbar-none {
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
  
  .chart-wrapper {
    height: 100%;
    width: 100%;
  }
</style>
