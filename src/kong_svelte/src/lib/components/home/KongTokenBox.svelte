<script lang="ts">
  import { Vote, TrendingUp, Flame } from "lucide-svelte";
  import { fetchTokensByCanisterId } from "$lib/api/tokens/TokenApiClient";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { onMount } from "svelte";
  import Card from "$lib/components/common/Card.svelte";
    import TokenImages from "../common/TokenImages.svelte";

  let kongToken = $state<Kong.Token | null>(null);
  let isLoadingStats = $state(true);

  async function loadKongTokenStats() {
    try {
      const kongData = await fetchTokensByCanisterId([KONG_CANISTER_ID]);
      if (kongData && kongData.length > 0) {
        kongToken = kongData[0];
      }
    } catch (error) {
      console.error("Error loading Kong token stats:", error);
    } finally {
      isLoadingStats = false;
    }
  }

  onMount(() => {
    loadKongTokenStats();
  });
</script>

<Card
  className="md:col-span-2 lg:col-span-2 lg:row-span-2 group relative"
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
    </div>
  </div>

  <div class="relative z-10 h-full flex flex-col">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row items-start sm:items-start justify-between mb-6 gap-4">
      <div class="flex items-center gap-3 sm:gap-4">
        <!-- Token Image -->
        <div class="relative">
          <TokenImages tokens={[kongToken]} size={64} />
        </div>
        
        <div>
          <h3 class="text-2xl sm:text-2xl font-bold text-kong-text-primary">
            KONG Token
          </h3>
          <p class="text-kong-text-secondary text-sm sm:text-base">
            Community governance & rewards
          </p>
        </div>
      </div>
      
      <div class="flex flex-col items-start sm:items-end">
        <div class="flex flex-col gap-2 mb-1">
          {#if kongToken}
            <span class="text-2xl font-bold text-kong-text-primary">
              ${formatToNonZeroDecimal(kongToken.metrics?.price || 0)}
            </span>
            <div class="flex items-center gap-2">
            <span
              class="text-sm font-semibold px-1.5 py-0.5 rounded text-center {Number(
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
            <p class="text-xs text-kong-text-secondary">24h</p>
            </div>
          {:else if isLoadingStats}
            <div class="h-7 w-24 bg-kong-bg-tertiary rounded animate-pulse"></div>
            <div class="h-6 w-16 bg-kong-bg-tertiary rounded animate-pulse"></div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 mb-4">
      <!-- Left Column - Basic Stats -->
      <div class="flex-1 grid grid-cols-2 lg:grid-cols-1 gap-3 mb-4 lg:mb-0">
        <!-- Market Cap -->
        <div class="p-3 bg-kong-bg-tertiary/20 rounded-xl">
          <p class="text-xs sm:text-sm text-kong-text-secondary uppercase tracking-wider mb-1">Market Cap</p>
          {#if kongToken}
            <p class="text-base sm:text-xl font-bold text-kong-text-primary">
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
          <p class="text-xs sm:text-sm text-kong-text-secondary uppercase tracking-wider mb-1">24h Volume</p>
          {#if kongToken}
            <p class="text-base sm:text-xl font-bold text-kong-text-primary">
              {formatUsdValue(kongToken.metrics?.volume_24h || 0)}
            </p>
          {:else if isLoadingStats}
            <div class="h-6 w-24 bg-kong-bg-tertiary rounded animate-pulse"></div>
          {:else}
            <p class="text-xl font-bold text-kong-text-primary">-</p>
          {/if}
        </div>

        <!-- Total Supply -->
        <div class="col-span-2 lg:col-span-1 p-3 bg-kong-bg-tertiary/20 rounded-xl">
          <p class="text-xs sm:text-sm text-kong-text-secondary uppercase tracking-wider mb-1">Total Supply</p>
          {#if kongToken}
            <p class="text-base sm:text-xl font-bold text-kong-text-primary">
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
      <div class="flex-1 flex flex-col">
        <!-- Option 4: Benefit-Driven with Icons -->
        <div class="grid grid-cols-1 gap-3">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 sm:w-10 sm:h-10 bg-kong-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <span class="text-kong-primary font-bold text-sm sm:text-base">%</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-base sm:text-lg font-semibold text-kong-text-primary leading-tight">14% APY Rewards</p>
              <p class="text-xs sm:text-sm text-kong-text-secondary mt-0.5 leading-relaxed">Stake KONG, earn governance rewards</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 sm:w-10 sm:h-10 bg-kong-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Vote class="w-4 h-4 sm:w-5 sm:h-5 text-kong-primary" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-base sm:text-lg font-semibold text-kong-text-primary leading-tight">100% Community Owned</p>
              <p class="text-xs sm:text-sm text-kong-text-secondary mt-0.5 leading-relaxed">Shape the future of DeFi on ICP</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 sm:w-10 sm:h-10 bg-kong-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Flame class="w-4 h-4 sm:w-5 sm:h-5 text-kong-primary" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-base sm:text-lg font-semibold text-kong-text-primary leading-tight">Deflationary Token</p>
              <p class="text-xs sm:text-sm text-kong-text-secondary mt-0.5 leading-relaxed">Burns reduce supply, increasing scarcity</p>
            </div>
          </div>
        </div>

        <!-- Option 3: Concise Power Statement (commented out - uncomment to use instead) -->
        <!-- <div class="space-y-2 text-base text-kong-text-secondary">
          <div class="text-xl leading-8">
            <span class="text-kong-text-secondary">Join the </span>
            <span class="text-kong-text-primary text-nowrap bg-kong-accent-green px-2 py-1 rounded-md">100% decentralized</span>
            <span class="text-kong-text-secondary"> DAO. Stake </span>
            <span class="text-kong-text-primary text-nowrap bg-kong-accent-green w-fit px-2 py-1 rounded-md">KONG</span>
            <span class="text-kong-text-secondary"> for </span>
            <span class="text-kong-text-primary text-nowrap bg-kong-accent-green w-fit px-2 py-1 rounded-md">14% APY</span>
            <span class="text-kong-text-secondary"> and govern the protocol</span>
          </div>
        </div> -->
      </div>
    </div>

    <!-- Action Links -->
    <div class="flex flex-wrap gap-2 sm:gap-3 pt-3 border-t border-kong-border/20">
      <a
        href="https://dashboard.internetcomputer.org/sns/ormnc-tiaaa-aaaaq-aadyq-cai"
        target="_blank"
        rel="noopener noreferrer"
        class="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-kong-bg-tertiary/20 hover:bg-kong-bg-tertiary/30 rounded-lg text-xs sm:text-sm text-kong-text-primary hover:text-kong-accent-green transition-colors border border-kong-border/20"
      >
        <Vote class="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
        <span class="whitespace-nowrap">SNS Dashboard</span>
      </a>
      <a
        href="/stats/{KONG_CANISTER_ID}"
        class="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-kong-bg-tertiary/20 hover:bg-kong-bg-tertiary/30 rounded-lg text-xs sm:text-sm text-kong-text-primary hover:text-kong-accent-green transition-colors border border-kong-border/20"
      >
        <TrendingUp class="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
        <span class="whitespace-nowrap">Token Stats</span>
      </a>
    </div>
  </div>
</Card> 