<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchVolumeLeaderboard } from '$lib/api/leaderboard';
  
  type Period = 'day' | 'week' | 'month';
  
  let leaderboardData: Array<{
    user_id: number;
    principal_id: string;
    volume: number;
  }> = [];
  
  let isLoading = true;
  let error: string | null = null;
  let selectedPeriod: Period = 'day';
  
  async function loadLeaderboard(period: Period) {
    isLoading = true;
    error = null;
    
    try {
      const response = await fetchVolumeLeaderboard(period);
      leaderboardData = response.items;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load leaderboard';
      console.error('Error loading leaderboard:', err);
    } finally {
      isLoading = false;
    }
  }
  
  function formatVolume(volume: number): string {
    if (volume >= 1_000_000) {
      return `$${(volume / 1_000_000).toFixed(2)}M`;
    } else if (volume >= 1_000) {
      return `$${(volume / 1_000).toFixed(2)}K`;
    } else {
      return `$${volume.toFixed(2)}`;
    }
  }
  
  function formatPrincipalId(id: string): string {
    if (id.length <= 10) return id;
    return `${id.substring(0, 6)}...${id.substring(id.length - 4)}`;
  }
  
  function handlePeriodChange(period: Period) {
    selectedPeriod = period;
    loadLeaderboard(period);
  }
  
  onMount(() => {
    loadLeaderboard(selectedPeriod);
  });
</script>

<div class="container mx-auto px-4 py-8">
  <header class="mb-8">
    <h1 class="text-2xl md:text-3xl font-bold text-kong-text-primary mb-2">Trading Volume Leaderboard</h1>
    <p class="text-kong-text-secondary">Top traders ranked by trading volume</p>
  </header>
  
  <div class="mb-6">
    <div class="inline-flex p-1 bg-kong-surface-dark rounded-lg">
      <button 
        class="px-4 py-2 rounded-md text-sm transition-all {selectedPeriod === 'day' ? 'bg-kong-primary text-white' : 'text-kong-text-secondary hover:text-kong-text-primary'}"
        on:click={() => handlePeriodChange('day')}
      >
        Day
      </button>
      <button 
        class="px-4 py-2 rounded-md text-sm transition-all {selectedPeriod === 'week' ? 'bg-kong-primary text-white' : 'text-kong-text-secondary hover:text-kong-text-primary'}"
        on:click={() => handlePeriodChange('week')}
      >
        Week
      </button>
      <button 
        class="px-4 py-2 rounded-md text-sm transition-all {selectedPeriod === 'month' ? 'bg-kong-primary text-white' : 'text-kong-text-secondary hover:text-kong-text-primary'}"
        on:click={() => handlePeriodChange('month')}
      >
        Month
      </button>
    </div>
  </div>
  
  <div class="bg-kong-surface-dark rounded-xl overflow-hidden shadow-lg">
    {#if isLoading}
      <div class="p-8 flex justify-center items-center">
        <div class="animate-pulse flex space-x-2">
          <div class="w-2 h-2 bg-kong-primary rounded-full"></div>
          <div class="w-2 h-2 bg-kong-primary rounded-full"></div>
          <div class="w-2 h-2 bg-kong-primary rounded-full"></div>
        </div>
      </div>
    {:else if error}
      <div class="p-8 text-center">
        <p class="text-kong-accent-red">{error}</p>
        <button 
          class="mt-4 px-4 py-2 bg-kong-primary hover:bg-kong-primary-hover rounded-md text-white text-sm transition-colors"
          on:click={() => loadLeaderboard(selectedPeriod)}
        >
          Try Again
        </button>
      </div>
    {:else if leaderboardData.length === 0}
      <div class="p-8 text-center text-kong-text-secondary">
        No data available for this period
      </div>
    {:else}
      <table class="w-full table-auto">
        <thead class="bg-kong-surface-light">
          <tr>
            <th class="px-6 py-4 text-left text-xs font-medium text-kong-text-secondary uppercase tracking-wider">Rank</th>
            <th class="px-6 py-4 text-left text-xs font-medium text-kong-text-secondary uppercase tracking-wider">User</th>
            <th class="px-6 py-4 text-right text-xs font-medium text-kong-text-secondary uppercase tracking-wider">Trading Volume</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-kong-border">
          {#each leaderboardData as user, index}
            <tr class="transition-colors hover:bg-kong-bg-light">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <span class="{index < 3 ? 'font-bold' : ''} {index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-kong-text-primary'}">
                    #{index + 1}
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-kong-text-primary">
                  {formatPrincipalId(user.principal_id)}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="text-sm font-medium text-kong-accent-green">
                  {formatVolume(user.volume)}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>
