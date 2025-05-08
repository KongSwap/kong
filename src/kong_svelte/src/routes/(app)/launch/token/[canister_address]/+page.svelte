<script lang="ts">
  import { goto } from "$app/navigation";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import { ArrowLeft } from "lucide-svelte";

  export let data;
  const { token, canister_address, minerStats, error } = data;

  // Navigate back to explorer
  function goBack() {
    goto("/launch/explore");
  }

  // Utility for formatting numbers
  function formatNumber(num: number | bigint | string, decimals = 2) {
    if (!num && num !== 0) return "-";
    try {
      return Number(num).toLocaleString(undefined, { maximumFractionDigits: decimals });
    } catch {
      return num.toString();
    }
  }

  // Utility for formatting token values using decimals
  function decimalize(raw: number | bigint | string, decimals: number = 8, maxFractionDigits: number = 4) {
    if (raw === undefined || raw === null) return "-";
    try {
      const bn = typeof raw === 'bigint' ? raw : BigInt(raw);
      const divisor = 10 ** decimals;
      const value = Number(bn) / divisor;
      return value.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
    } catch {
      return raw.toString();
    }
  }

  // Format block time safely
  function formatBlockTime(value: any) {
    if (value === undefined || value === null) return "-";
    const num = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(num)) return "-";
    return `${num.toFixed(2)}s`;
  }
</script>

{#if error}
  <div class="flex flex-col items-center justify-center min-h-[40vh]">
    <div class="text-3xl text-kong-error font-bold mb-2">Error</div>
    <div class="text-kong-text-secondary">{error}</div>
  </div>
{:else if !token}
  <div class="flex flex-col items-center justify-center min-h-[40vh]">
    <div class="loader mb-4"></div>
    <div class="text-lg text-kong-text-secondary">Loading token info...</div>
  </div>
{:else}
  <div class="max-w-[1200px] mx-auto py-8 px-4">
    <div class="flex flex-col sm:flex-row gap-4 items-start mb-6">
      <!-- Back Button -->
      <button 
        class="flex items-center gap-2 px-3 py-2 transition-colors rounded-lg text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-light/10"
        onclick={() => goto('/launch/explore')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>Back to Explore</span>
      </button>
      <!-- Info Panel -->
      <Panel variant="solid" type="main" className="p-6 backdrop-blur-xl border-none flex-1 w-full">
        <div class="flex flex-col md:flex-row gap-8 md:items-center">
          <!-- Token Logo -->
          <div class="flex-shrink-0 flex items-center justify-center w-28 h-28 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-300 shadow-lg">
            {#if token.logo && (Array.isArray(token.logo) ? token.logo[0] : token.logo)}
              <img src={Array.isArray(token.logo) ? token.logo[0] : token.logo} alt={token.name} class="w-20 h-20 rounded-xl object-cover shadow-inner" />
            {:else}
              <span class="text-4xl font-bold text-white">{token.ticker ? token.ticker.substring(0, 2) : '?'}</span>
            {/if}
          </div>
          <!-- Token Info -->
          <div class="flex-1 space-y-2">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <h1 class="text-3xl font-extrabold text-white tracking-tight">{token.name}</h1>
              <span class="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs font-mono">{token.ticker}</span>
            </div>
            <div class="flex flex-wrap gap-4 text-kong-text-secondary text-sm">
              <div><span class="font-bold text-white">Decimals:</span> {token.decimals}</div>
              <div><span class="font-bold text-white">Total Supply:</span> {decimalize(token.total_supply, token.decimals)}</div>
              <div><span class="font-bold text-white">Circulating:</span> {decimalize(token.circulating_supply, token.decimals)}</div>
              <div><span class="font-bold text-white">Block Reward:</span> {decimalize(token.current_block_reward, token.decimals)}</div>
              <div><span class="font-bold text-white">Block Time:</span> {formatBlockTime(token.average_block_time)}</div>
            </div>
            <div class="flex flex-wrap gap-2 mt-2">
              <div class="bg-kong-bg-secondary/70 px-2 py-1 rounded text-xs font-mono text-kong-text-secondary">Canister: <span class="text-white">{canister_address}</span></div>
              {#if token.ledger_id}
                <div class="bg-kong-bg-secondary/70 px-2 py-1 rounded text-xs font-mono text-kong-text-secondary">Ledger: <span class="text-white">{token.ledger_id}</span></div>
              {/if}
            </div>
            {#if token.social_links && token.social_links.length > 0}
              <div class="flex gap-2 mt-2">
                {#each token.social_links as link}
                  <a href={link.url} target="_blank" rel="noopener" class="inline-flex items-center gap-1 px-2 py-1 rounded bg-kong-bg-light/20 text-kong-text-accent-blue hover:bg-orange-500/10 transition">
                    <span class="font-semibold">{link.platform}</span>
                  </a>
                {/each}
              </div>
            {/if}
          </div>
        </div>
        <!-- Divider -->
        <div class="my-8 border-t border-kong-border-light"></div>
        <!-- Miner Leaderboard -->
        <div>
          <h2 class="text-xl font-bold text-white mb-4">Top Miners</h2>
          {#if minerStats && minerStats.length > 0}
            <div class="overflow-x-auto rounded-lg shadow">
              <table class="min-w-full bg-kong-bg-secondary/80 text-sm rounded-lg">
                <thead>
                  <tr class="bg-kong-bg-dark/80">
                    <th class="px-4 py-3 text-left font-semibold text-kong-text-secondary">Rank</th>
                    <th class="px-4 py-3 text-left font-semibold text-kong-text-secondary">Miner</th>
                    <th class="px-4 py-3 text-left font-semibold text-kong-text-secondary">Status</th>
                    <th class="px-4 py-3 text-left font-semibold text-kong-text-secondary">Blocks Mined</th>
                    <th class="px-4 py-3 text-left font-semibold text-kong-text-secondary">Total Rewards</th>
                    <th class="px-4 py-3 text-left font-semibold text-kong-text-secondary">Hashrate</th>
                    <th class="px-4 py-3 text-center font-semibold text-kong-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each minerStats as miner, i}
                    <tr class="odd:bg-kong-bg-light/10 even:bg-kong-bg-dark/10 hover:bg-kong-accent-blue/5 transition cursor-pointer" onclick={() => goto(`/launch/miner/${miner.principal.toString()}?token=${canister_address}`)}>
                      <td class="px-4 py-3 font-bold text-kong-accent-blue">#{i + 1}</td>
                      <td class="px-4 py-3 max-w-[180px]">
                        <div class="flex items-center gap-2">
                          <div class="w-8 h-8 rounded-full bg-kong-bg-secondary/50 flex items-center justify-center">
                            <div class="w-5 h-5 rounded-full bg-gradient-to-br from-kong-accent-blue to-kong-accent-purple flex items-center justify-center text-white text-xs font-bold">
                              {i + 1}
                            </div>
                          </div>
                          <div class="font-mono text-xs text-kong-text-secondary truncate">
                            {miner.principal.toString().substring(0, 5)}...{miner.principal.toString().slice(-5)}
                          </div>
                        </div>
                      </td>
                      <td class="px-4 py-3">
                        <span class="inline-flex px-2 py-1 text-xs rounded-full font-medium {miner.info?.is_mining 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-yellow-500/20 text-yellow-400'}">
                          {miner.info?.is_mining ? 'Mining' : 'Stopped'}
                        </span>
                      </td>
                      <td class="px-4 py-3 font-medium">{formatNumber(miner.stats.blocks_mined, 0)}</td>
                      <td class="px-4 py-3 font-medium">{decimalize(miner.stats.total_rewards, token.decimals)}</td>
                      <td class="px-4 py-3 font-medium">{formatNumber(miner.stats.average_hashrate, 2)} H/s</td>
                      <td class="px-4 py-3 text-center">
                        <a 
                          href={`/launch/miner/${miner.principal.toString()}?token=${canister_address}`}
                          class="inline-flex items-center justify-center p-1.5 rounded-full bg-kong-bg-light/20 hover:bg-kong-bg-light/40 text-kong-accent-blue transition-colors"
                          title="View Miner Details"
                          onclick={(e) => e.stopPropagation()}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div class="text-kong-text-secondary italic">No miner data available.</div>
          {/if}
        </div>
      </Panel>
    </div>
  </div>
{/if}

<style>
  .loader {
    border: 4px solid rgba(255,255,255,0.1);
    border-top: 4px solid #f97316;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
