<script lang="ts">
  import { goto } from "$app/navigation";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
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
  <div class="max-w-3xl mx-auto py-8 px-4">
    <!-- Back Button -->
    <div class="mb-6">
      <ButtonV2 
        label="Back to Explorer" 
        theme="muted" 
        variant="outline" 
        size="sm" 
        on:click={goBack}
      >
        <ArrowLeft slot="icon" size={16} />
      </ButtonV2>
    </div>

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
          <div><span class="font-bold text-white">Total Supply:</span> {formatNumber(token.total_supply, 0)}</div>
          <div><span class="font-bold text-white">Circulating:</span> {formatNumber(token.circulating_supply, 0)}</div>
          <div><span class="font-bold text-white">Block Reward:</span> {formatNumber(token.current_block_reward)}</div>
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
                <th class="px-4 py-2 text-left font-semibold text-kong-text-secondary">Rank</th>
                <th class="px-4 py-2 text-left font-semibold text-kong-text-secondary">Principal</th>
                <th class="px-4 py-2 text-left font-semibold text-kong-text-secondary">Blocks Mined</th>
                <th class="px-4 py-2 text-left font-semibold text-kong-text-secondary">Total Rewards</th>
                <th class="px-4 py-2 text-left font-semibold text-kong-text-secondary">Hashrate</th>
              </tr>
            </thead>
            <tbody>
              {#each minerStats as miner, i}
                <tr class="odd:bg-kong-bg-light/10 even:bg-kong-bg-dark/10 hover:bg-orange-500/10 transition">
                  <td class="px-4 py-2 font-bold text-orange-400">{i + 1}</td>
                  <td class="px-4 py-2 font-mono text-white truncate max-w-[180px]">{miner.principal.toString()}</td>
                  <td class="px-4 py-2">{formatNumber(miner.stats.blocks_mined, 0)}</td>
                  <td class="px-4 py-2">{formatNumber(miner.stats.total_rewards)}</td>
                  <td class="px-4 py-2">{formatNumber(miner.stats.average_hashrate, 2)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="text-kong-text-secondary italic">No miner data available.</div>
      {/if}
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
