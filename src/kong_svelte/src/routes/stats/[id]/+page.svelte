<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { page } from "$app/stores";
  import { onDestroy } from "svelte";
  import TradingViewChart from "$lib/components/common/TradingViewChart.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import { poolStore, type Pool } from "$lib/services/pools";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { userPoolBalances } from "$lib/services/pools/poolStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import TransactionFeed from "$lib/components/stats/TransactionFeed.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import LiquidityPoolsPanel from "$lib/components/stats/LiquidityPoolsPanel.svelte";
  import StatPanel from "$lib/components/stats/StatPanel.svelte";
  import { goto } from "$app/navigation";
  import { ICP_CANISTER_ID } from "$lib/constants/canisterConstants";

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
      return;
    }

    const foundToken = $formattedTokens.find(
      (t) => t.address === pageId || t.canister_id === pageId,
    );

    if (foundToken) {
      const converted = foundToken;
      token = converted;
    } else {
      console.warn("Token not found:", $page.params.id);
      token = undefined;
    }
  });

  // First try to find CKUSDT pool with non-zero TVL, then fallback to largest pool
  let selectedPool = $state<Pool | undefined>(undefined);
  $effect(() => {
    if (!token?.canister_id || !$poolStore?.pools) return;

    // Get all pools containing this token
    const relevantPools = $poolStore.pools.filter((p) => {
      const hasToken =
        p.address_0 === token.canister_id || p.address_1 === token.canister_id;
      const hasTVL = Number(p.tvl) > 0;
      const hasVolume = Number(p.volume_24h) > 0;
      return hasToken && hasTVL && hasVolume; // Only include pools with actual volume
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
</script>

<div class="p-4 pt-0 mt-2">
  {#if !$formattedTokens || !$poolStore?.pools}
    <div class="text-white">Loading token data...</div>
  {:else if !token}
    <div class="text-white">
      <!-- Add a no token found and loading indicator -->
      
    </div>
  {:else}
    <div class="flex flex-col max-w-[1300px] mx-auto gap-6">
      <!-- Token Header - Non-fixed with border radius -->
      <div class="bg-[#1a1d29] border-b border-white/5 rounded-2xl">
        <div class="p-4">
          <div class="max-w-[1300px] mx-auto">
            <!-- Token Info Container -->
            <div class="flex flex-col md:flex-row md:items-center gap-4">
              <div class="flex flex-row md:flex-row md:items-center gap-4">
                <!-- Back Button -->
                <button
                  title="Back"
                  aria-label="Back"
                  onclick={() => goto("/stats")}
                  class="flex min-h-[40px] md:min-h-[48px] flex-col items-center justify-center gap-2 px-2.5 text-sm bg-[#2a2d3d]/60 hover:bg-[#2a2d3d] text-white/70 rounded-lg transition-colors duration-200 w-fit"
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

                <div class="flex items-center gap-3 md:gap-4">
                  <TokenImages
                    tokens={token ? [token] : []}
                    size={36}
                    containerClass="md:w-12 md:h-12"
                  />
                  <div class="flex items-center gap-2">
                    <h1 class="text-lg md:text-2xl font-bold text-white">
                      {token.name}
                    </h1>
                    <div class="text-sm md:text-base text-[#8890a4]">
                      ({token.symbol})
                    </div>
                  </div>
                </div>
              </div>

              <!-- Canister ID - Hidden on mobile -->
              <div class="hidden md:flex md:flex-1 md:justify-end">
                <div
                  class="bg-[#2a2d3d]/60 hover:bg-[#2a2d3d] px-4 py-2 rounded-lg flex items-center justify-between gap-3 w-full md:w-auto transition-colors duration-200"
                >
                  <div class="truncate">
                    <span class="text-[#8890a4] text-sm"
                      >{token.canister_id}</span
                    >
                  </div>
                  <button
                    class="p-1.5 hover:bg-white/10 rounded-md transition-colors duration-200 flex-shrink-0"
                    aria-label="Copy canister ID"
                    onclick={() => {
                      navigator.clipboard.writeText(token.canister_id);
                      toastStore.success("Canister ID copied!", 2000);
                    }}
                    title="Copy canister ID"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 text-[#8890a4]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Mobile Canister ID -->
            <div class="md:hidden mt-4">
              <div
                class="bg-[#2a2d3d]/60 hover:bg-[#2a2d3d] px-4 py-2 rounded-lg flex items-center justify-between gap-3 w-full transition-colors duration-200"
              >
                <div class="truncate">
                  <span class="text-[#8890a4] text-sm">{token.canister_id}</span
                  >
                </div>
                <button
                  class="p-1.5 hover:bg-white/10 rounded-md transition-colors duration-200 flex-shrink-0"
                  aria-label="Copy canister ID"
                  onclick={() => {
                    navigator.clipboard.writeText(token.canister_id);
                    toastStore.success("Canister ID copied!", 2000);
                  }}
                  title="Copy canister ID"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 text-[#8890a4]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <!-- Price Panel -->
        <StatPanel
          title="Price"
          value={formatUsdValue(token?.metrics?.price || 0)}
          color="purple"
        >
          <svelte:fragment slot="subtitle">
            {#if !token?.metrics?.price_change_24h || token.metrics.price_change_24h === "n/a"}
              <span class="text-purple-400">0%</span>
            {:else if token.metrics.price_change_24h === null || Number(token.metrics.price_change_24h) === 0}
              <span class="text-slate-400">--</span>
            {:else}
              <span
                class={Number(token.metrics.price_change_24h) > 0
                  ? "text-green-500"
                  : "text-red-500"}
              >
                {Number(token.metrics.price_change_24h) > 0 ? "+" : ""}{Number(
                  token.metrics.price_change_24h,
                ).toFixed(2)}%
              </span>
            {/if}
            <span class="text-slate-400 ml-1">24h</span>
          </svelte:fragment>
        </StatPanel>

        <!-- 24h Volume Panel -->
        <StatPanel
          title="24h Volume"
          value={formatUsdValue(Number(token.metrics.volume_24h))}
          subtitle={token.metrics.volume_24h
            ? `${calculateVolumePercentage(Number(token.metrics.volume_24h), Number(token.metrics.market_cap))} of mcap`
            : "No volume data"}
          color="purple"
        />

        <!-- Market Cap Panel -->
        <StatPanel
          title="Market Cap"
          value={formatUsdValue(token?.metrics?.market_cap)}
          subtitle={`Rank #${marketCapRank !== null ? marketCapRank : "N/A"}`}
          color="green"
        />

        <!-- Total Supply Panel -->
        <StatPanel
          title="Total Supply"
          value={token?.metrics?.total_supply
            ? formatToNonZeroDecimal(
                Number(token.metrics?.total_supply) / 10 ** token.decimals,
              )
            : "0"}
          subtitle={`${token?.symbol || ""} tokens`}
          color="orange"
        />
      </div>

      <!-- Chart Section -->
      <Panel variant="blue" type="main" className="!p-0 flex-1 border-none">
        <div class="h-[450px] min-h-[400px] w-full">
          {#if isChartDataReady}
            <TradingViewChart
              poolId={selectedPool ? Number(selectedPool.pool_id) : 0}
              symbol={token && selectedPool
                ? `${token.symbol}/${
                    selectedPool.address_0 === token.canister_id
                      ? $formattedTokens?.find(
                          (t) => t.canister_id === selectedPool.address_1,
                        )?.symbol
                      : $formattedTokens?.find(
                          (t) => t.canister_id === selectedPool.address_0,
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

      <!-- Transactions Section -->
      <div class="flex flex-col md:flex-row gap-4">
        <LiquidityPoolsPanel
          {token}
          pools={$poolStore?.pools || []}
          userBalances={$userPoolBalances.map((balance) => ({
            ...balance,
            balance: balance.balance.toString(),
          }))}
        />

        {#if token && token.canister_id === $page.params.id}
          <TransactionFeed {token} />
        {/if}
      </div>
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
</style>
