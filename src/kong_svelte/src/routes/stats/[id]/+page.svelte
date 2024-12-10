<script lang="ts">
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { page } from "$app/stores";
  import { onDestroy } from "svelte";
  import TradingViewChart from "$lib/components/common/TradingViewChart.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import { poolStore, type Pool } from "$lib/services/pools";
  import { formatDistance } from "date-fns";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { userPoolBalances } from "$lib/services/pools/poolStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import { fetchChartData, type CandleData } from "$lib/services/indexer/api";
  import { onMount } from "svelte";
  import TransactionFeed from "$lib/components/stats/TransactionFeed.svelte";
  import { toastStore } from "$lib/stores/toastStore";

  // Ensure formattedTokens and poolStore are initialized
  if (!formattedTokens || !poolStore) {
    throw new Error("Stores are not initialized");
  }

  // Declare our state variables
  let token = $state<FE.Token | undefined>(undefined);
  let isLoadingTxns = $state(false);
  let error = $state<string | null>(null);
  const tokenAddress = $page.params.id;
  let refreshInterval: number;


  // Clean up interval on component destroy
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  // Add pagination state
  let currentPage = $state(1);

  // Derived values
  let ckusdtToken = $state<FE.Token | undefined>(undefined);
  $effect(() => {
    const found = $formattedTokens?.find((t) => t.symbol === "ckUSDT");
    if (found) {
      ckusdtToken = convertToken(found) as unknown as FE.Token;
    }
  });

  $effect(() => {
    const found = $formattedTokens?.find(
      (t) => t.address === tokenAddress || t.canister_id === tokenAddress,
    );
    if (found) {
      token = convertToken(found) as unknown as FE.Token;
    }
  });

  // First try to find CKUSDT pool with non-zero TVL, then fallback to largest pool
  let selectedPool = $state<Pool | undefined>(undefined);
  $effect(() => {
    const foundPool = $poolStore?.pools?.find((p) => {
      if (!token?.canister_id || !ckusdtToken?.canister_id) return false;

      const hasToken =
        p.address_0 === token.canister_id || p.address_1 === token.canister_id;
      const hasUSDT =
        p.address_0 === ckusdtToken.canister_id ||
        p.address_1 === ckusdtToken.canister_id;
      const hasTVL = Number(p.tvl) > 0;

      return hasToken && hasUSDT && hasTVL;
    });

    if (foundPool) {
      selectedPool = {
        ...foundPool,
        pool_id: String(foundPool.pool_id),
        tvl: String(foundPool.tvl),
        lp_token_supply: String(foundPool.lp_token_supply),
      } as unknown as Pool;
    }
  });

  let hasMore = $state(true);
  let observer: IntersectionObserver;
  let currentTokenId = $state<number | null>(null);

  // Watch for token changes
  $effect(() => {
    const newTokenId = token?.token_id ?? null;
    if (newTokenId !== currentTokenId) {
      currentTokenId = newTokenId;
      if (newTokenId !== null) {
        currentPage = 1;
        hasMore = true;
        error = null;
      } else {
        isLoadingTxns = false; // Clear loading state if no token
      }
    }
  });

  onDestroy(() => {
    if (observer) observer.disconnect();
  });

  // Add helper functions to handle the number formatting
  interface ApiTransaction {
    mid_price: number;
    pay_amount: number;
    pay_token_id: number;
    price: number;
    receive_amount: number;
    receive_token_id: number;
    timestamp?: string;
    ts?: string;
    tx_id?: string;
    user: {
      principal_id: string;
    };
  }

  const calculateTotalUsdValue = (tx: ApiTransaction): string => {
    const payToken = $formattedTokens?.find(
      (t) => t.token_id === tx.pay_token_id,
    );
    const receiveToken = $formattedTokens?.find(
      (t) => t.token_id === tx.receive_token_id,
    );
    if (!payToken || !receiveToken) return "0.00";

    // Calculate USD value from pay side
    const payUsdValue =
      payToken.symbol === "ckUSDT"
        ? tx.pay_amount
        : tx.pay_amount * (payToken.price || 0);

    // Calculate USD value from receive side
    const receiveUsdValue =
      receiveToken.symbol === "ckUSDT"
        ? tx.receive_amount
        : tx.receive_amount * (receiveToken.price || 0);

    // Use the higher value
    return formatUsdValue(Math.max(payUsdValue, receiveUsdValue));
  };

  // Function to get paginated pools
  function getPaginatedPools(pools: BE.Pool[]): { pools: Pool[] } {
    if (!token) return { pools: [] };

    const filteredPools = pools
      .filter(
        (p) =>
          p.address_0 === token.canister_id ||
          p.address_1 === token.canister_id,
      )
      .sort((a, b) => Number(b.tvl) - Number(a.tvl))
      .map((p) => ({
        ...p,
        pool_id: String(p.pool_id),
        tvl: String(p.tvl),
      })) as unknown as Pool[];

    return {
      pools: filteredPools,
    };
  }

  let isChartDataReady = $state(false);
  $effect(() => {
    isChartDataReady = Boolean(selectedPool && token && ckusdtToken);
  });

  // Add helper function to calculate pool share
  function calculatePoolShare(
    pool: Pool,
    userBalance: FE.UserPoolBalance | undefined,
  ): string {
    if (!userBalance || !pool.lp_token_supply) return "0%";

    const userLPBalance = BigInt(userBalance.balance || 0);
    const totalLPSupply = BigInt(pool.lp_token_supply);

    if (totalLPSupply === 0n) return "0%";

    const sharePercentage =
      Number((userLPBalance * 10000n) / totalLPSupply) / 100;
    return `${sharePercentage.toFixed(2)}%`;
  }

  // Add derived value for user balances
  let userBalances = $state<FE.UserPoolBalance[]>([]);
  $effect(() => {
    userBalances = ($userPoolBalances || [])
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
      (a, b) => (Number(b.metrics.market_cap) || 0) - (Number(a.metrics.market_cap) || 0),
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

  let candleData: CandleData[] = $state([]);
  let lineChartPath = $state("");

  // Fetch candle data for the past week
  onMount(async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - 10 * 24 * 60 * 60; // 10 days ago

      const payTokenId = token?.token_id || 1;
      const receiveTokenId = ckusdtToken?.token_id || 10;

      const data = await fetchChartData(
        payTokenId,
        receiveTokenId,
        startTime,
        now,
        "D", // Daily data
      );

      lineChartPath = generateLineChartPath(data);
      candleData = data.filter(
        (d) => d.close_price !== undefined && d.close_price !== null,
      );
    } catch (error) {
      console.error("Failed to fetch candle data:", error);
    }
  });

  const maxPrice = $state(
    Math.max(...candleData.map((d) => Number(d.close_price))),
  );
  const minPrice = $state(
    Math.min(...candleData.map((d) => Number(d.close_price))),
  );
  const priceRange = $state(maxPrice - minPrice || 1); // Avoid division by zero

  // Fix SVG path generation
  function generateLineChartPath(data: CandleData[]) {
    if (!data || data.length === 0) return "";

    const validData = data.filter(
      (d) =>
        typeof d.close_price === "number" &&
        !isNaN(d.close_price) &&
        d.close_price !== null,
    );

    if (validData.length === 0) return "";

    const maxPrice = Math.max(...validData.map((d) => Number(d.close_price)));
    const minPrice = Math.min(...validData.map((d) => Number(d.close_price)));
    const priceRange = maxPrice - minPrice || 1; // Avoid division by zero

    return validData
      .map((d, i) => {
        const x = (i / (validData.length - 1)) * 100;
        const y = 30 - ((Number(d.close_price) - minPrice) / priceRange) * 30;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  // Update convertToken function to handle the type conversion correctly
  function convertToken(token: FE.Token | null): FE.Token | null {
    if (!token) return null;

    const converted = {
      ...token,
      price: Number(token.price || 0),
      metrics: {
        ...token.metrics,
        price: token.metrics?.price || "0",
        market_cap: token.metrics?.market_cap || "0",
        volume_24h: token.metrics?.volume_24h || "0",
      },
    };

    return converted as unknown as FE.Token;
  }

  // Update the formatTimestamp function to handle UTC dates correctly
  function formatTimestamp(timestamp: string): string {
    if (!timestamp) {
      console.log("formatTimestamp: No timestamp provided");
      return "N/A";
    }

    try {
      // Parse timestamp as UTC and adjust year if needed
      const txDate = new Date(timestamp + "Z"); // Force UTC interpretation
      const now = new Date();

      return formatDistance(txDate, now, {
        addSuffix: true,
        includeSeconds: true,
      });
    } catch (e) {
      console.error("Error formatting timestamp:", e);
      return "N/A";
    }
  }
</script>

<div class="p-4">
  {#if !$formattedTokens || !$poolStore?.pools}
    <div class="text-white">Loading token data...</div>
  {:else if !token}
    <div class="text-white">Token not found: {tokenAddress}</div>
  {:else}
    <div class="flex flex-col max-w-[1300px] mx-auto gap-6">
      <!-- Token Header -->
      <div class="w-full">
        <div class="max-w-[1300px] mx-auto flex flex-col gap-4">
          <!-- Back Button -->
          <a
            href="/stats"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#2a2d3d] hover:bg-[#2a2d3d]/80 text-white/90 rounded-lg transition-colors duration-200 w-fit"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L4.414 9H17a1 1 0 110 2H4.414l5.293 5.293a1 1 0 010 1.414z" clip-rule="evenodd" />
            </svg>
            Back
          </a>

          <!-- Token Info -->
          <div class="flex flex-col md:flex-row md:items-center gap-4">
            <div class="flex items-center gap-4">
              <TokenImages
                tokens={token ? [convertToken(token)] : []}
                size={48}
                overlap={0}
              />
              <div>
                <h1 class="text-2xl font-bold text-white">{token.name}</h1>
                <div class="text-[#8890a4]">{token.symbol}</div>
              </div>
            </div>

            <!-- Canister ID -->
            <div class="flex-1 md:flex md:justify-end">
              <div class="bg-[#2a2d3d] px-4 py-2 rounded-lg flex items-center justify-between gap-3 w-full md:w-auto">
                <div class="truncate">
                  <span class="text-[#8890a4] text-sm">{token.canister_id}</span>
                </div>
                <button
                  class="p-1.5 hover:bg-white/10 rounded-md transition-colors duration-200 flex-shrink-0"
                  on:click={() => {
                    navigator.clipboard.writeText(token.canister_id);
                    toastStore.success("Canister ID copied!", 2000);
                  }}
                  title="Copy canister ID"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[#8890a4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
        <!-- Price Panel -->
        <Panel
          variant="blue"
          type="secondary"
          className="relative !p-0 overflow-hidden group hover:bg-slate-800/50 transition-colors duration-200"
        >
          <div class="absolute inset-0">
            <svg
              class="w-full h-full opacity-40"
              viewBox="0 0 100 30"
              preserveAspectRatio="none"
            >
              <path
                d={`M0 30 L0 ${candleData.length > 0 ? 30 - ((Number(candleData[0]?.close_price) - minPrice) / priceRange) * 30 : 30} ` +
                  lineChartPath +
                  ` L100 30 Z`}
                class="fill-purple-500/20"
              />
              <path
                d={lineChartPath}
                class="stroke-purple-500/40 fill-none"
                stroke-width="0.5"
              />
            </svg>
          </div>
          <div class="relative p-4">
            <div class="text-sm text-slate-400 mb-1">Price</div>
            <div class="text-lg md:text-xl font-semibold text-white">
              {formatUsdValue(token?.price || 0)}
            </div>
            <div class="text-sm mt-1">
              <span
                class={`${Number(token?.metrics?.price_change_24h || 0) >= 0 ? "text-green-400" : "text-red-400"}`}
              >
                {Number(token?.metrics?.price_change_24h || 0) >= 0
                  ? "+"
                  : ""}{token?.metrics?.price_change_24h}%
              </span>
              <span class="text-slate-400 ml-1">24h</span>
            </div>
          </div>
        </Panel>

        <!-- 24h Volume Panel -->
        <Panel
          variant="blue"
          type="secondary"
          className="relative !p-0 overflow-hidden group hover:bg-slate-800/50 transition-colors duration-200"
        >
          <div class="absolute inset-0">
            <svg
              class="w-full h-full opacity-40"
              viewBox="0 0 100 30"
              preserveAspectRatio="none"
            >
              <path
                d="M0 30 L0 10 Q25 25 50 10 T100 10 L100 30 Z"
                class="fill-purple-500/20"
              />
              <path
                d="M0 10 Q25 25 50 10 T100 10"
                class="stroke-purple-500/40 fill-none"
                stroke-width="0.5"
              />
            </svg>
          </div>
          <div class="relative p-4">
            <div class="text-sm text-slate-400 mb-1">24h Volume</div>
            <div class="text-lg md:text-xl font-semibold text-white truncate">
              {formatUsdValue(Number(token.metrics.volume_24h))}
            </div>
            <div class="text-sm text-slate-400 mt-1">
              {token.metrics.volume_24h
                ? `${calculateVolumePercentage(Number(token.metrics.volume_24h), Number(token.metrics.market_cap))} of mcap`
                : "No volume data"}
            </div>
          </div>
        </Panel>

        <!-- Market Cap Panel -->
        <Panel
          variant="blue"
          type="secondary"
          className="relative !p-0 overflow-hidden group hover:bg-slate-800/50 transition-colors duration-200"
        >
          <div class="absolute inset-0">
            <svg
              class="w-full h-full opacity-40"
              viewBox="0 0 100 30"
              preserveAspectRatio="none"
            >
              <path
                d="M0 30 L0 10 Q25 25 50 10 T100 10 L100 30 Z"
                class="fill-green-500/20"
              />
              <path
                d="M0 10 Q25 25 50 10 T100 10"
                class="stroke-green-500/40 fill-none"
                stroke-width="0.5"
              />
            </svg>
          </div>
          <div class="relative p-4">
            <div class="text-sm text-slate-400 mb-1">Market Cap</div>
            <div class="text-lg md:text-xl font-semibold text-white truncate">
              {formatUsdValue(token?.metrics?.market_cap)}
            </div>
            <div class="text-sm text-slate-400 mt-1">
              Rank #{marketCapRank !== null ? marketCapRank : "N/A"}
            </div>
          </div>
        </Panel>

        <!-- Total Supply Panel -->
        <Panel
          variant="blue"
          type="secondary"
          className="relative !p-0 overflow-hidden group hover:bg-slate-800/50 transition-colors duration-200"
        >
          <div class="absolute inset-0">
            <svg
              class="w-full h-full opacity-40"
              viewBox="0 0 100 30"
              preserveAspectRatio="none"
            >
              <path
                d="M0 30 L0 10 Q25 25 50 10 T100 10 L100 30 Z"
                class="fill-orange-500/20"
              />
              <path
                d="M0 10 Q25 25 50 10 T100 10"
                class="stroke-orange-500/40 fill-none"
                stroke-width="0.5"
              />
            </svg>
          </div>
          <div class="relative p-4">
            <div class="text-sm text-slate-400 mb-1">Total Supply</div>
            <div class="text-lg md:text-xl font-semibold text-white truncate">
              {token?.metrics?.total_supply
                ? formatToNonZeroDecimal(
                    Number(token.metrics?.total_supply) / 10 ** token.decimals,
                  )
                : "0"}
            </div>
            <div class="text-sm text-slate-400 mt-1">
              {token?.symbol || ""} tokens
            </div>
          </div>
        </Panel>
      </div>

      <!-- Chart Section -->
      <Panel variant="blue" type="main" className="!p-0 flex-1">
        <div class="h-[400px] md:h-[calc(100vh-500px)] min-h-[500px] w-full">
          {#if isChartDataReady}
            <TradingViewChart
              poolId={selectedPool ? Number(selectedPool.pool_id) : 0}
              symbol={token
                ? `${token.symbol}/${
                    token.symbol === "ckUSDT"
                      ? $formattedTokens?.find(
                          (t) =>
                            t.canister_id ===
                            (selectedPool?.address_0 === token.canister_id
                              ? selectedPool?.address_1
                              : selectedPool?.address_0),
                        )?.symbol || "Unknown"
                      : "ckUSDT"
                  }`
                : ""}
              toToken={token ? convertToken(token) : null}
              fromToken={ckusdtToken ? convertToken(ckusdtToken) : null}
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
        <Panel variant="blue" type="main" className="flex-1 md:w-1/2 !p-0">
          <div class="flex flex-col h-[600px] w-full">
            <div class="p-4">
              <h2 class="text-2xl font-semibold text-white/80">Token Pools</h2>
            </div>
            <div class="flex-1 overflow-y-auto p-4">
              {#if !$poolStore?.pools || !token}
                <div class="text-white">Loading pools...</div>
              {:else}
                {@const paginatedData = getPaginatedPools($poolStore.pools)}
                <div class="flex-1 overflow-y-auto">
                  {#each paginatedData.pools as pool}
                    <div
                      class="border-b border-slate-700/70 hover:bg-slate-800/30 transition-colors duration-200 p-4"
                    >
                      <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-3">
                          {#if $formattedTokens}
                            <TokenImages
                              tokens={[
                                token,
                                $formattedTokens.find(
                                  (t) =>
                                    t.canister_id ===
                                    (pool.address_0 === token.canister_id
                                      ? pool.address_1
                                      : pool.address_0),
                                ),
                              ].filter((t): t is FE.Token => Boolean(t))}
                              size={32}
                              overlap={12}
                            />
                          {/if}
                          <div>
                            <div class="text-white font-medium">
                              {token.symbol} /
                              {$formattedTokens?.find(
                                (t) =>
                                  t.canister_id ===
                                  (pool.address_0 === token.canister_id
                                    ? pool.address_1
                                    : pool.address_0),
                              )?.symbol || "Unknown"}
                            </div>
                            <div class="text-xs text-slate-400">
                              Pool #{pool.pool_id}
                            </div>
                          </div>
                        </div>
                        <div class="hidden sm:block">
                          <a
                            href="/swap?from={pool.address_0}&to={pool.address_1}"
                            class="inline-block px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-full hover:bg-blue-500/30 transition-colors duration-200"
                          >
                            Trade
                          </a>
                        </div>
                      </div>
                      <div
                        class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm"
                      >
                        <div>
                          <div class="text-slate-400 text-xs mb-1">TVL</div>
                          <div class="text-white font-medium">
                            {formatUsdValue(Number(pool.tvl))}
                          </div>
                        </div>
                        <div>
                          <div class="text-slate-400 text-xs mb-1">
                            24h Volume
                          </div>
                          <div class="text-white font-medium">
                            {formatUsdValue(Number(pool.daily_volume || 0))}
                          </div>
                        </div>
                        <div>
                          <div class="text-slate-400 text-xs mb-1">APY</div>
                          <div class="text-white font-medium">{pool.apy}%</div>
                        </div>
                        <div>
                          <div class="text-slate-400 text-xs mb-1">
                            My Share
                          </div>
                          <div class="text-white font-medium">
                            {calculatePoolShare(
                              pool,
                              userBalances.find(
                                (b) =>
                                  b.symbol_0 === pool.symbol_0 &&
                                  b.symbol_1 === pool.symbol_1,
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                      <div class="mt-3 sm:hidden">
                        <a
                          href="/swap?from={pool.address_0}&to={pool.address_1}"
                          class="block w-full text-center px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-full hover:bg-blue-500/30 transition-colors duration-200"
                        >
                          Trade
                        </a>
                      </div>
                    </div>
                  {/each}

                  {#if paginatedData.pools.length === 0}
                    <div
                      class="flex flex-col items-center justify-center h-full text-center py-8"
                    >
                      <div class="text-slate-400 mb-2">No pools found</div>
                      <div class="text-sm text-slate-500">
                        There are currently no liquidity pools for this token
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </Panel>

        <TransactionFeed token={token} />
      </div>
    </div>
  {/if}
</div>
<style>
  :global(.tv-lightweight-charts) {
    font-family: inherit !important;
    width: 100% !important;
    height: 100% !important;
  }

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
