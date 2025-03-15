<script lang="ts">
  import { page } from "$app/stores";
  import { onDestroy, onMount } from "svelte";
  import TradingViewChart from "$lib/components/common/TradingViewChart.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { fetchPoolsForCanister } from "$lib/services/pools/poolStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import TransactionFeed from "$lib/components/stats/TransactionFeed.svelte";
  import { goto } from "$app/navigation";
  import {
    CKUSDC_CANISTER_ID,
    CKUSDT_CANISTER_ID,
    ICP_CANISTER_ID,
  } from "$lib/constants/canisterConstants";
  import PoolSelector from "$lib/components/stats/PoolSelector.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import {
    Droplets,
    ArrowLeftRight,
    Copy,
    PlusCircle,
    ChevronDown,
  } from "lucide-svelte";
  import SNSProposals from "$lib/components/stats/SNSProposals.svelte";
  // @ts-ignore - This component doesn't have a default export but works in Svelte
  import TokenStatistics from "./TokenStatistics.svelte";
  import { GOVERNANCE_CANISTER_IDS } from "$lib/services/sns/snsService";
  import { copyToClipboard } from "$lib/utils/clipboard";
  import { toastStore } from "$lib/stores/toastStore";
  import { tokenData } from "$lib/stores/tokenData";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import { afterNavigate } from "$app/navigation";

  // Add loading state for token lookup
  let isTokenLoading = $state(true);
  // Add loading state for pools
  let isPoolsLoading = $state(false);
  // Add a flag to prevent concurrent fetches

  // Add back the necessary state variables at the top
  let token = $state<FE.Token | undefined>(undefined);
  let refreshInterval: NodeJS.Timeout;
  
  // Add back the isChartDataReady state and effect
  let isChartDataReady = $state(false);
  let chartInstance = $state<number>(0);
  let chartMounted = $state(false);
  
  // Add a function to force chart reinitialization
  const forceChartReinit = () => {
    console.log('Forcing chart reinitialization');
    isChartDataReady = false;
    setTimeout(() => {
      chartInstance++;
      chartMounted = true;
    }, 100);
  };
  
  // Listen for navigation events - this is the ONLY place we should reset state on navigation
  afterNavigate(({ from, to }) => {
    // Check if we're navigating between different token pages
    const fromId = from?.params?.id;
    const toId = to?.params?.id;
    
    if (fromId && toId && fromId !== toId) {
      console.log(`Navigation between token pages: ${fromId} -> ${toId}`);
      
      // Force a complete reset of the chart state
      setTimeout(() => {
        console.log('Forcing chart reset after navigation');
        isChartDataReady = false;
        chartInstance = 0;
        chartMounted = false;
        
        // Reset pool selection state
        hasManualSelection = false;
        initialPoolSet = false;
        selectedPool = undefined;
        relevantPools = [];
        
        // Force token reload by setting loading state
        isTokenLoading = true;
      }, 0);
    }
  });

  // Derived values
  let ckusdtToken = $state<FE.Token | undefined>(undefined);
  $effect(() => {
    const found = $tokenData?.find((t) => t.symbol === "ckUSDT");
    if (found) {
      ckusdtToken = found;
    }
  });

  let icpToken = $state<FE.Token | undefined>(undefined);
  $effect(() => {
    const found = $tokenData?.find((t) => t.canister_id === ICP_CANISTER_ID);
    if (found) {
      icpToken = found;
    }
  });

  // Update the token lookup effect
  $effect.root(() => {
    const fetchToken = async () => {
      try {
        const pageId = $page.params.id;
        if (!pageId) return;
        
        // Start loading
        isTokenLoading = true;
        
        // Reset chart state on token change
        isChartDataReady = false;
        chartInstance = 0;
        
        console.log(`Fetching token data for ID: ${pageId}`);
        
        // First try direct API fetch for the specific token
        const fetchedTokens = await fetchTokensByCanisterId([pageId]);
        if (fetchedTokens && fetchedTokens.length > 0) {
          token = fetchedTokens[0];
          isTokenLoading = false;
          return;
        }
        
        // If direct fetch doesn't return a token, check the store data
        const data = $tokenData;
        if (data?.length > 0) {
          // Try to find by canister_id first, then by address as fallback
          const foundToken = data.find((t) => t.canister_id === pageId) || 
                         data.find((t) => t.address === pageId);
          if (foundToken) {
            token = foundToken;
            isTokenLoading = false;
            return;
          }
        }
        
        // If we got here, token wasn't found
        isTokenLoading = false;
      } catch (error) {
        console.error("Error fetching token:", error);
        isTokenLoading = false;
      }
    };
    
    fetchToken();
    
    // Set up refresh interval for token data
    refreshInterval = setInterval(async () => {
      if (!token?.canister_id) return;
      try {
        const updatedTokens = await fetchTokensByCanisterId([token.canister_id]);
        if (updatedTokens && updatedTokens.length > 0) {
          token = updatedTokens[0];
        }
      } catch (error) {
        console.error("Error refreshing token data:", error);
      }
    }, 60000); // Refresh every minute
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  });

  // Add $effect to trigger pool loading when token changes
  $effect(() => {
    if (token?.canister_id) {
      console.log(`Token changed to ${token.symbol} (${token.canister_id}), fetching pools...`);
      // Reset selection state when token changes
      hasManualSelection = false;
      initialPoolSet = false;
      selectedPool = undefined;
      
      // Set loading state
      isPoolsLoading = true;
      
      // Use the centralized pool fetching function from poolStore
      fetchPoolsForCanister(token.canister_id).then(pools => {
        isPoolsLoading = false;
        console.log(`Received ${pools.length} pools for ${token.symbol}`);
        
        // Filter pools with TVL > 0
        const poolsWithTvl = pools.filter(p => Number(p.tvl) > 0);
        console.log(`After filtering for TVL > 0: ${poolsWithTvl.length} pools`);
        
        // Sort by volume
        relevantPools = poolsWithTvl.sort((a, b) => 
          Number(b.volume_24h || 0) - Number(a.volume_24h || 0)
        );
          
        // Auto-select a pool if we have pools and haven't manually selected one
        if (!hasManualSelection && relevantPools.length > 0) {
          // For CKUSDT, prioritize the CKUSDC/CKUSDT pool if it exists and has TVL
          if (token.canister_id === CKUSDT_CANISTER_ID) {
            console.log('Looking for CKUSDC/CKUSDT pool...');
            const ckusdcPool = relevantPools.find((p) => {
              const isCorrectPair =
                (p.address_0 === CKUSDC_CANISTER_ID &&
                  p.address_1 === CKUSDT_CANISTER_ID) ||
                (p.address_0 === CKUSDT_CANISTER_ID &&
                  p.address_1 === CKUSDC_CANISTER_ID);
              const hasTVL = Number(p.tvl) > 0;
              return isCorrectPair && hasTVL;
            });

            if (ckusdcPool) {
              console.log('Found CKUSDC/CKUSDT pool, selecting it');
              selectedPool = ckusdcPool;
              initialPoolSet = true;
              return;
            }
          }
          
          // Otherwise select the pool with highest TVL
          console.log('Selecting pool with highest TVL...');
          const highestTvlPool = [...relevantPools].sort((a, b) => {
            const tvlDiff = Number(b.tvl) - Number(a.tvl);
            if (tvlDiff !== 0) return tvlDiff;
            return Number(b.volume_24h || 0) - Number(a.volume_24h || 0);
          })[0];
          
          if (highestTvlPool) {
            console.log(`Selected pool #${highestTvlPool.pool_id} with TVL ${highestTvlPool.tvl}`);
            selectedPool = highestTvlPool;
            initialPoolSet = true;
          } else {
            console.log('No pools with TVL found for selection');
          }
        } else if (relevantPools.length === 0) {
          console.log('No relevant pools found for this token');
        }
      }).catch(error => {
        isPoolsLoading = false;
        console.error("Error fetching pools:", error);
      });
    } else {
      relevantPools = [];
    }
  });

  // First try to find CKUSDT pool with non-zero TVL, then fallback to largest pool
  let selectedPool = $state<BE.Pool | undefined>(undefined);
  let hasManualSelection = $state(false);
  let initialPoolSet = $state(false);

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
    if (!$tokenData) return;
    const foundToken = $tokenData.find(
      (t) => t.address === $page.params.id || t.canister_id === $page.params.id,
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
      (t) => t.canister_id === foundToken.canister_id,
    );
    marketCapRank = rank !== -1 ? rank + 1 : null;
  });

  // Update the chart data ready effect to be more robust
  $effect(() => {
    // Only evaluate readiness if we have the basic requirements
    if (!token || !selectedPool) {
      if (isChartDataReady) {
        console.log('Chart data no longer ready - missing token or selectedPool');
        isChartDataReady = false;
      }
      return;
    }
    
    // Ensure we have both token and selectedPool, and that selectedPool is fully populated with token data
    const dataReady = Boolean(
      selectedPool.pool_id &&
      (selectedPool.symbol_0 || selectedPool.token0?.symbol) && 
      (selectedPool.symbol_1 || selectedPool.token1?.symbol)
    );
    
    // Only update if the state is changing to avoid unnecessary renders
    if (dataReady !== isChartDataReady) {
      console.log(`Chart data ready state changing: ${isChartDataReady} -> ${dataReady}`);
      
      if (dataReady) {
        // Force a re-render of the chart component by incrementing the instance counter
        chartInstance++;
        chartMounted = true;
        console.log('Chart is ready to load with data:', {
          hasToken: Boolean(token),
          hasPool: Boolean(selectedPool),
          poolId: selectedPool?.pool_id,
          symbol0: selectedPool?.symbol_0 || selectedPool?.token0?.symbol,
          symbol1: selectedPool?.symbol_1 || selectedPool?.token1?.symbol,
          isReady: dataReady,
          chartInstance
        });
      }
      
      // Update the state after logging
      isChartDataReady = dataReady;
    }
  });

  // Add tab state
  let activeTab = $state<"overview" | "pools" | "transactions" | "governance">(
    "overview",
  );
  let relevantPools = $state<BE.Pool[]>([]);

  let showDropdown = $state(false);
  let mobileButtonRef = $state<HTMLButtonElement | null>(null);
  let desktopButtonRef = $state<HTMLButtonElement | null>(null);
  let mobileDropdownRef = $state<HTMLElement | null>(null);
  let desktopDropdownRef = $state<HTMLElement | null>(null);

  // Handle click outside
  onMount(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!showDropdown) return;
      const target = event.target as Node;
      if (
        !(
          mobileButtonRef?.contains(target) ||
          mobileDropdownRef?.contains(target) ||
          desktopButtonRef?.contains(target) ||
          desktopDropdownRef?.contains(target)
        )
      ) {
        showDropdown = false;
      }
    };

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("touchend", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("touchend", handleClickOutside);
    };
  });

  // Add an onMount handler to ensure chart initialization on page load
  onMount(() => {
    console.log('Page mounted, checking chart initialization');
    // If we already have token and pool data but chart isn't mounted, force initialization
    if (token && selectedPool && !chartMounted) {
      console.log('Data available but chart not mounted, forcing initialization');
      setTimeout(forceChartReinit, 500);
    }
  });
</script>

<svelte:head> 
  <title>{token?.name} ({token?.symbol}) Chart and Stats - KongSwap</title>
</svelte:head>

<div class="p-4 pt-0">
  {#if isTokenLoading}
    <!-- Improved loading state -->
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
    <div class="flex flex-col max-w-[1300px] mx-auto gap-4">
      <!-- Token Header - Non-fixed with border radius -->
        <div class="flex flex-col gap-4">
          <!-- Token info row -->
          <div class="flex items-center justify-between">
            <!-- Left side with back button and token info -->
            <div class="flex items-center gap-4 md:gap-x-0">
              <button
                title="Back"
                aria-label="Back"
                on:click={() => goto("/stats")}
                class="flex min-h-[40px] md:min-h-[48px] flex-col items-center justify-center gap-2 pr-2.5 text-sm bg-kong-bg-secondary hover:bg-kong-bg-secondary/80 text-kong-text-primary/70 rounded-lg transition-colors duration-200 w-fit"
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

              <div class="flex items-center gap-3 md:gap-x-0">
                <TokenImages
                  tokens={token ? [token] : []}
                  size={36}
                  containerClass="md:w-12 md:h-12"
                />
                <div class="flex items-center gap-2">
                  <h1
                    class="text-lg md:text-2xl font-bold text-kong-text-primary"
                  >
                    {token?.name || "Loading..."}
                  </h1>
                  <div class="text-sm md:text-base text-[#8890a4]">
                    ({token?.symbol || "..."})
                  </div>
                </div>
              </div>
            </div>

            <!-- Desktop tabs - hidden on mobile -->
            <div class="hidden md:flex items-center gap-2 text-[#8890a4]">
              <button
                role="tab"
                id="overview-tab"
                aria-controls="overview-panel"
                aria-selected={activeTab === "overview"}
                class="px-4 py-2 rounded-lg {activeTab === 'overview'
                  ? 'bg-kong-bg-secondary text-kong-text-primary'
                  : 'hover:text-kong-text-primary'}"
                on:click={() => (activeTab = "overview")}
              >
                Overview
              </button>

              {#if token?.canister_id && GOVERNANCE_CANISTER_IDS[token.canister_id]}
                <button
                  role="tab"
                  id="governance-tab"
                  aria-controls="governance-panel"
                  aria-selected={activeTab === "governance"}
                  class="px-4 py-2 rounded-lg {activeTab === 'governance'
                    ? 'bg-kong-bg-secondary text-kong-text-primary'
                    : 'hover:text-kong-text-primary'}"
                  on:click={() => (activeTab = "governance")}
                >
                  Governance
                </button>
              {/if}
            </div>
          </div>

          <!-- Mobile tabs row - shown on mobile, hidden on desktop -->
          {#if token?.canister_id && GOVERNANCE_CANISTER_IDS[token.canister_id]}
            <div class="md:hidden flex items-center gap-2 text-[#8890a4]">
              <button
                role="tab"
                id="governance-tab-mobile"
                aria-controls="governance-panel"
                aria-selected={activeTab === "governance"}
                class="px-4 py-2 rounded-lg flex-1 {activeTab === 'governance'
                  ? 'bg-kong-bg-secondary text-kong-text-primary'
                  : 'hover:text-kong-text-primary'}"
                on:click={() => (activeTab = "governance")}
              >
                Governance
              </button>
            </div>
          {/if}
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
          <div class="flex flex-col lg:flex-row gap-4">
            <!-- Mobile-first layout -->
            <div class="flex flex-col gap-4 w-full lg:hidden">
              <!-- Pool Selector -->
              <PoolSelector
                {selectedPool}
                {token}
                formattedTokens={$tokenData}
                {relevantPools}
                isLoading={isPoolsLoading}
                onPoolSelect={(pool) => {
                  hasManualSelection = true;
                  selectedPool = pool;
                }}
              />
              <!-- Add Action Buttons for mobile -->
              <div class="flex items-center gap-2 justify-end">
                <ButtonV2
                  variant="solid"
                  size="md"
                  className="!w-1/2 text-nowrap flex justify-center"
                  on:click={() =>
                    goto(
                      `/pools/add?token0=${selectedPool?.address_0}&token1=${selectedPool?.address_1}`,
                    )}
                >
                  <div class="flex items-center gap-2">
                    <Droplets class="w-4 h-4" /> Add Liquidity
                  </div>
                </ButtonV2>
                <ButtonV2
                  variant="solid"
                  size="md"
                  className="!w-1/2 text-nowrap flex justify-center"
                  on:click={() =>
                    goto(
                      `/swap?from=${selectedPool?.address_1}&to=${selectedPool?.address_0}`,
                    )}
                >
                  <div class="flex items-center gap-2">
                    <ArrowLeftRight class="w-4 h-4" /> Swap
                  </div>
                </ButtonV2>
              </div>

              <div class="flex items-center gap-2">
                <div class="relative w-full">
                  <ButtonV2
                    bind:element={mobileButtonRef}
                    variant="outline"
                    size="md"
                    className="w-full text-nowrap"
                    on:click={() => (showDropdown = !showDropdown)}
                  >
                    <div class="flex items-center gap-2 justify-between w-full">
                      {token?.address}
                      <ChevronDown class="w-4 h-4" />
                    </div>
                  </ButtonV2>

                  <!-- Dropdown menu -->
                  {#if showDropdown}
                    <div
                      bind:this={mobileDropdownRef}
                      class="absolute right-0 top-full mt-1 w-48 bg-kong-bg-light rounded-lg shadow-lg z-50"
                    >
                      <button
                        class="w-full px-4 py-2 text-left hover:bg-kong-bg-dark/50 flex items-center gap-2 rounded-t-lg"
                        on:click={() => {
                          copyToClipboard(token?.address);
                          toastStore.info("Token address copied to clipboard");
                          showDropdown = false;
                        }}
                      >
                        <Copy class="w-4 h-4" />
                        Copy
                      </button>
                      <button
                        class="w-full px-4 py-2 text-left hover:bg-kong-bg-dark/50 flex items-center gap-2 rounded-b-lg"
                        on:click={() => {
                          window.open(
                            `https://nns.ic0.app/tokens/?import-ledger-id=${token?.canister_id}`,
                            "_blank",
                          );
                          showDropdown = false;
                        }}
                      >
                        <PlusCircle class="w-4 h-4" />
                        Import to NNS
                      </button>
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Token Statistics -->
              <TokenStatistics
                {token}
                marketCapRank={token?.metrics?.market_cap_rank ?? null}
              />

              <!-- Chart Panel -->
              <Panel
                variant="transparent"
                type="main"
                className="!p-0 border-none"
              >
                <div class="h-[450px] min-h-[400px] w-full">
                  {#if isChartDataReady}
                    {#key chartInstance}
                      <div class="h-full w-full" id="mobile-chart-container">
                        <TradingViewChart
                          poolId={selectedPool ? Number(selectedPool.pool_id) : 0}
                          symbol={token && selectedPool
                            ? `${token.symbol}/${
                                selectedPool.address_0 === token.canister_id
                                  ? (selectedPool.token1?.symbol || 
                                     selectedPool.symbol_1 || 
                                     $tokenData?.find(t => t.canister_id === selectedPool.address_1)?.symbol || 
                                     'Unknown')
                                  : (selectedPool.token0?.symbol || 
                                     selectedPool.symbol_0 || 
                                     $tokenData?.find(t => t.canister_id === selectedPool.address_0)?.symbol || 
                                     'Unknown')
                              }`
                            : ""}
                          quoteToken={selectedPool?.address_0 === token?.canister_id
                            ? (selectedPool.token1 || 
                               $tokenData?.find(t => t.canister_id === selectedPool.address_1) || 
                               { 
                                 canister_id: selectedPool.address_1,
                                 symbol: selectedPool.symbol_1,
                                 name: selectedPool.symbol_1 || 'Unknown',
                                 address: selectedPool.address_1,
                                 token_id: 999999  // Add token_id as required by TradingViewChart
                               } as FE.Token)
                            : (selectedPool.token0 || 
                               $tokenData?.find(t => t.canister_id === selectedPool.address_0) || 
                               {
                                 canister_id: selectedPool.address_0,
                                 symbol: selectedPool.symbol_0,
                                 name: selectedPool.symbol_0 || 'Unknown',
                                 address: selectedPool.address_0,
                                 token_id: 999999  // Add token_id as required by TradingViewChart
                               } as FE.Token)
                          }
                          baseToken={token}
                        />
                      </div>
                    {/key}
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

            <!-- Desktop layout - hidden on mobile -->
            <div class="hidden lg:flex lg:flex-row gap-6 w-full">
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
                      {#key chartInstance}
                        <div class="h-full w-full" id="desktop-chart-container">
                          <TradingViewChart
                            poolId={selectedPool ? Number(selectedPool.pool_id) : 0}
                            symbol={token && selectedPool
                              ? `${token.symbol}/${
                                  selectedPool.address_0 === token.canister_id
                                    ? (selectedPool.token1?.symbol || 
                                       selectedPool.symbol_1 || 
                                       $tokenData?.find(t => t.canister_id === selectedPool.address_1)?.symbol || 
                                       'Unknown')
                                    : (selectedPool.token0?.symbol || 
                                       selectedPool.symbol_0 || 
                                       $tokenData?.find(t => t.canister_id === selectedPool.address_0)?.symbol || 
                                       'Unknown')
                              }`
                              : ""}
                            quoteToken={selectedPool?.address_0 === token?.canister_id
                              ? (selectedPool.token1 || 
                                 $tokenData?.find(t => t.canister_id === selectedPool.address_1) || 
                                 { 
                                   canister_id: selectedPool.address_1,
                                   symbol: selectedPool.symbol_1,
                                   name: selectedPool.symbol_1 || 'Unknown',
                                   address: selectedPool.address_1,
                                   token_id: 999999  // Add token_id as required by TradingViewChart
                                 } as FE.Token)
                              : (selectedPool.token0 || 
                                 $tokenData?.find(t => t.canister_id === selectedPool.address_0) || 
                                 {
                                   canister_id: selectedPool.address_0,
                                   symbol: selectedPool.symbol_0,
                                   name: selectedPool.symbol_0 || 'Unknown',
                                   address: selectedPool.address_0,
                                   token_id: 999999  // Add token_id as required by TradingViewChart
                                 } as FE.Token)
                            }
                            baseToken={token}
                          />
                        </div>
                      {/key}
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
                <PoolSelector
                  {selectedPool}
                  {token}
                  formattedTokens={$tokenData}
                  {relevantPools}
                  isLoading={isPoolsLoading}
                  onPoolSelect={(pool) => {
                    hasManualSelection = true;
                    selectedPool = pool;
                  }}
                />
                <!-- Action Buttons - Shown on all layouts -->
                <div class="flex items-center gap-2 justify-end w-full">
                  <ButtonV2
                    variant="solid"
                    size="md"
                    className="!w-1/2 text-nowrap flex justify-center"
                    on:click={() =>
                      goto(
                        `/pools/add?token0=${selectedPool?.address_0}&token1=${selectedPool?.address_1}`,
                      )}
                  >
                    <div class="flex items-center gap-2">
                      <Droplets class="w-4 h-4" /> Add Liquidity
                    </div>
                  </ButtonV2>
                  <ButtonV2
                    variant="solid"
                    size="md"
                    className="!w-1/2 text-nowrap flex justify-center"
                    on:click={() =>
                      goto(
                        `/swap?from=${selectedPool?.address_1}&to=${selectedPool?.address_0}`,
                      )}
                  >
                    <div class="flex items-center gap-2">
                      <ArrowLeftRight class="w-4 h-4" /> Swap
                    </div>
                  </ButtonV2>
                </div>
                <div class="flex items-center gap-2">
                  <div class="relative w-full">
                    <ButtonV2
                      bind:element={desktopButtonRef}
                      variant="outline"
                      size="md"
                      className="w-full text-nowrap"
                      on:click={() => (showDropdown = !showDropdown)}
                    >
                      <div
                        class="flex items-center gap-2 justify-between w-full"
                      >
                        {token?.address}
                        <ChevronDown class="w-4 h-4" />
                      </div>
                    </ButtonV2>

                    <!-- Dropdown menu -->
                    {#if showDropdown}
                      <div
                        bind:this={desktopDropdownRef}
                        class="absolute right-0 top-full mt-1 w-48 bg-kong-bg-light rounded-lg shadow-lg z-50"
                      >
                        <button
                          class="w-full px-4 py-2 text-left hover:bg-kong-bg-dark/50 flex items-center gap-2 rounded-t-lg"
                          on:click={() => {
                            copyToClipboard(token?.address);
                            toastStore.info(
                              "Token address copied to clipboard",
                            );
                            showDropdown = false;
                          }}
                        >
                          <Copy class="w-4 h-4" />
                          Copy
                        </button>
                        <button
                          class="w-full px-4 py-2 text-left hover:bg-kong-bg-dark/50 flex items-center gap-2 rounded-b-lg"
                          on:click={() => {
                            window.open(
                              `https://nns.ic0.app/tokens/?import-ledger-id=${token?.canister_id}`,
                              "_blank",
                            );
                            showDropdown = false;
                          }}
                        >
                          <PlusCircle class="w-4 h-4" />
                          Import to NNS
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>
                <TokenStatistics
                  {token}
                  marketCapRank={token?.metrics?.market_cap_rank ?? null}
                />
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if activeTab === "governance" && token?.canister_id && GOVERNANCE_CANISTER_IDS[token.canister_id]}
        <div
          role="tabpanel"
          id="governance-panel"
          aria-labelledby="governance-tab"
          tabindex="0"
        >
          <!-- Use same layout structure as overview -->
          <div class="flex flex-col lg:flex-row gap-6">
            <!-- Left Column - Proposals -->
            <div class="lg:w-[70%]">
              <SNSProposals
                governanceCanisterId={GOVERNANCE_CANISTER_IDS[
                  token.canister_id
                ]}
              />
            </div>

            <!-- Right Column - Stats -->
            <div class="lg:w-[30%] flex flex-col gap-4">
              <Panel variant="transparent" type="main">
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
                    href={`https://nns.ic0.app/proposals/?u=${token.canister_id}`}
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
