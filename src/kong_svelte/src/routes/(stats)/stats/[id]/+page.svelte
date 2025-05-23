<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { fetchPoolsForCanister } from "$lib/stores/poolStore";
  import Panel from "$lib/components/common/Panel.svelte";
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
  import { snsService, icpGovernanceService } from '$lib/utils/snsUtils';
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import TokenChart from "./TokenChart.svelte";

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

  // Chart size state
  let mobileChartHeight = $state("calc(40vh + 100px)");
  let desktopChartHeight = $state("calc(60vh - 60px)");
  let windowHeight = $state(0);

  // Update chart height based on screen size
  function updateChartHeight() {
    if (browser) {
      windowHeight = window.innerHeight;
      if (windowHeight < 768) {
        // Mobile view - more compact
        mobileChartHeight = windowHeight < 480 
          ? "calc(35vh + 80px)" 
          : "calc(40vh + 100px)";
      } else {
        // Desktop view - more expansive
        desktopChartHeight = windowHeight > 1079
          ? "calc(55vh - 60px)"  // Large screens
          : windowHeight > 1023
            ? "calc(45vh - 60px)" // Medium-large screens  
            : "calc(45vh - 60px)"; // Medium screens
      }
    }
  }

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
        console.log(fetchedTokens);
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
      
      // Set initial chart height
      updateChartHeight();
      
      // Watch for window resize to update chart dimensions
      window.addEventListener('resize', () => {
        updateChartHeight();
        // Trigger chart redraw by incrementing instance
        if (chartMounted) {
          setTimeout(() => chartInstance++, 100);
        }
      });
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("touchend", handleClickOutside);
      if(browser) {
        window.removeEventListener('resize', updateChartHeight);
      }
    };
  });

  // Function to check for active proposals
  async function checkActiveProposals(governanceId: string) {
    checkingProposals = true;
    try {
      // Determine service type based on token address (same logic as SNSProposals component)
      const serviceType = token?.address === 'ryjl3-tyaaa-aaaaa-aaaba-cai' ? 'icp' : 'sns';
      const service = serviceType === 'sns' ? snsService : icpGovernanceService;
      
      // Fetch first 5 proposals to check for any 'open' ones
      const result = await service.getProposals(governanceId, 5);
       hasActiveProposals = result.proposals.some(p => p.status === 'open');
     } catch (error) {
       console.error("Error checking for active proposals:", error);
       hasActiveProposals = false; // Assume none if error occurs
     } finally {
       checkingProposals = false;
     }
   }

  // Function to handle pool selection
  function handlePoolSelect(pool: BE.Pool) {
    hasManualSelection = true;
    selectedPool = pool;
  }
</script>

<svelte:head>
  <title>{token?.name || 'Token'} {token?.symbol ? `(${token.symbol})` : ''} Chart and Stats - KongSwap</title>
</svelte:head>

<div class="p-4 pt-0">
  {#if isTokenLoading}
    <LoadingIndicator message="Loading token data..." />
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
    <div class="flex flex-col w-full mx-auto gap-4">
      <!-- Main Content -->
      <div>
        <!-- Mobile-first layout -->
        <div class="flex flex-col lg:hidden gap-4">
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
              onPoolSelect={handlePoolSelect}
            />
          {/if}

          <!-- Chart Panel -->
          <Panel type="main" className="!border-b-none !shadow-none">
            <div class="w-full chart-wrapper">
              <TokenChart 
                {token}
                {selectedPool}
                {isChartDataReady}
                {chartInstance}
                height={mobileChartHeight}
              />
            </div>
          </Panel>

          <!-- Transactions Panel -->
          {#if token && token.address === $page.params.id}
            <TransactionFeed {token} className="w-full !bg-kong-bg-light" />
          {/if}

          <!-- Governance Section (Mobile) -->
          {#if token?.address && GOVERNANCE_CANISTER_IDS[token.address]}
            <div id="governance-section" class="mt-4">
              <SNSProposals
                governanceCanisterId={GOVERNANCE_CANISTER_IDS[token.address]}
                type={token.address === 'ryjl3-tyaaa-aaaaa-aaaba-cai' ? 'icp' : 'sns'}
              />
            </div>
          {/if}
        </div>

        <!-- Desktop layout -->
        <div class="hidden lg:flex lg:flex-row gap-4 w-full">
          <!-- Left Column - Stats -->
          <div class="lg:w-[420px] flex flex-col gap-6">
            <TokenStatistics
              {token}
              marketCapRank={token?.metrics?.market_cap_rank}
              {selectedPool}
              {totalTokenTvl}
            />
            
            <!-- Pool Statistics -->
            {#if selectedPool}
              <PoolStatistics 
                {selectedPool} 
                {token} 
                {relevantPools}
                onPoolSelect={handlePoolSelect}
              />
            {/if}
          </div>
          
          <!-- Middle Column - Chart -->
          <div class="lg:w-full flex flex-col">
            <!-- Chart Panel -->
            <Panel type="main" className="!p-0 !bg-transparent !shadow-none !border-none">
              <div class="w-full chart-wrapper">
                <TokenChart 
                  {token}
                  {selectedPool}
                  {isChartDataReady}
                  {chartInstance}
                  height={desktopChartHeight}
                />
              </div>
            </Panel>
            
            <!-- Governance and Transactions (Desktop) -->
              <div id="governance-section" class="mt-4 hidden lg:block">
                <div class="flex flex-row gap-6">
                  {#if token?.address && GOVERNANCE_CANISTER_IDS[token.address]}
                  <!-- Left Column - Proposals -->
                  <div class="w-1/2">
                    <SNSProposals
                      governanceCanisterId={GOVERNANCE_CANISTER_IDS[token.address]}
                      type={token.address === 'ryjl3-tyaaa-aaaaa-aaaba-cai' ? 'icp' : 'sns'}
                    />
                  </div>
                  {/if}
                  
                  <!-- Right Column - Transactions -->
                  <div class={`${token?.address && GOVERNANCE_CANISTER_IDS[token.address] ? 'lg:w-1/2' : 'lg:w-full'} flex flex-col`}>
                    {#if token && token.address === $page.params.id}
                      <TransactionFeed {token} className="w-full !p-0 !bg-kong-bg-light" />
                    {/if}
                  </div>
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style scoped>
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

  /* Chart wrapper styles */
  .chart-wrapper {
    position: relative;
    width: 100%;
    margin-bottom: 1rem;
  }
  
  /* Clearfix for chart wrapper */
  .chart-wrapper::after {
    content: "";
    display: table;
    clear: both;
  }
</style>
