<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Panel from '$lib/components/common/Panel.svelte';
  import { Trophy, BarChart3, Crown } from 'lucide-svelte';
  
  // Import the components
  import LeaderboardTraderCard from '$lib/components/stats/LeaderboardTraderCard.svelte';
  import LoadingState from '$lib/components/common/LoadingState.svelte';
  import ErrorState from '$lib/components/common/ErrorState.svelte';
  import EmptyState from '$lib/components/common/EmptyState.svelte';
  
  // Import utility functions
  import { formatVolume, formatNumber } from '$lib/utils/formatters';
  
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
  
  // Handle period change
  function handlePeriodChange(period: Period) {
    leaderboardStore.setPeriod(period);
  }
  
  // Toggle row expansion
  function toggleRowExpansion(index: number) {
    leaderboardStore.toggleRowExpansion(index);
  }
  
  // Subscribe to the store to get all state
  $: selectedPeriod = $leaderboardStore.selectedPeriod;
  $: expandedRowIndex = $leaderboardStore.expandedRowIndex;
  $: tradedTokens = $leaderboardStore.tradedTokens;
  $: loadingTokens = $leaderboardStore.loadingTokens;
  $: tokenErrors = $leaderboardStore.tokenErrors;
  $: userDetails = $leaderboardStore.userDetails;
  $: loadingUserDetails = $leaderboardStore.loadingUserDetails;
  $: userDetailsErrors = $leaderboardStore.userDetailsErrors;
  
  onMount(() => {
    if (browser) {
      leaderboardStore.loadLeaderboard(selectedPeriod);
    }
  });
</script>

<svelte:head>
  <title>Trading Leaderboard - KongSwap</title>
</svelte:head>

<h1 class="text-3xl font-semibold text-kong-text-primary text-center">Volume Leaderboard</h1>
 
<div class="max-w-[1300px] mx-auto pt-6">
  <!-- Period Selector -->
  <div class="flex justify-center">
    <div class="inline-flex p-1 bg-kong-surface-dark rounded-lg shadow-md border border-kong-border overflow-hidden">
      <button 
        class="px-6 py-2 rounded-md text-sm font-medium transition-all {selectedPeriod === 'day' ? 'bg-kong-primary text-white shadow-lg' : 'text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light'}"
        on:click={() => handlePeriodChange('day')}
      >
        Day
      </button>
      <button 
        class="px-6 py-2 rounded-md text-sm font-medium transition-all {selectedPeriod === 'week' ? 'bg-kong-primary text-white shadow-lg' : 'text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light'}"
        on:click={() => handlePeriodChange('week')}
      >
        Week
      </button>
      <button 
        class="px-6 py-2 rounded-md text-sm font-medium transition-all {selectedPeriod === 'month' ? 'bg-kong-primary text-white shadow-lg' : 'text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light'}"
        on:click={() => handlePeriodChange('month')}
      >
        Month
      </button>
    </div>
  </div>
  
  <div class="rounded-xl overflow-hidden">
    {#if $isLoading}
      <LoadingState message="Loading leaderboard data..." size="large" />
    {:else if $error}
      <ErrorState message={$error} size="large" retryHandler={() => leaderboardStore.loadLeaderboard(selectedPeriod)} />
    {:else if $leaderboardData.length === 0}
      <EmptyState 
        message="No data available for this period" 
        subMessage="Try selecting a different time period" 
        icon={BarChart3} 
        size="large"
      />
    {:else}
      <div class="py-6 mb-4">
        <!-- Stats Summary Banner (optional) -->
        <div class="mb-8 flex justify-center">
          <div class="flex bg-kong-surface-dark rounded-lg p-3 border border-kong-border text-kong-text-secondary text-sm">
            <div class="px-4 flex items-center border-r border-kong-border">
              <span class="mr-2">Total Volume:</span>
              <span class="font-medium text-kong-accent-green">{formatVolume($totalVolume)}</span>
            </div>
            <div class="px-4 flex items-center">
              <span class="mr-2">Traders:</span>
              <span class="font-medium">{formatNumber($totalTraders)}</span>
            </div>
          </div>
        </div>
      
        <!-- Top 3 winners section heading -->
        <div class="flex items-center justify-center mb-8">
          <div class="h-px bg-kong-border flex-grow"></div>
          <div class="px-4 text-kong-text-primary font-medium flex items-center">
            <Trophy class="w-5 h-5 mr-2 text-yellow-400" />
            <span>Top Traders</span>
          </div>
          <div class="h-px bg-kong-border flex-grow"></div>
        </div>
        
        <!-- Champion (Rank #1) -->
        {#if $leaderboardData.length > 0}
          <div class="mb-12 flex justify-center">
            <LeaderboardTraderCard
              user={$leaderboardData[0]}
              rank={1}
              expanded={expandedRowIndex === 0}
              tradedTokens={tradedTokens[0]}
              loadingTokens={loadingTokens[0] || false}
              tokenError={tokenErrors[0] || null}
              userDetails={userDetails[0]}
              loadingUserDetails={loadingUserDetails[0] || false}
              width="500px"
              on:click={() => toggleRowExpansion(0)}
            />
          </div>
        {/if}

        <!-- Runners-up (Ranks #2-3) -->
        {#if $leaderboardData.length > 2}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 justify-items-center">
            {#each $leaderboardData.slice(1, 3) as user, sliceIndex}
              {@const index = sliceIndex + 1}
              <LeaderboardTraderCard
                user={user}
                rank={index + 1}
                expanded={expandedRowIndex === index}
                tradedTokens={tradedTokens[index]}
                loadingTokens={loadingTokens[index] || false}
                tokenError={tokenErrors[index] || null}
                userDetails={userDetails[index]}
                loadingUserDetails={loadingUserDetails[index] || false}
                width="500px"
                on:click={() => toggleRowExpansion(index)}
              />
            {/each}
          </div>
        {/if}

        <!-- Other traders (Rank #4 and below) -->
        {#if $leaderboardData.length > 3}
          <div class="flex items-center justify-center mb-6 mt-10">
            <div class="h-px bg-kong-border flex-grow"></div>
            <div class="px-4 text-kong-text-primary font-medium flex items-center">
              <BarChart3 class="w-5 h-5 mr-2 text-kong-text-secondary" />
              <span>Other Top Traders</span>
            </div>
            <div class="h-px bg-kong-border flex-grow"></div>
          </div>
          
          <Panel 
            variant="transparent" 
            type="secondary" 
            width="100%" 
            height="auto" 
            className="overflow-hidden border border-kong-border shadow-lg animate-fadeIn animation-delay-500" 
            unpadded={true}
          >
            <table class="w-full table-auto">
              <thead class="bg-kong-surface-light border-b border-kong-border">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-kong-text-secondary uppercase tracking-wider w-16">Rank</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-kong-text-secondary uppercase tracking-wider">Trader</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-kong-text-secondary uppercase tracking-wider">Volume</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-kong-text-secondary uppercase tracking-wider">Swaps</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-kong-border">
                {#each $leaderboardData.slice(3) as user, sliceIndex}
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
                    on:click={() => toggleRowExpansion(index)}
                  />
                {/each}
              </tbody>
            </table>
          </Panel>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .animate-fadeIn {
    animation: fadeIn 0.4s ease-in-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animation-delay-150 {
    animation-delay: 150ms;
  }
  
  .animation-delay-300 {
    animation-delay: 300ms;
  }
  
  .animation-delay-500 {
    animation-delay: 500ms;
  }
  
  .animate-pulse-slow {
    animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  .shadow-inner-white {
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.05);
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
