<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { page } from "$app/stores";
  import { onDestroy } from "svelte";
  import TradingViewChart from "$lib/components/common/TradingViewChart.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import { poolStore, type Pool } from "$lib/services/pools";
  import Panel from "$lib/components/common/Panel.svelte";
  import TransactionFeed from "$lib/components/stats/TransactionFeed.svelte";
  import { goto } from "$app/navigation";
  import { ICP_CANISTER_ID } from "$lib/constants/canisterConstants";
  import PoolSelector from "$lib/components/stats/PoolSelector.svelte";
  import TokenStatistics from "$lib/components/stats/TokenStatistics.svelte";

  // Ensure formattedTokens and poolStore are initialized
  if (!formattedTokens || !poolStore) {
    throw new Error("Stores are not initialized");
  }

  // Add back the necessary state variables at the top
  let token = $state<FE.Token | undefined>(undefined);
  let refreshInterval: number;

  // Derived values
  let ckusdtToken = $state<FE.Token | undefined>(undefined);
  $effect(() => {
    const found = $formattedTokens?.find((t) => t.symbol === "ckUSDT");
    if (found) {
      ckusdtToken = found;
    }
  });

  let icpToken = $state<FE.Token | undefined>(undefined);
  $effect(() => {
    const found = $formattedTokens?.find(
      (t) => t.canister_id === ICP_CANISTER_ID,
    );
    if (found) {
      icpToken = found;
    }
  });

  // Remove the duplicate state declarations and keep only one effect
  $effect(() => {
    const pageId = $page.params.id;

    if (!$formattedTokens?.length || !pageId) {
      token = undefined;
      hasManualSelection = false;
      initialPoolSet = false;
      return;
    }

    const foundToken = $formattedTokens.find(
      (t) => t.address === pageId || t.canister_id === pageId,
    );

    if (foundToken) {
      const converted = foundToken;
      token = converted;
      hasManualSelection = false;
      initialPoolSet = false;
    } else {
      console.warn("Token not found:", $page.params.id);
      token = undefined;
      hasManualSelection = false;
      initialPoolSet = false;
    }
  });

  // First try to find CKUSDT pool with non-zero TVL, then fallback to largest pool
  let selectedPool = $state<Pool | undefined>(undefined);
  let hasManualSelection = $state(false);
  let initialPoolSet = $state(false);

  $effect(() => {
    if (!token?.canister_id || !$poolStore?.pools) return;
    if (hasManualSelection) return;
    if (initialPoolSet) return;

    // Get all pools containing this token
    const relevantPools = $poolStore.pools.filter((p) => {
      const hasToken =
        p.address_0 === token.canister_id || p.address_1 === token.canister_id;
      const hasTVL = Number(p.tvl) > 0;
      const hasVolume = Number(p.volume_24h) > 0;
      return hasToken && hasTVL && hasVolume;
    });

    if (relevantPools.length === 0) {
      // If no pools with volume, fall back to pools with just TVL
      const poolsWithTvl = $poolStore.pools.filter((p) => {
        const hasToken =
          p.address_0 === token.canister_id ||
          p.address_1 === token.canister_id;
        const hasTVL = Number(p.tvl) > 0;
        return hasToken && hasTVL;
      });

      if (poolsWithTvl.length > 0) {
        const sortedByTvl = poolsWithTvl.sort(
          (a, b) => Number(b.tvl) - Number(a.tvl),
        );
        const highestTvlPool = sortedByTvl[0];
        selectedPool = {
          ...highestTvlPool,
          pool_id: String(highestTvlPool.pool_id),
          tvl: String(highestTvlPool.tvl),
          lp_token_supply: String(highestTvlPool.lp_token_supply),
        } as unknown as Pool;
        initialPoolSet = true;
      }
      return;
    }

    // Sort by 24h volume descending
    const sortedPools = relevantPools.sort(
      (a, b) => Number(b.volume_24h) - Number(a.volume_24h),
    );
    const highestVolumePool = sortedPools[0];

    if (highestVolumePool) {
      selectedPool = {
        ...highestVolumePool,
        pool_id: String(highestVolumePool.pool_id),
        tvl: String(highestVolumePool.tvl),
        lp_token_supply: String(highestVolumePool.lp_token_supply),
      } as unknown as Pool;
      initialPoolSet = true;
    }
  });

  let observer: IntersectionObserver;

  onDestroy(() => {
    if (observer) observer.disconnect();
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  // Add derived store for market cap rank
  let marketCapRank = $state<number | null>(null);
  $effect(() => {
    if (!$formattedTokens) return;
    const foundToken = $formattedTokens.find(
      (t) => t.address === $page.params.id || t.canister_id === $page.params.id,
    );
    if (!foundToken) {
      marketCapRank = null;
      return;
    }
    const sortedTokens = [...$formattedTokens].sort(
      (a, b) =>
        (Number(b.metrics.market_cap) || 0) -
        (Number(a.metrics.market_cap) || 0),
    );
    const rank = sortedTokens.findIndex(
      (t) => t.canister_id === foundToken.canister_id,
    );
    marketCapRank = rank !== -1 ? rank + 1 : null;
  });

  // Add helper function to calculate 24h volume percentage
  function calculateVolumePercentage(
    volume: number,
    marketCap: number,
  ): string {
    if (!marketCap) return "0.00%";
    return ((volume / marketCap) * 100).toFixed(2) + "%";
  }

  // Add back the isChartDataReady state and effect
  let isChartDataReady = $state(false);
  $effect(() => {
    isChartDataReady = Boolean(selectedPool && token);
  });

  // Add tab state
  let activeTab = $state<"overview" | "pools" | "transactions">("overview");

  // Add pool selector state
  let isPoolSelectorOpen = $state(false);

  // Store relevant pools for selection
  let relevantPools = $state<BE.Pool[]>([]);

  // Update relevantPools when poolStore changes
  $effect(() => {
    if (!token?.canister_id || !$poolStore?.pools) {
      relevantPools = [];
      return;
    }

    relevantPools = $poolStore.pools
      .filter((p) => {
        const hasToken =
          p.address_0 === token.canister_id ||
          p.address_1 === token.canister_id;
        const hasTVL = Number(p.tvl) > 0;
        return hasToken && hasTVL;
      })
      .sort((a, b) => Number(b.volume_24h || 0) - Number(a.volume_24h || 0));
  });
</script>

<div class="p-4 pt-0">
  {#if !$formattedTokens || !$poolStore?.pools}
    <!-- Improved loading state -->
    <div class="flex flex-col items-center justify-center min-h-[300px]">
      <div class="loader mb-4"></div>
      <div class="text-kong-text-primary/70">Loading token data...</div>
    </div>
  {:else if !token}
    <div class="flex flex-col items-center justify-center min-h-[300px]">
      <div class="text-kong-text-primary/70">Token not found</div>
      <button
        class="mt-4 px-4 py-2 bg-[#2a2d3d] rounded-lg hover:bg-[#2a2d3d]/80 transition-colors"
        on:click={() => goto("/stats")}
      >
        Return to Stats
      </button>
    </div>
  {:else}
    <div class="flex flex-col max-w-[1300px] mx-auto gap-6">
      <!-- Token Header - Non-fixed with border radius -->
      <Panel variant="transparent" type="main">
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <!-- Left side with back button and token info -->
            <div class="flex items-center gap-4">
              <button
                title="Back"
                aria-label="Back"
                on:click={() => goto("/stats")}
                class="flex min-h-[40px] md:min-h-[48px] flex-col items-center justify-center gap-2 px-2.5 text-sm bg-kong-bg-secondary hover:bg-kong-bg-secondary/80 text-kong-text-primary/70 rounded-lg transition-colors duration-200 w-fit"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3.5 w-3.5 md:h-4 md:w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L4.414 9H17a1 1 0 110 2H4.414l5.293 5.293a1 1 0 010 1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>

              <div class="flex items-center gap-3">
                <TokenImages
                  tokens={token ? [token] : []}
                  size={36}
                  containerClass="md:w-12 md:h-12"
                />
                <div class="flex items-center gap-2">
                  <h1
                    class="text-lg md:text-2xl font-bold text-kong-text-primary"
                  >
                    {token.name}
                  </h1>
                  <div class="text-sm md:text-base text-[#8890a4]">
                    ({token.symbol})
                  </div>
                </div>
              </div>
            </div>

            <!-- Right side with tab names -->
            <div class="hidden md:flex items-center gap-6 text-[#8890a4]">
              <PoolSelector
                {selectedPool}
                {token}
                formattedTokens={$formattedTokens}
                {relevantPools}
                onPoolSelect={(pool) => {
                  hasManualSelection = true;
                  selectedPool = {
                    ...pool,
                    pool_id: String(pool.pool_id),
                    tvl: String(pool.tvl),
                    lp_token_supply: String(pool.lp_token_supply),
                    volume_24h: String(pool.daily_volume || "0"),
                  } as Pool;
                }}
              />
            </div>
          </div>
        </div>
      </Panel>

      <!-- Remove the old tab navigation -->
      <!-- Mobile-only tab navigation -->
      <div class="md:hidden bg-[#2a2d3d]/60 rounded-lg">
        <nav
          class="flex w-full"
          role="tablist"
          aria-label="Token information tabs"
        >
          <button
            role="tab"
            aria-selected={activeTab === "overview"}
            aria-controls="overview-panel"
            id="overview-tab"
            class="flex-1 sm:flex-none px-6 py-4 text-sm font-medium whitespace-nowrap transition-all duration-200 relative
              {activeTab === 'overview'
              ? 'text-kong-text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#6667AB] after:rounded-t-sm'
              : 'text-kong-text-primary/50 hover:text-kong-text-primary hover:bg-white/10'}
              first:rounded-l-lg"
            on:click={() => (activeTab = "overview")}
          >
            Overview
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      {#if activeTab === "overview"}
        <div
          role="tabpanel"
          id="overview-panel"
          aria-labelledby="overview-tab"
          tabindex="0"
        >
          <!-- Overview Layout -->
          <div class="flex flex-col lg:flex-row gap-6">
            <!-- Left Column - Chart and Transactions -->
            <div class="lg:w-[70%] flex flex-col gap-6">
              <!-- Chart Panel -->
              <Panel
                variant="transparent"
                type="main"
                className="!p-0 border-none"
              >
                <div class="h-[450px] min-h-[400px] w-full">
                  {#if isChartDataReady}
                    <TradingViewChart
                      poolId={selectedPool ? Number(selectedPool.pool_id) : 0}
                      symbol={token && selectedPool
                        ? `${token.symbol}/${
                            selectedPool.address_0 === token.canister_id
                              ? $formattedTokens?.find(
                                  (t) =>
                                    t.canister_id === selectedPool.address_1,
                                )?.symbol
                              : $formattedTokens?.find(
                                  (t) =>
                                    t.canister_id === selectedPool.address_0,
                                )?.symbol
                          }`
                        : ""}
                      quoteToken={selectedPool?.address_0 === token?.canister_id
                        ? $formattedTokens?.find(
                            (t) => t.canister_id === selectedPool?.address_1,
                          )
                        : $formattedTokens?.find(
                            (t) => t.canister_id === selectedPool?.address_0,
                          )}
                      baseToken={token}
                    />
                  {:else}
                    <div class="flex items-center justify-center h-full">
                      <div class="loader"></div>
                    </div>
                  {/if}
                </div>
              </Panel>

              <!-- Transactions Panel -->
              {#if token && token.canister_id === $page.params.id}
                <TransactionFeed {token} className="w-full !p-0" />
              {/if}
            </div>

            <!-- Right Column - Stats -->
            <div class="lg:w-[30%] flex flex-col gap-4">
              <TokenStatistics {token} {marketCapRank} />
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style scoped>
  .loader {
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-top: 4px solid #ffffff;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Global scrollbar styles */
  :global(::-webkit-scrollbar) {
    width: 6px;
    height: 6px;
  }

  :global(::-webkit-scrollbar-track) {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 3px;
  }

  :global(::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
  }

  :global(::-webkit-scrollbar-thumb:hover) {
    background: rgba(255, 255, 255, 0.12);
  }

  /* Make back button more square */
  :global(button[title="Back"]) {
    aspect-ratio: 1;
    padding: 0;
    width: 40px;
    height: 40px;
  }

  @media (min-width: 768px) {
    :global(button[title="Back"]) {
      width: 48px;
      height: 48px;
    }
  }

  /* Add smooth transitions for tabs */
  button {
    transition: all 0.2s ease-in-out;
  }
</style>
