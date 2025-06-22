<script lang="ts">
  import { browser } from '$app/environment';
  import Panel from '$lib/components/common/Panel.svelte';
  import { Trophy, BarChart3, Users, TrendingUp, Activity } from 'lucide-svelte';
  
  // Import the components
  import LeaderboardTraderCard from '$lib/components/stats/LeaderboardTraderCard.svelte';
  import LoadingIndicator from '$lib/components/common/LoadingIndicator.svelte';
  import ErrorState from '$lib/components/common/ErrorState.svelte';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  import PageHeader from '$lib/components/common/PageHeader.svelte';
  
  // Import utility functions
  import { formatVolume, formatNumberWithCommas } from '$lib/utils/numberFormatUtils';
  
  // Import the store
  import { 
    leaderboardStore, 
    isLoading, 
    error, 
    leaderboardData, 
    totalVolume, 
    totalTraders 
  } from '$lib/stores/leaderboardStore';
  import type { Period } from '$lib/types';
  
  // State variables using runes
  let selectedPeriod = $state<Period>('day');
  let expandedRowIndex = $state<number | null>(null);
  let tradedTokens = $state<Record<number, any>>({});
  let loadingTokens = $state<Record<number, boolean>>({});
  let tokenErrors = $state<Record<number, string | null>>({});
  let userDetails = $state<Record<number, any>>({});
  let loadingUserDetails = $state<Record<number, boolean>>({});
  
  // Derived values from stores
  const isLoadingValue = $derived($isLoading);
  const errorValue = $derived($error);
  const leaderboardDataValue = $derived($leaderboardData);
  const totalVolumeValue = $derived($totalVolume);
  const totalTradersValue = $derived($totalTraders);
  
  // Initialize state from store
  $effect(() => {
    const state = $leaderboardStore;
    selectedPeriod = state.selectedPeriod;
    expandedRowIndex = state.expandedRowIndex;
    tradedTokens = state.tradedTokens;
    loadingTokens = state.loadingTokens;
    tokenErrors = state.tokenErrors;
    userDetails = state.userDetails;
    loadingUserDetails = state.loadingUserDetails;
  });
  
  // Handle period change
  function handlePeriodChange(period: Period) {
    leaderboardStore.setPeriod(period);
  }
  
  // Toggle row expansion
  function toggleRowExpansion(index: number) {
    leaderboardStore.toggleRowExpansion(index);
  }
  
  // Load data on mount
  $effect(() => {
    if (browser) {
      leaderboardStore.loadLeaderboard(selectedPeriod);
    }
  });
</script>

<svelte:head>
  <title>Trading Leaderboard - KongSwap</title>
</svelte:head>

<PageHeader
  title="Volume Leaderboard"
  description="Discover the top traders on KongSwap by trading volume. Leading traders are ranked based on their total trading activity."
  icon={Trophy}
  stats={[
    { label: "Total Volume", value: isLoadingValue ? "Loading..." : formatVolume(totalVolumeValue.toString()), icon: TrendingUp },
    { label: "Active Traders", value: isLoadingValue ? "Loading..." : formatNumberWithCommas(totalTradersValue), icon: Users },
    { label: "Time Period", value: selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1), icon: Activity }
  ]}
/>

<div class="max-w-[1300px] mx-auto pt-4">
  <!-- Period Selector - Redesigned -->
  <div class="flex justify-end mb-8 px-4">
    <div class="inline-flex p-0.5 bg-kong-bg-primary rounded-lg shadow-sm border border-kong-border overflow-hidden">
      <button 
        class="px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 {selectedPeriod === 'day' ? 'bg-kong-primary text-white shadow-sm' : 'text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-secondary'}"
        onclick={() => handlePeriodChange('day')}
        aria-label="Show daily leaderboard"
      >
        <Activity class="w-3.5 h-3.5" />
        <span>Day</span>
      </button>
      <button 
        class="px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 {selectedPeriod === 'week' ? 'bg-kong-primary text-white shadow-sm' : 'text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-secondary'}"
        onclick={() => handlePeriodChange('week')}
        aria-label="Show weekly leaderboard"
      >
        <Activity class="w-3.5 h-3.5" />
        <span>Week</span>
      </button>
      <button 
        class="px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 {selectedPeriod === 'month' ? 'bg-kong-primary text-white shadow-sm' : 'text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-secondary'}"
        onclick={() => handlePeriodChange('month')}
        aria-label="Show monthly leaderboard"
      >
        <Activity class="w-3.5 h-3.5" />
        <span>Month</span>
      </button>
    </div>
  </div>
  
  <div class="rounded-xl overflow-hidden px-4">
    {#if isLoadingValue}
      <LoadingIndicator message="Loading leaderboard data..." />
    {:else if errorValue}
      <ErrorState message={errorValue} size="large" retryHandler={() => leaderboardStore.loadLeaderboard(selectedPeriod)} />
    {:else if leaderboardDataValue.length === 0}
      <EmptyState 
        message="No data available for this period" 
        subMessage="Try selecting a different time period" 
        icon={BarChart3} 
        size="large"
      />
    {:else}
      <div class="py-6 mb-4">
        <!-- Top 3 winners section heading -->
        <!-- <div class="flex items-center justify-center mb-8">
          <div class="px-4 text-kong-text-primary font-medium flex items-center">
            <Trophy class="w-5 h-5 mr-2 text-yellow-400" />
            <span>Top Traders</span>
          </div>
        </div> -->
        
        <!-- Top 3 Traders - Champion and Runners-up -->
        {#if leaderboardDataValue.length > 0}
          <div class="mb-12">
            <!-- Champion (Rank #1) - Always gets its own row -->
            <div class="mb-8 flex justify-center">
              <div class="w-full sm:w-[500px]">
                <LeaderboardTraderCard
                  user={leaderboardDataValue[0]}
                  rank={1}
                  tradedTokens={tradedTokens[0]}
                  loadingTokens={loadingTokens[0] || false}
                  tokenError={tokenErrors[0] || null}
                  width="100%"
                />
              </div>
            </div>

            <!-- Runners-up (Ranks #2-3) - Share a row -->
            {#if leaderboardDataValue.length > 1}
              <div class="grid grid-cols-2 max-[1020px]:grid-cols-1 gap-4 sm:gap-6 md:gap-8 justify-items-center">
                {#each leaderboardDataValue.slice(1, 3) as user, sliceIndex}
                  {@const index = sliceIndex + 1}
                  <div class="w-full sm:w-[500px]">
                    <LeaderboardTraderCard
                      user={user}
                      rank={index + 1}
                      tradedTokens={tradedTokens[index]}
                      loadingTokens={loadingTokens[index] || false}
                      tokenError={tokenErrors[index] || null}
                      width="100%"
                    />
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Other traders (Rank #4 and below) -->
        {#if leaderboardDataValue.length > 3}
          <div class="flex items-center mb-2 mt-10">
            <div class="pl-1 text-kong-text-primary font-medium flex items-center">
              <BarChart3 class="w-5 h-5 mr-2 text-kong-text-secondary" />
              <span>Other Top Traders</span>
            </div>
          </div>
          
          <Panel 
            variant="transparent" 
            type="secondary" 
            width="100%" 
            height="auto" 
            className="border border-kong-border shadow-lg animate-fadeIn animation-delay-500" 
            unpadded={true}
          >
            <div class="overflow-x-auto">
              <table class="w-full table-auto min-w-[600px]">
                <thead class="bg-kong-bg-secondary border-b border-kong-border">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-kong-text-secondary uppercase tracking-wider w-16 min-w-[60px]">Rank</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-kong-text-secondary uppercase tracking-wider min-w-[200px]">Trader</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-kong-text-secondary uppercase tracking-wider min-w-[120px]">Volume</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-kong-text-secondary uppercase tracking-wider min-w-[100px]">Swaps</th>
                  </tr>
                </thead>
                                 <tbody class="divide-y divide-kong-border">
                   {#each leaderboardDataValue.slice(3) as user, sliceIndex}
                     {@const index = sliceIndex + 3}
                     <LeaderboardTraderCard
                       user={user}
                       rank={index + 1}
                       expanded={expandedRowIndex === index}
                       tradedTokens={tradedTokens[index]}
                       loadingTokens={loadingTokens[index] || false}
                       tokenError={tokenErrors[index] || null}
                       userDetails={userDetails[index]}
                       loadingUserDetails={loadingUserDetails[index] || false}
                       onClick={() => toggleRowExpansion(index)}
                     />
                   {/each}
                 </tbody>
              </table>
            </div>
          </Panel>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  /* Add glow effect for top traders */
  :global(.border-yellow-400) {
    box-shadow: 0 0 15px rgba(250, 204, 21, 0.3);
  }
  
  :global(.border-amber-600) {
    box-shadow: 0 0 12px rgba(217, 119, 6, 0.25);
  }
  
  :global(.border-gray-300) {
    box-shadow: 0 0 12px rgba(209, 213, 219, 0.25);
  }
</style>
