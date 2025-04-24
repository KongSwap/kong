<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import TradingViewChart from "$lib/components/common/TradingViewChart.svelte";
  import { fetchPoolsForCanister } from "$lib/stores/poolStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import { AlertTriangle } from 'lucide-svelte';
  import TransactionFeed from "$lib/components/stats/TransactionFeed.svelte";
  import { goto } from "$app/navigation";
  import {
    CKUSDC_CANISTER_ID,
    CKUSDT_CANISTER_ID,
  } from "$lib/constants/canisterConstants";
  import SNSProposals from "$lib/components/stats/SNSProposals.svelte";
  import TokenStatistics from "./TokenStatistics.svelte";
  import { GOVERNANCE_CANISTER_IDS } from "$lib/utils/snsUtils";
  import { tokenData } from "$lib/stores/tokenData";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { browser } from "$app/environment";
  import PoolStatistics from "./PoolStatistics.svelte";
  import { snsService } from '$lib/utils/snsUtils';

  // Token and loading states
  let isTokenLoading = $state(true);
  let isPoolsLoading = $state(false);
  let token = $state<Kong.Token | undefined>(undefined);
  let chartInstance = $state(0);
  let chartMounted = $state(false);
  let isChartDataReady = $state(false);

  // Pool and selection states
  let selectedPool = $state<BE.Pool | undefined>(undefined);
  let hasManualSelection = $state(false);
  let initialPoolSet = $state(false);
  let relevantPools = $state<BE.Pool[]>([]);

  // UI states
  let hasActiveProposals = $state(false);
  let checkingProposals = $state(false);
  let activeTab = $state<"overview" | "governance">("overview");
  let showDropdown = $state(false);
  let dropdownButtonRef = $state<HTMLButtonElement | null>(null);
  let dropdownRef = $state<HTMLElement | null>(null);

  // Fetch token data when page loads or ID changes
  $effect(() => {
    const pageId = $page.params.id;
    if (!pageId) return;
    
    // Reset UI state
    activeTab = "overview";
    showDropdown = false;
    hasActiveProposals = false;
    checkingProposals = false;
    
    const fetchToken = async () => {
      try {
        isTokenLoading = true;
        isChartDataReady = false;
        chartInstance = 0;
        chartMounted = false;
        token = undefined;
        selectedPool = undefined;
        relevantPools = [];

        // Try direct API fetch
        const fetchedTokens = await fetchTokensByCanisterId([pageId]);
        if (fetchedTokens?.length > 0) {
          token = fetchedTokens[0];
          isTokenLoading = false;
          
          // After token is loaded, check for governance proposals if applicable
          if (token?.address && GOVERNANCE_CANISTER_IDS[token.address]) {
            checkActiveProposals(GOVERNANCE_CANISTER_IDS[token.address]);
          }
          return;
        }

        // Fallback to store data
        const data = $tokenData;
        if (data?.length > 0) {
          const foundToken =
            data.find((t) => t.address === pageId);
          if (foundToken) {
            token = foundToken;
          }
        }
      } catch (error) {
        console.error("Error fetching token:", error);
      } finally {
        isTokenLoading = false;
      }
    };

    fetchToken();
  });

  // Fetch pools when token changes
  $effect(() => {
    if (token?.address) {
      // Reset selection state
      hasManualSelection = false;
      initialPoolSet = false;
      selectedPool = undefined;
      isPoolsLoading = true;

      fetchPoolsForCanister(token.address)
        .then((pools) => {
          const poolsWithTvl = pools.filter((p) => Number(p.tvl) > 0);
          // Sort by volume
          relevantPools = poolsWithTvl.sort(
            (a, b) => Number(b.volume_24h || 0) - Number(a.volume_24h || 0),
          );

          // Auto-select pool if no manual selection
          if (!hasManualSelection && relevantPools.length > 0) {
            // For CKUSDT, prioritize the CKUSDC/CKUSDT pool
            if (token.address === CKUSDT_CANISTER_ID) {
              const ckusdcPool = relevantPools.find((p) => {
                const isCorrectPair =
                  (p.address_0 === CKUSDC_CANISTER_ID &&
                    p.address_1 === CKUSDT_CANISTER_ID) ||
                  (p.address_0 === CKUSDT_CANISTER_ID &&
                    p.address_1 === CKUSDC_CANISTER_ID);
                return isCorrectPair && Number(p.tvl) > 0;
              });

              if (ckusdcPool) {
                selectedPool = ckusdcPool;
                initialPoolSet = true;
                return;
              }
            }

            // Otherwise select highest TVL pool
            const highestTvlPool = [...relevantPools].sort((a, b) => {
              const tvlDiff = Number(b.tvl) - Number(a.tvl);
              if (tvlDiff !== 0) return tvlDiff;
              return Number(b.volume_24h || 0) - Number(a.volume_24h || 0);
            })[0];

            if (highestTvlPool) {
              selectedPool = highestTvlPool;
              initialPoolSet = true;
            }
          }
        })
        .catch((error) => {
          console.error("Error fetching pools:", error);
        })
        .finally(() => {
          isPoolsLoading = false;
        });
    } else {
      relevantPools = [];
    }
  });

  // Handle chart data readiness
  $effect(() => {
    // Restore check for token and selectedPool
    if (!token || !selectedPool) { 
      if (isChartDataReady) isChartDataReady = false;
      return;
    }

    // Check if core data is ready for chart
    const dataReady = Boolean(
      selectedPool.pool_id &&
        (selectedPool.symbol_0 || selectedPool.token0?.symbol) &&
        (selectedPool.symbol_1 || selectedPool.token1?.symbol)
    );

    if (dataReady !== isChartDataReady) {
      if (dataReady && !chartMounted) {
        chartInstance++;
        chartMounted = true;
      }
      isChartDataReady = dataReady;
    }
  });

  // Market cap rank calculation
  let marketCapRank = $state<number | null>(null);
  $effect(() => {
    const pageId = $page.params.id;
    if (!$tokenData || !pageId) {
      marketCapRank = null;
      return;
    }
    
    const foundToken = $tokenData.find(
      (t) => t.address === pageId || t.address === pageId
    );
    if (!foundToken) {
      marketCapRank = null;
      return;
    }
    const sortedTokens = [...$tokenData].sort(
      (a, b) =>
        (Number(b.metrics.market_cap) || 0) -
        (Number(a.metrics.market_cap) || 0),
    );
    const rank = sortedTokens.findIndex(
      (t) => t.address === foundToken.address,
    );
    marketCapRank = rank !== -1 ? rank + 1 : null;
  });

  // Calculate total token TVL
  let totalTokenTvl = $derived(relevantPools.reduce((sum, pool) => sum + Number(pool.tvl), 0));

  // Handle click outside dropdown
  const handleClickOutside = (event: MouseEvent | TouchEvent) => {
    if (!showDropdown) return;
    const target = event.target as Node;
    if (!(dropdownButtonRef?.contains(target) || dropdownRef?.contains(target))) {
      showDropdown = false;
    }
  };

  onMount(() => {
    // Initialize chart if data is available
    if (token && selectedPool && !chartMounted) {
      setTimeout(() => {
        chartInstance++;
        chartMounted = true;
      }, 100);
    }

    if(browser) {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("touchend", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("touchend", handleClickOutside);
    };
  });

  // Helper function for chart symbol display
  function getChartSymbol() {
    if (!token || !selectedPool) return "";
    
    const quoteSymbol = selectedPool.address_0 === token.address
      ? selectedPool.token1?.symbol ||
        selectedPool.symbol_1 ||
        $tokenData?.find(t => t.address === selectedPool.address_1)?.symbol ||
        "Unknown"
      : selectedPool.token0?.symbol ||
        selectedPool.symbol_0 ||
        $tokenData?.find(t => t.address === selectedPool.address_0)?.symbol ||
        "Unknown";
        
    return `${token.symbol}/${quoteSymbol}`;
  }

  // Helper function for quote token in chart
  function getQuoteToken() {
    if (!selectedPool) return undefined;
    
    if (selectedPool.address_0 === token?.address) {
      return selectedPool.token1 ||
        $tokenData?.find(t => t.address === selectedPool.address_1)
    } else {
      return selectedPool.token0 ||
        $tokenData?.find(t => t.address === selectedPool.address_0)
    }
  }

  // Function to check for active proposals
  async function checkActiveProposals(governanceId: string) {
    checkingProposals = true;
    try {
      // Fetch first 5 proposals to check for any 'open' ones
      const result = await snsService.getProposals(governanceId, 5);
       hasActiveProposals = result.proposals.some(p => p.status === 'open');
     } catch (error) {
       console.error("Error checking for active proposals:", error);
       hasActiveProposals = false; // Assume none if error occurs
     } finally {
       checkingProposals = false;
     }
   }
</script>

<svelte:head>
  <title>{token?.name || 'Token'} {token?.symbol ? `(${token.symbol})` : ''} Chart and Stats - KongSwap</title>
</svelte:head>

<div class="p-4 pt-0">
  {#if isTokenLoading}
    <div class="flex flex-col items-center justify-center min-h-[300px]">
      <div class="loader mb-4"></div>
      <div class="text-kong-text-primary/70">Loading token data...</div>
    </div>
  {:else if !token}
    <div class="flex flex-col items-center justify-center min-h-[300px]">
      <div class="text-kong-text-primary/70">Token not found</div>
      <button
        class="mt-4 px-4 py-2 bg-kong-bg-dark rounded-lg hover:bg-kong-bg-dark/80 transition-colors"
        on:click={() => goto("/stats")}
      >
        Return to Stats
      </button>
    </div>
  {:else}
    <!-- Active Proposals Alert -->
    {#if hasActiveProposals}
      <div class="max-w-[1300px] mx-auto mb-4">
        <div class="bg-kong-primary/10 border border-kong-primary/30 text-kong-primary rounded-lg p-3 flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <AlertTriangle size={18} />
            <span class="text-sm font-medium">Active governance proposals found.</span>
          </div>
          <button 
            class="text-sm font-semibold hover:underline flex-shrink-0"
            on:click={() => activeTab = 'governance'}
          >
            View Governance →
          </button>
        </div>
      </div>
    {/if}

    <div class="flex flex-col max-w-[1300px] mx-auto gap-4">
      <!-- Token Header -->


      <!-- Tab Content -->
      {#if activeTab === "overview"}
        <div
          role="tabpanel"
          id="overview-panel"
          aria-labelledby="overview-tab"
          tabindex="0"
        >
          <!-- Overview Layout -->
          <div class="flex flex-col lg:flex-row gap-4">
            <!-- Mobile-first layout -->
            <div class="flex flex-col gap-4 w-full lg:hidden">
              <!-- Token Statistics -->
              <TokenStatistics
                {token}
                marketCapRank={token?.metrics?.market_cap_rank ?? null}
                {selectedPool}
                {totalTokenTvl}
              />
              
              <!-- Pool Statistics -->
              {#if selectedPool}
                <PoolStatistics 
                  {selectedPool} 
                  {token} 
                  {relevantPools}
                  onPoolSelect={(pool) => {
                    hasManualSelection = true;
                    selectedPool = pool;
                  }}
                />
              {/if}

              <!-- Chart Panel -->
              <Panel
                type="main"
                className=""
              >
                <div class="h-[450px] min-h-[400px] w-full">
                  {#if isChartDataReady}
                    {@const currentBaseToken = token}
                    {@const currentQuoteToken = getQuoteToken()}
                    {#if currentBaseToken && currentQuoteToken} 
                      <div class="h-full w-full">
                        {#key chartInstance}
                          <TradingViewChart
                            poolId={selectedPool ? Number(selectedPool.pool_id) : 0}
                            symbol={getChartSymbol()}
                            quoteToken={currentQuoteToken}
                            baseToken={currentBaseToken}
                          />
                        {/key}
                      </div>
                    {:else}
                      <div class="flex items-center justify-center h-full">
                         <div class="loader"></div>
                         <div class="ml-3 text-kong-text-secondary">
                           Loading token data for chart...
                         </div>
                       </div>
                    {/if}
                  {:else}
                    <div class="flex items-center justify-center h-full">
                      <div class="loader"></div>
                    </div>
                  {/if}
                </div>
              </Panel>

              <!-- Transactions Panel -->
              {#if token && token.address === $page.params.id}
                <TransactionFeed {token} className="w-full !p-0" />
              {/if}
            </div>

            <!-- Desktop layout -->
            <div class="hidden lg:flex lg:flex-row gap-6 w-full">
              <!-- Left Column - Chart and Transactions -->
              <div class="lg:w-[70%] flex flex-col gap-6">
                <!-- Chart Panel -->
                <Panel
                  type="main"
                  className="!p-0"
                >
                  <div class="h-[450px] min-h-[400px] w-full">
                    {#if isChartDataReady}
                      {@const currentBaseToken = token}
                      {@const currentQuoteToken = getQuoteToken()}
                      {#if currentBaseToken && currentQuoteToken} 
                        <div class="h-full w-full">
                          {#key chartInstance}
                            <TradingViewChart
                              poolId={selectedPool ? Number(selectedPool.pool_id) : 0}
                              symbol={getChartSymbol()}
                              quoteToken={currentQuoteToken}
                              baseToken={currentBaseToken}
                            />
                          {/key}
                        </div>
                      {:else}
                        <div class="flex items-center justify-center h-full">
                           <div class="loader"></div>
                           <div class="ml-3 text-kong-text-secondary">
                             Loading token data for chart...
                           </div>
                         </div>
                      {/if}
                    {:else}
                      <div class="flex items-center justify-center h-full">
                        <div class="loader"></div>
                      </div>
                    {/if}
                  </div>
                </Panel>

                <!-- Transactions Panel -->
                {#if token && token.address === $page.params.id}
                  <TransactionFeed {token} className="w-full !p-0" />
                {/if}
              </div>

              <!-- Right Column - Stats -->
              <div class="lg:w-[30%] flex flex-col gap-4">
                <TokenStatistics
                  {token}
                  marketCapRank={token?.metrics?.market_cap_rank ?? null}
                  {selectedPool}
                  {totalTokenTvl}
                />
                
                <!-- Pool Statistics -->
                {#if selectedPool}
                  <PoolStatistics 
                    {selectedPool} 
                    {token} 
                    {relevantPools}
                    onPoolSelect={(pool) => {
                      hasManualSelection = true;
                      selectedPool = pool;
                    }}
                  />
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if activeTab === "governance" && token?.address && GOVERNANCE_CANISTER_IDS[token.address]}
        <div
          role="tabpanel"
          id="governance-panel"
          aria-labelledby="governance-tab"
          tabindex="0"
        >
          <!-- Governance layout -->
          <div class="flex flex-col lg:flex-row gap-6">
            <!-- Left Column - Proposals -->
            <div class="lg:w-[70%]">
              <SNSProposals
                governanceCanisterId={GOVERNANCE_CANISTER_IDS[token.address]}
              />
            </div>

            <!-- Right Column - Stats -->
            <div class="lg:w-[30%] flex flex-col gap-4">
              <Panel type="main">
                <div class="flex flex-col gap-4">
                  <h2 class="text-lg font-semibold">About Governance</h2>
                  <div class="text-kong-text-secondary">
                    <p class="mb-2">
                      {token.symbol} token holders can participate in governance
                      by:
                    </p>
                    <ul class="list-disc pl-4 space-y-1">
                      <li>Submitting proposals</li>
                      <li>Voting on active proposals</li>
                      <li>Discussing community initiatives</li>
                    </ul>
                  </div>
                  <a
                    href={`https://nns.ic0.app/proposals/?u=${token.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-kong-primary hover:underline mt-2"
                  >
                    View on IC Dashboard →
                  </a>
                </div>
              </Panel>
              <TokenStatistics
                {token}
                marketCapRank={token?.metrics?.market_cap_rank ?? null}
                {selectedPool}
                {totalTokenTvl}
              />
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
