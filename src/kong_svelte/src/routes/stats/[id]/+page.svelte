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
  import { CKUSDC_CANISTER_ID, CKUSDT_CANISTER_ID, ICP_CANISTER_ID } from "$lib/constants/canisterConstants";

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
    const found = $formattedTokens?.find((t) => t.canister_id === ICP_CANISTER_ID);
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
    
    console.log('Found token:', foundToken);
    console.log('Token metrics:', foundToken?.metrics);
    console.log('24h price change:', foundToken?.metrics?.price_change_24h);

    if (foundToken) {
      const converted = foundToken;
      token = converted;
    } else {
      console.warn('Token not found:', $page.params.id);
      token = undefined;
    }
  });

  // First try to find CKUSDT pool with non-zero TVL, then fallback to largest pool
  let selectedPool = $state<Pool | undefined>(undefined);
  $effect(() => {
    if (token?.canister_id === CKUSDT_CANISTER_ID) {
      const foundPool = $poolStore?.pools?.find((p) => {
        const hasToken =
          p.address_0 === CKUSDT_CANISTER_ID || p.address_1 === CKUSDT_CANISTER_ID;
        const hasUSDC =
          p.address_0 === CKUSDC_CANISTER_ID || p.address_1 === CKUSDC_CANISTER_ID;
        const hasTVL = Number(p.tvl) > 0;

        return hasToken && hasUSDC && hasTVL;
      });

      if (foundPool) {
        selectedPool = {
          ...foundPool,
          pool_id: String(foundPool.pool_id),
          tvl: String(foundPool.tvl),
          lp_token_supply: String(foundPool.lp_token_supply),
        } as unknown as Pool;
      }
      return;
    }

    // Try to find CKUSDT pool first
    const ckusdtPool = $poolStore?.pools?.find((p) => {
      if (!token?.canister_id || !ckusdtToken?.canister_id) return false;

      const hasToken =
        p.address_0 === token.canister_id || p.address_1 === token.canister_id;
      const hasUSDT =
        p.address_0 === ckusdtToken.canister_id ||
        p.address_1 === ckusdtToken.canister_id;
      const hasTVL = Number(p.tvl) > 0;

      return hasToken && hasUSDT && hasTVL;
    });

    if (ckusdtPool) {
      selectedPool = {
        ...ckusdtPool,
        pool_id: String(ckusdtPool.pool_id),
        tvl: String(ckusdtPool.tvl),
        lp_token_supply: String(ckusdtPool.lp_token_supply),
      } as unknown as Pool;
      return;
    }

    // If no CKUSDT pool found, try ICP pool
    const icpPool = $poolStore?.pools?.find((p) => {
      if (!token?.canister_id) return false;

      const hasToken =
        p.address_0 === token.canister_id || p.address_1 === token.canister_id;
      const hasICP =
        p.address_0 === ICP_CANISTER_ID || p.address_1 === ICP_CANISTER_ID;
      const hasTVL = Number(p.tvl) > 0;

      return hasToken && hasICP && hasTVL;
    });

    if (icpPool) {
      selectedPool = {
        ...icpPool,
        pool_id: String(icpPool.pool_id),
        tvl: String(icpPool.tvl),
        lp_token_supply: String(icpPool.lp_token_supply),
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
    if (token?.canister_id === CKUSDT_CANISTER_ID) {
      isChartDataReady = Boolean(selectedPool && token && $formattedTokens?.find(t => t.canister_id === CKUSDC_CANISTER_ID));
    } else {
      isChartDataReady = Boolean(selectedPool && token && (ckusdtToken || icpToken));
    }
  });
</script>

<div class="p-4">
  {#if !$formattedTokens || !$poolStore?.pools}
    <div class="text-white">Loading token data...</div>
  {:else if !token}
    <div class="text-white">Token not found: {$page.params.id}</div>
  {:else}
    <div class="flex flex-col max-w-[1300px] mx-auto gap-6">
      <!-- Token Header -->
      <div class="w-full">
        <div class="max-w-[1300px] mx-auto flex flex-col gap-4">
          <!-- Token Info -->
          <div class="flex flex-col md:flex-row md:items-center gap-4 h-12">
            <div class="flex flex-row-reverse justify-between md:flex-row md:items-center gap-4 h-full">
              <!-- Back Button -->
              <button
                title="Back"
                aria-label="Back"
                onclick={() => goto("/stats")}
                class="flex min-h-full flex-col items-center justify-center gap-2 px-2.5 h-full text-sm bg-[#2a2d3d]/60 hover:bg-[#2a2d3d]/80 text-white/70 rounded-lg transition-colors duration-200 w-fit"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
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

              <div class="flex items-center gap-4">
                <TokenImages tokens={token ? [token] : []} size={48} />
                <div>
                  <h1 class="text-2xl font-bold text-white">{token.name}</h1>
                  <div class="text-[#8890a4]">{token.symbol}</div>
                </div>
              </div>
            </div>
            <!-- Canister ID -->
            <div class="flex-1 md:flex md:justify-end">
              <div
                class="bg-[#2a2d3d]/60 px-4 py-2 rounded-lg flex items-center justify-between gap-3 w-full md:w-auto"
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
          value={formatUsdValue(token?.price || 0)}
          color="purple"
        >
          <svelte:fragment slot="subtitle">
            {#if token.metrics.price_change_24h === "NEW"}
              <span class="text-purple-400">NEW</span>
            {:else if token.metrics.price_change_24h === null || Number(token.metrics.price_change_24h) === 0}
              <span class="text-slate-400">--</span>
            {:else}
              <span class={Number(token.metrics.price_change_24h) > 0 ? "text-green-500" : "text-red-500"}>
                {Number(token.metrics.price_change_24h) > 0 ? "+" : ""}{Number(token.metrics.price_change_24h).toFixed(2)}%
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
      <Panel variant="blue" type="main" className="!p-0 flex-1">
        <div class="h-[400px] md:h-[calc(100vh-500px)] min-h-[500px] w-full">
          {#if isChartDataReady}
            <TradingViewChart
              poolId={selectedPool ? Number(selectedPool.pool_id) : 0}
              symbol={token?.canister_id === CKUSDT_CANISTER_ID 
                ? "ckUSDT/ckUSDC"
                : token
                  ? `${
                      selectedPool?.address_0 === CKUSDT_CANISTER_ID || selectedPool?.address_1 === CKUSDT_CANISTER_ID
                        ? "ckUSDT"
                        : selectedPool?.address_0 === token.canister_id
                          ? $formattedTokens?.find(t => t.canister_id === selectedPool?.address_1)?.symbol
                          : $formattedTokens?.find(t => t.canister_id === selectedPool?.address_0)?.symbol
                    }/${token.symbol}`
                  : ""}
              fromToken={token?.canister_id === CKUSDT_CANISTER_ID
                ? ckusdtToken
                : selectedPool?.address_0 === CKUSDT_CANISTER_ID || selectedPool?.address_1 === CKUSDT_CANISTER_ID
                  ? ckusdtToken
                  : selectedPool?.address_0 === token?.canister_id
                    ? $formattedTokens?.find(t => t.canister_id === selectedPool?.address_1)
                    : $formattedTokens?.find(t => t.canister_id === selectedPool?.address_0)
              }
              toToken={token?.canister_id === CKUSDT_CANISTER_ID
                ? $formattedTokens?.find(t => t.canister_id === CKUSDC_CANISTER_ID)
                : selectedPool?.address_0 === CKUSDT_CANISTER_ID || selectedPool?.address_1 === CKUSDT_CANISTER_ID
                  ? token
                  : token
              }
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

  /* Add animation for new transactions */
  .new-transaction {
    animation: highlightTransaction 1s ease-out;
  }

  @keyframes highlightTransaction {
    0% {
      background-color: rgba(34, 197, 94, 0.2); /* Green for buys */
    }
    100% {
      background-color: transparent;
    }
  }

  tr:has(span.text-red-500).new-transaction {
    animation: highlightSellTransaction 1s ease-out;
  }

  @keyframes highlightSellTransaction {
    0% {
      background-color: rgba(239, 68, 68, 0.2); /* Red for sells */
    }
    100% {
      background-color: transparent;
    }
  }

  ::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 2px;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.12);
  }
</style>