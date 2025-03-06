<script lang="ts">
  import { Zap, Users, Flame, ChevronDown, ChevronUp } from "lucide-svelte";
  import { onMount } from "svelte";
  
  export let stats = {
    totalDeployments: 0,
    uniqueDeployers: 0,
    totalTokens: 0,
    totalMiners: 0
  };
  
  export let pulseStats = false;
  
  let isExpanded = false;
  let isMobile = false;
  
  onMount(() => {
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  });
  
  function checkScreenSize() {
    isMobile = window.innerWidth < 768;
    if (isMobile) isExpanded = false;
  }
  
  function toggleExpand() {
    isExpanded = !isExpanded;
  }
  
  function formatNumber(num) {
    if (num === 0) return "0";
    if (num < 10) return num.toFixed(2);
    if (num < 1000) return Math.floor(num);
    return Math.floor(num).toLocaleString();
  }
</script>

<header class="relative z-10 border-b border-blue-500/20">
  <div class="w-full px-6 py-4">
    <div class="flex flex-col md:flex-row justify-between items-center gap-4">
      
      {#if isMobile}
        <button 
          class="px-4 py-2 rounded-md border border-blue-400/20 hover:bg-blue-500/20 
                 transition-all duration-200 flex items-center gap-2 text-blue-400"
          on:click={toggleExpand}
        >
          <span class="text-sm font-mono">{isExpanded ? 'HIDE STATS' : 'SHOW STATS'}</span>
          {#if isExpanded}
            <ChevronUp class="h-4 w-4" />
          {:else}
            <ChevronDown class="h-4 w-4" />
          {/if}
        </button>
      {/if}
      
      <div class={`grid grid-cols-1 md:grid-cols-4 gap-3 w-full ${isMobile && !isExpanded ? 'hidden' : ''}`}>
        <!-- TOTAL CANISTERS -->
        <div class="stat-card border-purple-500/20">
          <Zap class="stat-icon text-purple-400" />
          <div class="stat-content">
            <span class="stat-label">TOTAL CANISTERS</span>
            <span class="stat-value">{formatNumber(stats.totalDeployments)}</span>
          </div>
        </div>

        <!-- ACTIVE USERS -->
        <div class="stat-card border-blue-500/20">
          <Users class="stat-icon text-blue-400" />
          <div class="stat-content">
            <span class="stat-label">ACTIVE USERS</span>
            <span class="stat-value">{formatNumber(stats.uniqueDeployers)}</span>
          </div>
        </div>

        <!-- TOTAL TOKENS -->
        <div class="stat-card border-red-500/20">
          <Flame class="stat-icon text-red-400" />
          <div class="stat-content">
            <span class="stat-label">TOTAL TOKENS</span>
            <span class="stat-value">{formatNumber(stats.totalTokens)}</span>
          </div>
        </div>

        <!-- TOTAL MINERS -->
        <div class="stat-card border-indigo-500/20">
          <Users class="stat-icon text-indigo-400" />
          <div class="stat-content">
            <span class="stat-label">TOTAL MINERS</span>
            <span class="stat-value">{formatNumber(stats.totalMiners)}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</header>

<style>
  .stat-card {
    @apply relative flex items-center gap-3 p-4 rounded-lg border;
    transition: all 0.2s ease;
  }

  .stat-card:hover {
    @apply transform -translate-y-1 shadow-lg shadow-blue-500/10;
  }

  .stat-icon {
    @apply h-5 w-5;
  }

  .stat-content {
    @apply flex flex-col;
  }

  .stat-label {
    @apply text-xs font-mono tracking-wider opacity-80;
  }

  .stat-value {
    @apply text-xl font-bold font-mono;
  }
</style>