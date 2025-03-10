<script lang="ts">
  import { goto } from "$app/navigation";
  import Panel from "$lib/components/common/Panel.svelte";
  import { ArrowRight, Activity, Cpu, Pickaxe, Zap, Bolt, BarChart3 } from "lucide-svelte";
  import { onMount } from "svelte";
  import { auth } from "$lib/services/auth";
  import { idlFactory as minerIdlFactory } from "../../../../../../src/declarations/miner/miner.did.js";
  import { toastStore } from "$lib/stores/toastStore";

  export let miners = [];
  export let loading = false;

  // Enhanced miner data with info from get_info
  let enhancedMiners = [];
  let loadingMinerInfo = true;

  // Generate a random gradient for miners
  function getRandomGradient() {
    const gradients = [
      "from-blue-600 to-cyan-600",
      "from-green-600 to-teal-600", 
      "from-indigo-600 to-blue-600",
      "from-purple-600 to-indigo-600",
      "from-cyan-600 to-blue-600",
      "from-teal-600 to-green-600"
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
  }

  // Generate a random emoji for miners
  function getRandomEmoji() {
    const emojis = ["⛏️", "🔨", "⚒️", "🛠️", "⚙️", "🔧", "💻", "🖥️", "🔌", "⚡"];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  // Get a random animation class
  function getRandomAnimation() {
    const animations = [
      "animate-pulse-fast",
      "animate-pulse-subtle",
      "animate-bounce",
      "animate-spin-slow",
      "animate-glow"
    ];
    return animations[Math.floor(Math.random() * animations.length)];
  }

  function getMinerTypeDisplay(type) {
    if (type.Premium) return "Premium";
    if (type.Normal) return "Normal";
    if (type.Lite) return "Lite";
    return "Unknown";
  }

  function getMinerTypeColor(type) {
    if (type.Premium) return "text-yellow-400";
    if (type.Normal) return "text-blue-400";
    if (type.Lite) return "text-green-400";
    return "text-gray-400";
  }

  function getMinerTypeGradient(type) {
    if (type.Premium) return "from-yellow-600 to-orange-600";
    if (type.Normal) return "from-blue-600 to-cyan-600";
    if (type.Lite) return "from-green-600 to-teal-600";
    return "from-gray-600 to-slate-600";
  }

  function formatHashRate(hashRate) {
    if (hashRate > 1000000) {
      return `${(hashRate / 1000000).toFixed(2)} MH/s`;
    } else if (hashRate > 1000) {
      return `${(hashRate / 1000).toFixed(2)} KH/s`;
    }
    return `${hashRate.toFixed(2)} H/s`;
  }

  // Get miner info from canister
  async function getMinerInfo(miner) {
    try {
      const actor = auth.getActor(miner.principal, minerIdlFactory, { anon: true });
      const result = await actor.get_info();
      const statsResult = await actor.get_mining_stats();
      
      if (result.Ok) {
        return {
          ...miner,
          info: result.Ok,
          stats: statsResult[0] || null,
          infoLoaded: true,
          randomGradient: miner.randomGradient || getMinerTypeGradient(result.Ok.miner_type),
          randomEmoji: miner.randomEmoji || getRandomEmoji(),
          randomAnimation: miner.randomAnimation || getRandomAnimation()
        };
      }
      return {
        ...miner,
        infoLoaded: false,
        randomGradient: miner.randomGradient || getRandomGradient(),
        randomEmoji: miner.randomEmoji || getRandomEmoji(),
        randomAnimation: miner.randomAnimation || getRandomAnimation()
      };
    } catch (error) {
      console.error(`Error fetching miner info for ${miner.principal}:`, error);
      return {
        ...miner,
        infoLoaded: false,
        randomGradient: miner.randomGradient || getRandomGradient(),
        randomEmoji: miner.randomEmoji || getRandomEmoji(),
        randomAnimation: miner.randomAnimation || getRandomAnimation()
      };
    }
  }

  // Load miner info for all miners
  async function loadAllMinerInfo() {
    loadingMinerInfo = true;
    try {
      const promises = miners.map(miner => getMinerInfo(miner));
      enhancedMiners = await Promise.all(promises);
      console.log("Enhanced miners:", enhancedMiners);
    } catch (error) {
      console.error("Error loading miner info:", error);
      toastStore.error("Failed to load miner info");
      enhancedMiners = miners.map(miner => ({
        ...miner,
        infoLoaded: false,
        randomGradient: miner.randomGradient || getRandomGradient(),
        randomEmoji: miner.randomEmoji || getRandomEmoji(),
        randomAnimation: miner.randomAnimation || getRandomAnimation()
      }));
    } finally {
      loadingMinerInfo = false;
    }
  }

  function handleMinerClick(minerPrincipal) {
    if (minerPrincipal) {
      goto(`/launch/miner/${minerPrincipal}`);
    }
  }

  // Modify reactive statement to prevent unnecessary reloads
  let prevMinersLength = 0;
  $: if (miners && miners.length > 0 && miners.length !== prevMinersLength) {
    prevMinersLength = miners.length;
    loadAllMinerInfo();
  }

</script>

<div class="space-y-2">
  {#if loading || loadingMinerInfo}
    <div class="bg-kong-bg-dark/60 backdrop-blur-md border border-kong-border/50 rounded-xl p-3">
      <div class="flex flex-col gap-4 animate-pulse">
        <div class="w-1/4 h-6 rounded bg-kong-background-secondary"></div>
        <div class="w-1/2 h-4 rounded bg-kong-background-secondary"></div>
      </div>
    </div>
  {:else if enhancedMiners.length === 0}
    <div class="bg-kong-bg-dark/60 backdrop-blur-md border border-kong-border/50 rounded-xl p-3">
      <div class="py-4 text-center text-kong-text-primary/60">
        No miners found
      </div>
    </div>
  {:else}
    {#each enhancedMiners as miner}
      <div class="bg-kong-bg-dark/60 backdrop-blur-md border border-kong-border/50 rounded-xl hover:border-blue-500/30 transition-all duration-200">
        <button
          class="w-full text-left relative overflow-hidden group rounded-xl"
          on:click={() => handleMinerClick(miner.principal.toString())}
        >
          <div class="absolute inset-0 opacity-5 z-0 group-hover:opacity-10 transition-opacity duration-300">
            <div class="absolute inset-0 grid grid-cols-15 grid-rows-8">
              {#each Array(80) as _, i}
                <div class={`border border-white/5 flex items-center justify-center text-xs ${i % 9 === 0 ? miner.randomAnimation : ''}`}>
                  {i % 17 === 0 ? miner.randomEmoji : ''}
                </div>
              {/each}
            </div>
          </div>
          
          <div class={`absolute inset-0 bg-gradient-to-r from-blue-900/30 to-blue-600/10 opacity-10 group-hover:opacity-20 transition-opacity duration-300 z-0`}></div>
          
          <div class="relative z-10 p-3">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class={`relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 text-white shadow-glow`}>
                  <Pickaxe size={20} class={`${miner.infoLoaded && miner.info.is_mining ? 'animate-pulse' : ''}`} />
                  <div class={`absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-white text-xs ${miner.randomAnimation}`} style={`color: #3b82f6;`}>
                    {miner.randomEmoji}
                  </div>
                </div>
                <div>
                  <h3 class="text-lg font-extrabold flex items-center gap-2">
                    {miner.infoLoaded ? getMinerTypeDisplay(miner.info.miner_type) : getMinerTypeDisplay(miner.type)} Miner
                    <span class={`px-2 py-0.5 text-xs rounded-full ${miner.infoLoaded && miner.info.is_mining ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                      {miner.infoLoaded && miner.info.is_mining ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </h3>
                  <p class="text-sm font-bold text-white/70 flex items-center gap-1">
                    ID: {miner.principal.toString().slice(0, 10)}...
                    <span class="px-1.5 py-0.5 text-xs rounded bg-blue-900/20 text-blue-400 ml-1">
                      {miner.infoLoaded ? `${miner.info.speed_percentage}%` : 'Unknown'}
                    </span>
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-right">
                  {#if miner.infoLoaded && miner.info.is_mining && miner.stats}
                    <p class="text-xs text-white/70 flex items-center gap-1">
                      <Bolt size={12} class="text-blue-400" /> Hash Rate
                    </p>
                    <p class="font-bold text-sm text-blue-400">
                      {formatHashRate(miner.stats.last_hash_rate)}
                    </p>
                  {:else}
                    <p class="text-xs text-white/70">Status</p>
                    <p class="font-bold text-sm text-red-400">Inactive</p>
                  {/if}
                </div>
                <div class="bg-blue-900/20 p-1.5 rounded-full group-hover:bg-blue-800/30 transition-colors duration-300">
                  <ArrowRight size={16} class="text-blue-400" />
                </div>
              </div>
            </div>
            
            {#if miner.infoLoaded && miner.stats}
              <div class="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-blue-900/30">
                <div class="bg-black/10 px-2 py-1.5 rounded-lg">
                  <p class="text-xs text-white/70 flex items-center gap-1">
                    <BarChart3 size={12} class="text-blue-400" /> Blocks
                  </p>
                  <p class="font-bold text-xs">
                    {miner.stats.blocks_mined.toString()}
                  </p>
                </div>
                
                <div class="bg-black/10 px-2 py-1.5 rounded-lg">
                  <p class="text-xs text-white/70 flex items-center gap-1">
                    <Cpu size={12} class="text-blue-400" /> Hashes
                  </p>
                  <p class="font-bold text-xs">
                    {Number(miner.stats.total_hashes) > 1000000 
                      ? `${(Number(miner.stats.total_hashes) / 1000000).toFixed(1)}M` 
                      : Number(miner.stats.total_hashes) > 1000 
                        ? `${(Number(miner.stats.total_hashes) / 1000).toFixed(1)}K` 
                        : miner.stats.total_hashes.toString()}
                  </p>
                </div>
                
                <div class="bg-black/10 px-2 py-1.5 rounded-lg">
                  <p class="text-xs text-white/70 flex items-center gap-1">
                    <Zap size={12} class="text-blue-400" /> Rewards
                  </p>
                  <p class="font-bold text-xs">
                    {Number(miner.stats.total_rewards) > 1000000 
                      ? `${(Number(miner.stats.total_rewards) / 1000000).toFixed(1)}M` 
                      : Number(miner.stats.total_rewards) > 1000 
                        ? `${(Number(miner.stats.total_rewards) / 1000).toFixed(1)}K` 
                        : miner.stats.total_rewards.toString()}
                  </p>
                </div>
                
                <div class="bg-black/10 px-2 py-1.5 rounded-lg">
                  <p class="text-xs text-white/70 flex items-center gap-1">
                    <Activity size={12} class="text-blue-400" /> Token
                  </p>
                  <p class="font-bold text-xs truncate">
                    {miner.info.current_token?.[0] 
                      ? miner.info.current_token[0].toString().substring(0, 8) + '...' 
                      : 'None'}
                  </p>
                </div>
              </div>
            {/if}
          </div>
        </button>
      </div>
    {/each}
  {/if}
</div>

<style>
  @keyframes spin-slow {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes glow {
    0%, 100% { filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.7)); }
    50% { filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.9)); }
  }
  
  :global(.animate-spin-slow) {
    animation: spin-slow 3s linear infinite;
  }
  
  :global(.animate-glow) {
    animation: glow 2s ease-in-out infinite;
  }
  
  :global(.shadow-glow) {
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
  }
</style>
