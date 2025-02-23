<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchSubnets, getSubnetAnalysis, getSubnetSummary } from '$lib/services/ic-api';
  import type { Subnet } from '$lib/services/ic-api';

  let subnets: Subnet[] = [];
  let selectedSubnet: string | null = null;
  let subnetAnalysis: Awaited<ReturnType<typeof getSubnetAnalysis>> | null = null;
  let loading = true;
  let error: string | null = null;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  // Fetch initial data with retries
  async function fetchData() {
    try {
      loading = true;
      error = null;
      subnets = await fetchSubnets();
      
      // Select first subnet by default
      if (subnets.length > 0 && !selectedSubnet) {
        await selectSubnet(subnets[0].subnet_id);
      }
    } catch (e) {
      console.error('Error fetching subnet data:', e);
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`Retrying... Attempt ${retryCount} of ${MAX_RETRIES}`);
        setTimeout(fetchData, 1000 * retryCount); // Exponential backoff
        return;
      }
      error = e instanceof Error ? e.message : 'Failed to load subnet data';
    } finally {
      loading = false;
    }
  }

  // Handle subnet selection with retries
  async function selectSubnet(subnetId: string) {
    try {
      loading = true;
      error = null;
      selectedSubnet = subnetId;
      subnetAnalysis = await getSubnetAnalysis(subnetId);
    } catch (e) {
      console.error('Error loading subnet analysis:', e);
      error = e instanceof Error ? e.message : 'Failed to load subnet analysis';
      // Keep the selected subnet even if analysis fails
    } finally {
      loading = false;
    }
  }

  onMount(fetchData);

  // Helper function to format numbers
  function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2
    }).format(num);
  }

  // Helper function to format bytes
  function formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  // Helper function to get status color
  function getStatusColor(status: 'healthy' | 'degraded' | 'unhealthy'): string {
    return {
      healthy: 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]',
      degraded: 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]',
      unhealthy: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
    }[status];
  }

  // Helper function to get score color
  function getScoreColor(score: number): string {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  }

  // Helper function to calculate percentage
  function calculatePercentage(value: number, max: number): number {
    return (value / max) * 100;
  }
</script>

<div class="min-h-full bg-black/90">
  <!-- Header -->
  <div class="relative p-6 border-b border-blue-500/30 bg-black/90">
    <div class="mx-auto max-w-7xl">
      <h1 class="mb-2 text-4xl font-bold text-transparent bg-gradient-to-r from-blue-400 via-cyan-500 to-blue-500 bg-clip-text">
        Internet Computer Subnets
      </h1>
      <p class="text-blue-300/70">
        Real-time metrics and analysis for all IC subnets. Monitor performance, health, and geographic distribution.
      </p>
    </div>
    <!-- Corner accents -->
    <div class="absolute top-0 left-0 w-16 h-[2px] bg-blue-500/50"></div>
    <div class="absolute top-0 right-0 w-16 h-[2px] bg-blue-500/50"></div>
    <div class="absolute top-0 left-0 w-[2px] h-16 bg-blue-500/50"></div>
    <div class="absolute top-0 right-0 w-[2px] h-16 bg-blue-500/50"></div>
  </div>

  {#if loading}
    <div class="flex flex-col items-center justify-center h-64 space-y-4">
      <div class="w-16 h-16 border-4 rounded-full border-blue-500/30 border-t-blue-500 animate-spin"></div>
      <p class="text-blue-300/70">Loading subnet data...</p>
    </div>
  {:else if error}
    <div class="p-6 mx-auto max-w-7xl">
      <div class="p-6 space-y-4 border rounded-none border-red-500/30 bg-red-500/5">
        <div class="flex items-center space-x-3">
          <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="text-lg font-semibold text-red-400">Error Loading Subnets</h3>
        </div>
        <p class="text-red-300">{error}</p>
        <button 
          on:click={() => { retryCount = 0; fetchData(); }}
          class="px-4 py-2 text-red-400 transition-colors border rounded-none bg-red-500/20 border-red-500/30 hover:bg-red-500/30"
        >
          Retry Loading
        </button>
      </div>
    </div>
  {:else if subnets.length === 0}
    <div class="p-6 mx-auto max-w-7xl">
      <div class="p-6 border rounded-none border-yellow-500/30 bg-yellow-500/5">
        <div class="flex items-center space-x-3">
          <svg class="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 class="text-lg font-semibold text-yellow-400">No Subnets Found</h3>
        </div>
        <p class="mt-2 text-yellow-300">No subnet data is currently available. This might be temporary - please try again later.</p>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-6 p-6 mx-auto max-w-7xl lg:grid-cols-3">
      <!-- Subnet Grid -->
      <div class="grid grid-cols-1 gap-4 lg:col-span-2 sm:grid-cols-2">
        {#each subnets as subnet (subnet.subnet_id)}
          <div
            class="relative border border-blue-500/30 bg-black/90 p-4 cursor-pointer group transition-all duration-300
              {selectedSubnet === subnet.subnet_id ? 'ring-1 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'hover:border-blue-400/50'}"
            on:click={() => selectSubnet(subnet.subnet_id)}
          >
            <!-- Status Indicator -->
            <div class="absolute top-4 right-4">
              <div class={`w-3 h-3 rounded-full ${getStatusColor(subnet.status)}`}></div>
            </div>

            <!-- Header -->
            <div class="mb-4">
              <h3 class="font-bold text-blue-300">{subnet.display_name || subnet.subnet_id}</h3>
              <p class="text-sm text-blue-300/70">{subnet.subnet_type}</p>
            </div>

            <!-- Resource Bars -->
            <div class="mb-4 space-y-3">
              <!-- Canister Usage -->
              <div>
                <div class="flex justify-between mb-1 text-sm">
                  <span class="text-blue-300/70">Canisters</span>
                  <span class="text-blue-300">{formatNumber(subnet.canister_count)} / {formatNumber(subnet.max_canisters)}</span>
                </div>
                <div class="relative h-1 overflow-hidden bg-blue-500/10">
                  <div 
                    class="absolute top-0 left-0 h-full transition-all duration-300 bg-blue-500"
                    style="width: {calculatePercentage(subnet.canister_count, subnet.max_canisters)}%"
                  ></div>
                </div>
              </div>

              <!-- Memory Usage -->
              <div>
                <div class="flex justify-between mb-1 text-sm">
                  <span class="text-blue-300/70">Memory</span>
                  <span class="text-blue-300">{formatBytes(subnet.memory_usage)} / {formatBytes(subnet.memory_capacity)}</span>
                </div>
                <div class="relative h-1 overflow-hidden bg-blue-500/10">
                  <div 
                    class="absolute top-0 left-0 h-full transition-all duration-300 bg-blue-500"
                    style="width: {calculatePercentage(subnet.memory_usage, subnet.memory_capacity)}%"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Performance Metrics -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-blue-300/70">Block Rate</p>
                <p class="text-xl text-blue-300">{formatNumber(subnet.block_rate)}/s</p>
              </div>
              <div>
                <p class="text-sm text-blue-300/70">Nodes</p>
                <p class="text-xl text-blue-300">{subnet.node_count}</p>
              </div>
            </div>

            {#if subnet.metrics}
              <div class="pt-4 mt-4 border-t border-blue-500/30">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm text-blue-300/70">TPS</span>
                  <span class="font-mono text-blue-300">
                    {formatNumber(subnet.metrics.average_tps)} avg / {formatNumber(subnet.metrics.peak_tps)} peak
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm text-blue-300/70">Success Rate</span>
                  <span class="font-mono text-blue-300">
                    {formatNumber(subnet.metrics.transaction_success_rate * 100)}%
                  </span>
                </div>
              </div>
            {/if}

            <!-- Hover Effects -->
            <div class="absolute inset-0 transition-opacity duration-300 opacity-0 pointer-events-none group-hover:opacity-100">
              <div class="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/50 to-transparent"></div>
              <div class="absolute bottom-0 right-0 w-full h-[1px] bg-gradient-to-l from-blue-500/50 to-transparent"></div>
              <div class="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-blue-500/50 to-transparent"></div>
              <div class="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-blue-500/50 to-transparent"></div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Detailed Analysis Panel -->
      {#if subnetAnalysis}
        <div class="lg:col-span-1">
          <div class="sticky p-6 border border-blue-500/30 bg-black/90 top-6">
            <h2 class="mb-6 text-2xl font-bold text-blue-300">Detailed Analysis</h2>
            
            <!-- Summary -->
            <div class="p-4 mb-6 border bg-blue-500/5 border-blue-500/30">
              <pre class="font-mono text-sm text-blue-300 whitespace-pre-wrap">{getSubnetSummary(subnetAnalysis)}</pre>
            </div>

            <!-- Geographic Distribution -->
            <div class="mb-6">
              <h3 class="mb-3 text-xl font-semibold text-blue-300">Geographic Distribution</h3>
              <div class="space-y-4">
                <div class="p-4 border border-blue-500/30 bg-blue-500/5">
                  <h4 class="mb-2 font-semibold text-blue-300">Regions ({subnetAnalysis.geographic.regions.length})</h4>
                  <ul class="space-y-1">
                    {#each subnetAnalysis.geographic.regions as region}
                      <li class="text-blue-300/70">{region}</li>
                    {/each}
                  </ul>
                </div>
                <div class="p-4 border border-blue-500/30 bg-blue-500/5">
                  <p class="mb-2"><strong class="text-blue-300">Primary Region:</strong> <span class="text-blue-300/70">{subnetAnalysis.geographic.primaryRegion}</span></p>
                  <p class="mb-2"><strong class="text-blue-300">Redundancy:</strong> <span class="text-blue-300/70">{subnetAnalysis.geographic.redundancy} nodes/region</span></p>
                  <p><strong class="text-blue-300">Decentralization Score:</strong> <span class="text-blue-300/70">{subnetAnalysis.geographic.decentralizationScore}/100</span></p>
                </div>
              </div>
            </div>

            <!-- Node Health -->
            <div class="mb-6">
              <h3 class="mb-3 text-xl font-semibold text-blue-300">Node Health</h3>
              <div class="p-4 border border-blue-500/30 bg-blue-500/5">
                <p class="mb-2"><strong class="text-blue-300">Active Nodes:</strong> <span class="text-blue-300/70">{subnetAnalysis.nodeHealth.activeNodes}/{subnetAnalysis.nodeHealth.totalNodes}</span></p>
                <p class="mb-2"><strong class="text-blue-300">Health Percentage:</strong> <span class="text-blue-300/70">{subnetAnalysis.nodeHealth.healthyPercentage.toFixed(1)}%</span></p>
                <p><strong class="text-blue-300">Average Uptime:</strong> <span class="text-blue-300/70">{subnetAnalysis.nodeHealth.averageUptime.toFixed(1)}%</span></p>
              </div>
              {#if subnetAnalysis.nodeHealth.performanceIssues.length > 0}
                <div class="p-4 mt-4 border border-red-500/30 bg-red-500/5">
                  <h4 class="mb-2 font-semibold text-red-400">Performance Issues</h4>
                  <ul class="space-y-1">
                    {#each subnetAnalysis.nodeHealth.performanceIssues as issue}
                      <li class="text-red-300">{issue}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>

            <!-- Recommendations -->
            {#if subnetAnalysis.recommendations.length > 0}
              <div>
                <h3 class="mb-3 text-xl font-semibold text-blue-300">Recommendations</h3>
                <div class="p-4 border border-blue-500/30 bg-blue-500/5">
                  <ul class="space-y-2">
                    {#each subnetAnalysis.recommendations as recommendation}
                      <li class="text-blue-300/70">{recommendation}</li>
                    {/each}
                  </ul>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Custom scrollbar for webkit browsers */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(59, 130, 246, 0.1);
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(59, 130, 246, 0.3);
    border-radius: 0;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(59, 130, 246, 0.5);
  }
</style> 
