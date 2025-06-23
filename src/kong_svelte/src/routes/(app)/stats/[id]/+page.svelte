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
  import { fetchTokensByCanisterId, fetchTokens } from "$lib/api/tokens";
  import { browser } from "$app/environment";
  import PoolStatistics from "./PoolStatistics.svelte";
  import { snsService, icpGovernanceService } from '$lib/utils/snsUtils';
  import LoadingIndicator from "$lib/components/common/LoadingIndicator.svelte";
  import TokenChart from "./TokenChart.svelte";
  import UserPoolBalance from "$lib/components/liquidity/create_pool/UserPoolBalance.svelte";
  import { currentUserPoolsStore } from "$lib/stores/currentUserPoolsStore";
  import { auth } from "$lib/stores/auth";

  // Consolidated state
  let state = $state({
    // Token state
    token: undefined as Kong.Token | undefined,
    isTokenLoading: true,
    marketCapRank: null as number | null,
    
    // Pool state
    selectedPool: undefined as BE.Pool | undefined,
    relevantPools: [] as BE.Pool[],
    isPoolsLoading: false,
    hasManualPoolSelection: false,
    totalTokenTvl: 0,
    
    // Chart state
    chartInstance: 0,
    isChartDataReady: false,
    chartMounted: false,
    
    // UI state
    hasActiveProposals: false,
    checkingProposals: false,
    showDropdown: false,
    
    // Chart dimensions
    mobileChartHeight: "calc(40vh)",
    desktopChartHeight: "calc(50vh)",
    
    // User pool position
    hasUserPoolPosition: false
  });

  // Local refs
  let dropdownButtonRef: HTMLButtonElement | null = null;
  let dropdownRef: HTMLElement | null = null;

  // Update chart dimensions
  function updateChartHeight() {
    if (!browser) return;
    const height = window.innerHeight;
    
    if (height < 768) {
      state.mobileChartHeight = height < 480 ? "calc(35vh)" : "calc(40vh)";
    } else {
      state.desktopChartHeight = height > 1079 ? "calc(50vh)" 
        : height > 1023 ? "calc(45vh)" : "calc(45vh)";
    }
  }

  // Fetch token data
  async function fetchTokenData(tokenId: string) {
    state.isTokenLoading = true;
    state.token = undefined;
    state.selectedPool = undefined;
    state.relevantPools = [];
    state.hasActiveProposals = false;
    state.checkingProposals = false;
    state.isChartDataReady = false;
    state.chartMounted = false;
    state.chartInstance = 0;

    try {
      // Try API first
      let fetchedTokens: Kong.Token[] = [];
      try {
        // First try the by_canister endpoint
        fetchedTokens = await fetchTokensByCanisterId([tokenId]);
      } catch (apiError) {
        console.warn("fetchTokensByCanisterId failed, trying fetchTokens:", apiError);
        try {
          // Fallback to regular tokens endpoint with canister_id filter
          const response = await fetchTokens({ canister_id: tokenId, limit: 1 });
          if (response.tokens.length > 0) {
            fetchedTokens = response.tokens;
          }
        } catch (fallbackError) {
          console.warn("fetchTokens also failed:", fallbackError);
        }
      }
      
      if (fetchedTokens?.length > 0) {
        state.token = fetchedTokens[0];
        await fetchPoolData();
        checkActiveProposals();
        return;
      }

      // Fallback to store
      const data = $tokenData;
      const foundToken = data?.find(t => t.address === tokenId || t.canister_id === tokenId);
      if (foundToken) {
        state.token = foundToken;
        await fetchPoolData();
        checkActiveProposals();
      } else {
        console.warn(`Token not found for canister ID: ${tokenId}`);
      }
    } catch (error) {
      console.error("Error fetching token:", error);
      // Try one more time with just the store
      const data = $tokenData;
      const foundToken = data?.find(t => t.address === tokenId || t.canister_id === tokenId);
      if (foundToken) {
        state.token = foundToken;
        await fetchPoolData();
        checkActiveProposals();
      }
    } finally {
      state.isTokenLoading = false;
    }
  }

  // Fetch pool data
  async function fetchPoolData() {
    if (!state.token?.address) return;
    
    state.isPoolsLoading = true;
    state.hasManualPoolSelection = false;
    
    try {
      const pools = await fetchPoolsForCanister(state.token.address);
      const poolsWithTvl = pools.filter(p => Number(p.tvl) > 0);
      
      // Sort by volume
      state.relevantPools = poolsWithTvl.sort((a, b) => 
        Number(b.volume_24h || 0) - Number(a.volume_24h || 0)
      );

      // Auto-select best pool
      if (!state.hasManualPoolSelection && state.relevantPools.length > 0) {
        // Special handling for CKUSDT
        if (state.token.address === CKUSDT_CANISTER_ID) {
          const ckusdcPool = state.relevantPools.find(p => {
            const isCorrectPair = (p.address_0 === CKUSDC_CANISTER_ID && p.address_1 === CKUSDT_CANISTER_ID) ||
                                 (p.address_0 === CKUSDT_CANISTER_ID && p.address_1 === CKUSDC_CANISTER_ID);
            return isCorrectPair && Number(p.tvl) > 0;
          });
          if (ckusdcPool) {
            state.selectedPool = ckusdcPool;
            updateChartReadiness();
            return;
          }
        }

        // Select highest TVL pool
        const bestPool = [...state.relevantPools].sort((a, b) => {
          const tvlDiff = Number(b.tvl) - Number(a.tvl);
          return tvlDiff !== 0 ? tvlDiff : Number(b.volume_24h || 0) - Number(a.volume_24h || 0);
        })[0];

        if (bestPool) {
          state.selectedPool = bestPool;
          updateChartReadiness();
        }
      }

      // Calculate total TVL
      state.totalTokenTvl = state.relevantPools.reduce((sum, pool) => sum + Number(pool.tvl), 0);
    } catch (error) {
      console.error("Error fetching pools:", error);
    } finally {
      state.isPoolsLoading = false;
    }
  }

  // Update chart readiness
  function updateChartReadiness() {
    if (!state.token || !state.selectedPool) {
      state.isChartDataReady = false;
      return;
    }

    const dataReady = Boolean(
      state.selectedPool.pool_id &&
      (state.selectedPool.symbol_0 || state.selectedPool.token0?.symbol) &&
      (state.selectedPool.symbol_1 || state.selectedPool.token1?.symbol)
    );

    if (dataReady && !state.chartMounted) {
      state.chartInstance++;
      state.chartMounted = true;
    }
    state.isChartDataReady = dataReady;
  }

  // Calculate market cap rank
  function calculateMarketCapRank(tokenId: string) {
    const data = $tokenData;
    if (!data || !tokenId) {
      state.marketCapRank = null;
      return;
    }
    
    const foundToken = data.find(t => t.address === tokenId);
    if (!foundToken) {
      state.marketCapRank = null;
      return;
    }

    const sortedTokens = [...data].sort((a, b) => 
      (Number(b.metrics.market_cap) || 0) - (Number(a.metrics.market_cap) || 0)
    );
    
    const rank = sortedTokens.findIndex(t => t.address === foundToken.address);
    state.marketCapRank = rank !== -1 ? rank + 1 : null;
  }

  // Check for active governance proposals
  async function checkActiveProposals() {
    if (!state.token?.address || !GOVERNANCE_CANISTER_IDS[state.token.address]) return;
    
    state.checkingProposals = true;
    try {
      const serviceType = state.token.address === 'ryjl3-tyaaa-aaaaa-aaaba-cai' ? 'icp' : 'sns';
      const service = serviceType === 'sns' ? snsService : icpGovernanceService;
      const result = await service.getProposals(GOVERNANCE_CANISTER_IDS[state.token.address], 5);
      state.hasActiveProposals = result.proposals.some(p => p.status === 'open');
    } catch (error) {
      console.error("Error checking proposals:", error);
      state.hasActiveProposals = false;
    } finally {
      state.checkingProposals = false;
    }
  }

  // Handle pool selection
  function handlePoolSelect(pool: BE.Pool) {
    state.hasManualPoolSelection = true;
    state.selectedPool = pool;
    updateChartReadiness();
  }

  // Handle click outside dropdown
  function handleClickOutside(event: MouseEvent | TouchEvent) {
    if (!state.showDropdown) return;
    const target = event.target as Node;
    if (!(dropdownButtonRef?.contains(target) || dropdownRef?.contains(target))) {
      state.showDropdown = false;
    }
  }

  // Watch for page changes
  $effect(() => {
    const tokenId = $page.params.id;
    if (tokenId) {
      fetchTokenData(tokenId);
      calculateMarketCapRank(tokenId);
    }
  });

  // Initialize
  onMount(() => {
    if (browser) {
      updateChartHeight();
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("touchend", handleClickOutside);
      
      const handleResize = () => {
        updateChartHeight();
        if (state.chartMounted) {
          setTimeout(() => state.chartInstance++, 100);
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        document.removeEventListener("click", handleClickOutside);
        document.removeEventListener("touchend", handleClickOutside);
        window.removeEventListener('resize', handleResize);
      };
    }
  });
</script>

<svelte:head>
  <title>{state.token?.name || 'Token'} {state.token?.symbol ? `(${state.token.symbol})` : ''} Chart and Stats - KongSwap</title>
</svelte:head>

<div class="px-4 pt-0">
  {#if state.isTokenLoading}
    <LoadingIndicator message="Loading token data..." />
  {:else if !state.token}
    <div class="flex flex-col items-center justify-center min-h-[300px]">
      <div class="text-kong-text-primary/70">Token not found</div>
      <button
        class="mt-4 px-4 py-2 bg-kong-bg-primary rounded-lg hover:bg-kong-bg-primary/80 transition-colors"
        onclick={() => goto("/stats")}
      >
        Return to Stats
      </button>
    </div>
  {:else}
    <div class="flex flex-col w-full mx-auto gap-4">
      <!-- Mobile Layout -->
      <div class="flex flex-col lg:hidden gap-4">
        <TokenStatistics
          token={state.token}
          marketCapRank={state.token?.metrics?.market_cap_rank ?? (state.marketCapRank?.toString() || "-")}
          selectedPool={state.selectedPool}
          totalTokenTvl={state.totalTokenTvl}
        />
        
        {#if state.selectedPool}
          <PoolStatistics 
            selectedPool={state.selectedPool}
            token={state.token}
            relevantPools={state.relevantPools}
            onPoolSelect={handlePoolSelect}
          />
        {/if}

        <Panel type="main" className="!border-b-none !shadow-none" unpadded={true}>
          <div class="w-full chart-wrapper">
            <TokenChart 
              token={state.token}
              selectedPool={state.selectedPool}
              isChartDataReady={state.isChartDataReady}
              chartInstance={state.chartInstance}
              height={state.mobileChartHeight}
            />
          </div>
        </Panel>

        {#if state.token && state.token.address === $page.params.id}
          <TransactionFeed token={state.token} />
        {/if}

        {#if state.token?.address && GOVERNANCE_CANISTER_IDS[state.token.address]}
          <div class="mt-4">
            <SNSProposals
              token={state.token}
              governanceCanisterId={GOVERNANCE_CANISTER_IDS[state.token.address]}
              type={state.token.address === 'ryjl3-tyaaa-aaaaa-aaaba-cai' ? 'icp' : 'sns'}
            />
          </div>
        {/if}
      </div>

      <!-- Desktop Layout -->
      <div class="hidden lg:flex lg:flex-row gap-4 w-full">
        <!-- Left Column - Stats -->
        <div class="lg:w-[420px] flex flex-col gap-4">
          <TokenStatistics
            token={state.token}
            marketCapRank={state.token?.metrics?.market_cap_rank ?? (state.marketCapRank?.toString() || "-")}
            selectedPool={state.selectedPool}
            totalTokenTvl={state.totalTokenTvl}
          />
          
          {#if state.selectedPool}
            <PoolStatistics 
              selectedPool={state.selectedPool}
              token={state.token}
              relevantPools={state.relevantPools}
              onPoolSelect={handlePoolSelect}
            />
          {/if}
        </div>
        
        <!-- Right Column - Chart and Content -->
        <div class="lg:w-full flex flex-col gap-4">
          <Panel type="main" className="!p-0 !bg-transparent !shadow-none !rounded-kong-roundness">
              <TokenChart 
                token={state.token}
                selectedPool={state.selectedPool}
                isChartDataReady={state.isChartDataReady}
                chartInstance={state.chartInstance}
                height={state.desktopChartHeight}
              />
          </Panel>
          
          <!-- Governance and Transactions -->
          <div class="hidden lg:block">
            <div class="flex flex-row gap-4">
              {#if state.token?.address && GOVERNANCE_CANISTER_IDS[state.token.address]}
                <div class="w-1/2">
                  <SNSProposals
                    token={state.token}
                    governanceCanisterId={GOVERNANCE_CANISTER_IDS[state.token.address]}
                    type={state.token.address === 'ryjl3-tyaaa-aaaaa-aaaba-cai' ? 'icp' : 'sns'}
                  />
                </div>
              {/if}
              
              <div class={`${state.token?.address && GOVERNANCE_CANISTER_IDS[state.token.address] ? 'lg:w-1/2' : 'lg:w-full'} flex flex-col`}>
                {#if state.token && state.token.address === $page.params.id}
                  <TransactionFeed token={state.token} />
                {/if}
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
  }
  
  /* Clearfix for chart wrapper */
  .chart-wrapper::after {
    content: "";
    display: table;
    clear: both;
  }
</style>
