<script lang="ts">
  import { onMount } from 'svelte';
  import { createPNP } from '@windoge98/plug-n-play';
  import { idlFactory } from '../../../../../../src/declarations/token_backend/token_backend.did.js';

  let pnp: any = null;
  let anonActor: any = null;
  let miners: any[] = [];
  let totalMiners = 0;
  let totalBlocks = 0;
  let isLoading = true;
  let recentEvents: any[] = [];
  let selectedMiner: any = null;
  let minerDetails: any = null;
  let showMinerModal = false;

  // Get canister ID based on environment
  function getCanisterId(): string {
    if (typeof window !== 'undefined') {
      if (window.__CANISTER_ID__) {
        return window.__CANISTER_ID__;
      }
      if ((window as any).canisterId) {
        return (window as any).canisterId;
      }
      if ((window as any).canisterIdRoot) {
        return (window as any).canisterIdRoot;
      }
    }
    throw new Error('Canister ID not found in window variables');
  }

  async function getAnonActor() {
    try {
      if (!anonActor) {
        const canisterId = getCanisterId();
        anonActor = await pnp.getActor(canisterId, idlFactory, { anon: true });
      }
      return anonActor;
    } catch (error) {
      console.error("Failed to create anonymous actor:", error);
      throw error;
    }
  }

  async function fetchLeaderboardData() {
    try {
      const actor = await getAnonActor();
      isLoading = true;
      
      // Fetch data in parallel
      const [leaderboardResult, eventsResult] = await Promise.all([
        actor.get_miner_leaderboard([50]),
        actor.get_recent_events([10])
      ]);

      miners = leaderboardResult;
      totalMiners = miners.length;
      recentEvents = eventsResult;

      // Calculate total blocks from all miners
      totalBlocks = miners.reduce((acc, miner) => acc + Number(miner.stats.blocks_mined), 0);

      // Sort miners by blocks mined (should already be sorted but let's ensure)
      miners.sort((a, b) => Number(b.stats.blocks_mined) - Number(a.stats.blocks_mined));

    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
    } finally {
      isLoading = false;
    }
  }

  async function showMinerDetails(miner: any) {
    try {
      const actor = await getAnonActor();
      const details = await actor.get_miner_stats(miner.principal);
      if (details) {
        minerDetails = details;
        selectedMiner = miner;
        showMinerModal = true;
      }
    } catch (error) {
      console.error('Error fetching miner details:', error);
    }
  }

  function getEventIcon(eventType: string) {
    switch(eventType) {
      case 'MiningMilestone':
        return '🏆';
      case 'Achievement':
        return '🌟';
      case 'MiningCompetition':
        return '🎮';
      default:
        return '📢';
    }
  }

  function formatHashrate(hashrate: number): string {
    if (hashrate > 1_000_000) {
      return `${(hashrate / 1_000_000).toFixed(2)} MH/s`;
    } else if (hashrate > 1_000) {
      return `${(hashrate / 1_000).toFixed(2)} KH/s`;
    }
    return `${hashrate.toFixed(2)} H/s`;
  }

  function formatNumber(n: number): string {
    return new Intl.NumberFormat().format(n);
  }

  function formatPrincipal(principal: string): string {
    if (principal.length <= 10) return principal;
    return `${principal.slice(0, 5)}...${principal.slice(-5)}`;
  }

  function calculatePercentage(blocks: number): string {
    if (totalBlocks === 0) return '0%';
    return ((blocks / totalBlocks) * 100).toFixed(2) + '%';
  }

  onMount(async () => {
    try {
      if (typeof window !== 'undefined' && typeof (window as any).global === 'undefined') {
        (window as any).global = window;
      }

      pnp = createPNP({
        hostUrl: "https://icp0.io",
        isDev: false,
        identityProvider: "https://identity.ic0.app",
        derivationOrigin: window.location.origin,
        persistSession: true
      });

      await fetchLeaderboardData();
      
      // Refresh data every minute
      setInterval(fetchLeaderboardData, 60000);
    } catch (error) {
      console.error('Failed to initialize:', error);
      isLoading = false;
    }
  });
</script>

<div class="container px-4 py-8 mx-auto max-w-7xl">
  <!-- Stats Cards Grid -->
  <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
    <!-- Total Miners Card -->
    <div class="p-6 transition-all duration-300 border shadow-xl bg-black/40 border-emerald-900/50 rounded-xl hover:border-emerald-700/50 hover:shadow-2xl">
      <div class="flex flex-col items-center justify-center text-center">
        <h3 class="mb-2 text-lg font-medium text-gray-400">Total Miners</h3>
        <p class="text-3xl font-bold text-emerald-500">{formatNumber(totalMiners)}</p>
      </div>
    </div>

    <!-- Total Blocks Card -->
    <div class="p-6 transition-all duration-300 border shadow-xl bg-black/40 border-emerald-900/50 rounded-xl hover:border-emerald-700/50 hover:shadow-2xl">
      <div class="flex flex-col items-center justify-center text-center">
        <h3 class="mb-2 text-lg font-medium text-gray-400">Total Blocks</h3>
        <p class="text-3xl font-bold text-emerald-500">{formatNumber(totalBlocks)}</p>
      </div>
    </div>

    <!-- Network Hashrate -->
    <div class="p-6 transition-all duration-300 border shadow-xl bg-black/40 border-emerald-900/50 rounded-xl hover:border-emerald-700/50 hover:shadow-2xl">
      <div class="flex flex-col items-center justify-center text-center">
        <h3 class="mb-2 text-lg font-medium text-gray-400">Network Hashrate</h3>
        <p class="text-3xl font-bold text-emerald-500">
          {formatHashrate(miners.reduce((acc, m) => acc + m.stats.current_hashrate, 0))}
        </p>
      </div>
    </div>

    <!-- Active Miners -->
    <div class="p-6 transition-all duration-300 border shadow-xl bg-black/40 border-emerald-900/50 rounded-xl hover:border-emerald-700/50 hover:shadow-2xl">
      <div class="flex flex-col items-center justify-center text-center">
        <h3 class="mb-2 text-lg font-medium text-gray-400">Active Miners</h3>
        <p class="text-3xl font-bold text-emerald-500">
          {miners.filter(m => m.status === 'Active').length}
        </p>
      </div>
    </div>
  </div>

  <!-- Main Content Grid -->
  <div class="grid grid-cols-1 gap-6 mt-6 lg:grid-cols-4">
    <!-- Leaderboard Card -->
    <div class="p-6 transition-all duration-300 border shadow-xl lg:col-span-3 bg-black/40 border-emerald-900/50 rounded-xl hover:border-emerald-700/50 hover:shadow-2xl">
      <div class="flex items-center gap-3 mb-6">
        <svg class="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/>
        </svg>
        <h2 class="text-xl font-bold text-emerald-500">Top Miners</h2>
      </div>
      
      {#if isLoading}
        <div class="flex items-center justify-center py-8 italic text-gray-400">
          Loading leaderboard data...
        </div>
      {:else if miners.length === 0}
        <div class="flex items-center justify-center py-8 italic text-gray-400">
          No miners found
        </div>
      {:else}
        <div class="overflow-hidden">
          <!-- Header -->
          <div class="grid items-center grid-cols-6 gap-4 p-4 text-sm font-medium text-gray-400 rounded-lg bg-black/20">
            <span>Rank</span>
            <span>Miner</span>
            <span class="text-right">Blocks Mined</span>
            <span class="text-right">Total Rewards</span>
            <span class="text-right">Hashrate</span>
            <span class="text-right">Status</span>
          </div>
          
          <!-- Rows -->
          <div class="mt-2 space-y-2">
            {#each miners as miner, index}
              <div class="grid items-center grid-cols-6 gap-4 p-4 transition-colors rounded-lg cursor-pointer {index < 3 ? 'bg-emerald-900/20 border border-emerald-800/30' : 'hover:bg-black/20'}"
                   on:click={() => showMinerDetails(miner)}>
                <span class="text-gray-400">
                  {#if index < 3}
                    <span class="text-xl">{['🥇', '🥈', '🥉'][index]}</span>
                  {:else}
                    #{index + 1}
                  {/if}
                </span>
                <span class="font-mono text-white truncate" title={miner.principal}>
                  {formatPrincipal(miner.principal)}
                </span>
                <span class="font-medium text-right text-emerald-500">
                  {formatNumber(Number(miner.stats.blocks_mined))}
                </span>
                <span class="text-right text-gray-400">
                  {formatNumber(Number(miner.stats.total_rewards))}
                </span>
                <span class="text-right text-gray-400">
                  {formatHashrate(miner.stats.current_hashrate)}
                </span>
                <span class="text-right">
                  <span class="px-2 py-1 text-xs font-medium rounded-full {miner.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}">
                    {miner.status}
                  </span>
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Recent Events Card -->
    <div class="p-6 transition-all duration-300 border shadow-xl bg-black/40 border-emerald-900/50 rounded-xl hover:border-emerald-700/50 hover:shadow-2xl">
      <div class="flex items-center gap-3 mb-6">
        <svg class="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h2 class="text-xl font-bold text-emerald-500">Recent Events</h2>
      </div>

      <div class="space-y-4">
        {#each recentEvents as event}
          <div class="p-4 transition-all duration-300 rounded-lg bg-black/20 hover:bg-black/30">
            <div class="flex items-start gap-3">
              <span class="text-2xl">{getEventIcon(Object.keys(event.event_type)[0])}</span>
              <div class="flex-1">
                {#if 'MiningMilestone' in event.event_type}
                  <p class="text-white">
                    <span class="font-mono text-emerald-400">{formatPrincipal(event.event_type.MiningMilestone.miner)}</span>
                    reached {event.event_type.MiningMilestone.blocks_mined} blocks!
                  </p>
                  <p class="text-sm text-emerald-500">{event.event_type.MiningMilestone.achievement}</p>
                {:else if 'Achievement' in event.event_type}
                  <p class="text-white">
                    <span class="font-mono text-emerald-400">{formatPrincipal(event.event_type.Achievement.miner)}</span>
                    earned an achievement!
                  </p>
                  <p class="text-sm text-emerald-500">{event.event_type.Achievement.name}</p>
                  <p class="text-xs text-gray-400">{event.event_type.Achievement.description}</p>
                {:else if 'MiningCompetition' in event.event_type}
                  <p class="text-white">
                    Competition Winner: <span class="font-mono text-emerald-400">{formatPrincipal(event.event_type.MiningCompetition.winner)}</span>
                  </p>
                  <p class="text-sm text-emerald-500">Prize: {formatNumber(Number(event.event_type.MiningCompetition.prize))} tokens</p>
                {/if}
                <p class="mt-1 text-xs text-gray-500">{new Date(Number(event.timestamp)).toLocaleString()}</p>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<!-- Miner Details Modal -->
{#if showMinerModal && minerDetails}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="w-full max-w-2xl p-6 mx-4 border rounded-xl bg-black/90 border-emerald-900/50">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold text-emerald-500">Miner Details</h3>
        <button class="text-gray-400 hover:text-white" on:click={() => showMinerModal = false}>
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <div class="space-y-4">
          <div>
            <h4 class="text-sm text-gray-400">Principal ID</h4>
            <p class="font-mono text-white break-all">{selectedMiner.principal}</p>
          </div>
          <div>
            <h4 class="text-sm text-gray-400">Status</h4>
            <p class="inline-block px-2 py-1 mt-1 text-sm font-medium rounded-full {selectedMiner.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}">
              {selectedMiner.status}
            </p>
          </div>
          <div>
            <h4 class="text-sm text-gray-400">Registration Date</h4>
            <p class="text-white">{new Date(Number(selectedMiner.registration_time)).toLocaleString()}</p>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <h4 class="text-sm text-gray-400">Mining Statistics</h4>
            <div class="grid gap-2 mt-2">
              <div class="flex justify-between">
                <span class="text-gray-400">Blocks Mined</span>
                <span class="text-white">{formatNumber(Number(minerDetails.stats.blocks_mined))}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Total Rewards</span>
                <span class="text-white">{formatNumber(Number(minerDetails.stats.total_rewards))}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Current Hashrate</span>
                <span class="text-white">{formatHashrate(minerDetails.stats.current_hashrate)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Best Hashrate</span>
                <span class="text-white">{formatHashrate(minerDetails.stats.best_hashrate)}</span>
              </div>
            </div>
          </div>

          {#if minerDetails.stats.first_block_timestamp}
            <div>
              <h4 class="text-sm text-gray-400">First Block Mined</h4>
              <p class="text-white">{new Date(Number(minerDetails.stats.first_block_timestamp)).toLocaleString()}</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .leaderboard-page {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .stats-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: 12px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .stat-card h3 {
    color: #888;
    font-size: 1rem;
    margin: 0 0 0.5rem;
  }

  .stat-value {
    color: var(--text-green);
    font-size: 2rem;
    font-weight: 600;
    margin: 0;
  }

  .leaderboard-container {
    background: var(--card-bg);
    padding: 2rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  h2 {
    color: var(--text-green);
    margin: 0 0 1.5rem;
    font-size: 1.5rem;
  }

  .leaderboard {
    width: 100%;
  }

  .leaderboard-header {
    display: grid;
    grid-template-columns: 80px 1fr 150px 120px;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #888;
  }

  .leaderboard-row {
    display: grid;
    grid-template-columns: 80px 1fr 150px 120px;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    transition: all 0.2s;
    align-items: center;
  }

  .leaderboard-row:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .top-3 {
    background: rgba(74, 158, 110, 0.1);
    border: 1px solid rgba(74, 158, 110, 0.2);
  }

  .rank {
    color: #888;
    font-weight: 500;
  }

  .miner {
    color: #fff;
    font-family: monospace;
  }

  .blocks {
    color: var(--text-green);
    font-weight: 500;
  }

  .percentage {
    color: #888;
  }

  .loading, .no-data {
    text-align: center;
    padding: 2rem;
    color: #888;
    font-style: italic;
  }

  @media (max-width: 768px) {
    .leaderboard-page {
      padding: 1rem;
    }

    .leaderboard-header, .leaderboard-row {
      grid-template-columns: 60px 1fr 100px;
    }

    .percentage {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .leaderboard-header, .leaderboard-row {
      grid-template-columns: 50px 1fr auto;
      font-size: 0.9rem;
      padding: 0.75rem;
    }
  }
</style> 
