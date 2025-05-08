<script lang="ts">
  import { ArrowRight, Rocket, Copy, Clock, Target, Activity, Zap, Hash, Flame, Server, BarChart, AlertCircle } from "lucide-svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { goto } from "$app/navigation";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { onMount, onDestroy } from "svelte";
  import { auth } from "$lib/stores/auth";
  import { idlFactory as tokenIdlFactory } from "../../../../../declarations/pow_backend/pow_backend.did.js";
  
  export let token;

  // Mining progress data
  let miningProgress = token.miningProgress || 0;
  let circulatingSupply = token.circulating_supply || 0;
  let totalSupply = token.total_supply || 0;
  let blockHeight = token.current_block_height || 0;
  let blockReward = token.current_block_reward || 0;
  let blockTime = token.averageBlockTime || 15;
  let minerCount = 0;
  let difficulty = 0;
  let nextHalvingInterval = 500000; // Fallback
  let nextHalvingBlock = 0;
  let timeToHalving = "";
  let dailyEmissionRate = 0;

  // Calculated mining progress percentage
  $: if (totalSupply > 0 && circulatingSupply > 0) {
    // Handle possible BigInt values by converting to Numbers first
    const supplyNum = typeof totalSupply === 'bigint' ? Number(totalSupply) : totalSupply;
    const circulatingNum = typeof circulatingSupply === 'bigint' ? Number(circulatingSupply) : circulatingSupply;
    miningProgress = Math.min(100, Math.round((circulatingNum / supplyNum) * 100));
  }

  // Calculate progress color based on mining percentage
  $: progressColor = getProgressColor(miningProgress);

  // Calculate blocks until halving
  $: blocksToHalving = nextHalvingBlock > blockHeight 
    ? (typeof nextHalvingBlock === 'bigint' || typeof blockHeight === 'bigint'
      ? Number(BigInt(nextHalvingBlock) - BigInt(blockHeight))
      : nextHalvingBlock - blockHeight) 
    : 0;
  
  // Calculate daily emission rate
  $: if (blockTime > 0 && blockReward > 0) {
    // blocks per day = (seconds in day / block time in seconds)
    const blocksPerDay = Math.floor((24 * 60 * 60) / blockTime);
    // Handle possible BigInt values by converting appropriately
    const blockRewardNum = typeof blockReward === 'bigint' ? Number(blockReward) : blockReward;
    dailyEmissionRate = blocksPerDay * blockRewardNum;
  }
  
  // Format block time
  function formatBlockTime(seconds) {
    // Ensure seconds is a valid, finite number before using toFixed
    if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) {
      return "--";
    }
    return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  }

  // Format number with k/m/b suffixes
  function formatCompactNumber(num, decimals = 2) {
    // 1. Handle null/undefined explicitly
    if (num === null || num === undefined) {
      return "--";
    }

    let numberValue;
    // 2. Convert BigInt to Number
    if (typeof num === 'bigint') {
      numberValue = Number(num);
    } else if (typeof num === 'number') {
      numberValue = num;
    } else {
      // If it's not null, undefined, bigint, or number, return "--"
      return "--"; 
    }

    // 3. Check if the resulting number is finite
    if (!isFinite(numberValue)) {
      return "--"; // Handles Infinity, -Infinity, NaN
    }

    // 4. Handle zero
    if (numberValue === 0) {
      return Number(0).toFixed(decimals); // Return "0.00" or "0" based on decimals
    }

    // 5. Format numbers less than 1000
    if (Math.abs(numberValue) < 1000) {
      return numberValue.toFixed(decimals);
    }

    // 6. Format larger numbers with units
    const units = ["k", "M", "B", "T"];
    const absValue = Math.abs(numberValue);
    
    // Calculate the power of 1000 (0 for <1k, 1 for 1k-999k, 2 for 1M-999M, etc.)
    // Using log10 can have precision issues, using string length is safer
    const numStr = absValue.toFixed(0); // Get integer part string
    let magnitude = Math.floor((numStr.length - 1) / 3); // 0 for 1-999, 1 for 1000-999999, etc.

    // Ensure magnitude corresponds to a valid unit index
    let unitIndex = Math.max(0, Math.min(units.length - 1, magnitude - 1)); // -1 because units start at 'k' (10^3)

    // Calculate the value in the chosen unit
    const valueInUnit = numberValue / Math.pow(1000, unitIndex + 1);

    // Return formatted string
    return valueInUnit.toFixed(decimals) + units[unitIndex];
  }

  // Format time duration from seconds
  function formatTimeDuration(seconds) {
    if (!seconds || seconds <= 0) return "--";
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    if (days > 0) {
      return `${days}d ${hours}h`;
    } else {
      const minutes = Math.floor((seconds % (60 * 60)) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  // Calculate color gradient for progress
  function getProgressColor(percent) {
    if (percent < 25) return "from-kong-accent-blue to-kong-accent-blue";
    if (percent < 50) return "from-kong-accent-blue to-kong-accent-green";
    if (percent < 75) return "from-kong-accent-green to-orange-500";
    return "from-orange-500 to-kong-accent-red";
  }

  // Calculate stroke dasharray for SVG circle
  function getProgressDashArray(percent) {
    const circumference = 2 * Math.PI * 36; // radius is 36
    return `${(percent / 100) * circumference} ${circumference}`;
  }
  
  // Handle token click
  function handleTokenClick() {
    goto(`/launch/token/${token.principal.toString()}`);
  }
  
  // Copy to clipboard
  function copyToClipboard(text, tokenName, fieldName) {
    navigator.clipboard.writeText(text);
    if (typeof toastStore.add === 'function') {
      toastStore.add({
        message: `Copied ${tokenName} ${fieldName} to clipboard`,
        type: 'success',
        duration: 3000
      });
    }
  }

  // Fetch mining info and update data
  async function fetchMiningInfo() {
    try {
      if (!token || !token.principal) {
        console.warn('Token or token.principal is undefined');
        return;
      }

      const actor = auth.getActor(token.principal, tokenIdlFactory, { anon: true });
      if (!actor) {
        console.warn('Could not create actor for token', token.name || 'unknown');
        return;
      }
      
      if (typeof actor.get_mining_info === 'function') {
        try {
          const miningInfo = await actor.get_mining_info();
          if (miningInfo) {
            difficulty = miningInfo.current_difficulty;
            nextHalvingInterval = miningInfo.next_halving_interval;
            blockReward = miningInfo.current_block_reward;
            
            // Calculate next halving block
            // Ensure blockHeight and nextHalvingInterval are treated as numbers for this calculation
            const currentHeightNum = typeof blockHeight === 'bigint' ? Number(blockHeight) : blockHeight;
            const halvingIntervalNum = typeof nextHalvingInterval === 'bigint' ? Number(nextHalvingInterval) : nextHalvingInterval;

            if (currentHeightNum > 0 && halvingIntervalNum > 0) {
              nextHalvingBlock = Math.ceil(currentHeightNum / halvingIntervalNum) * halvingIntervalNum;
              
              // Estimate time to halving
              if (blockTime > 0) {
                // blocksToHalving is already calculated considering BigInts
                const secondsToHalving = blocksToHalving * blockTime; 
                timeToHalving = formatTimeDuration(secondsToHalving);
              }
            }
          }
        } catch (miningInfoError) {
          console.warn('Error fetching mining info:', miningInfoError);
        }
      }
      
      // Get miners count
      if (typeof actor.get_miners === 'function') {
        try {
          const miners = await actor.get_miners();
          if (miners && Array.isArray(miners)) {
            minerCount = miners.filter(m => m && m.status && m.status.hasOwnProperty('Active')).length;
          }
        } catch (minersError) {
          console.warn('Error fetching miners:', minersError);
        }
      }
      
      // Update block height and time
      if (typeof actor.get_block_height === 'function') {
        try {
          const height = await actor.get_block_height();
          if (typeof height === 'number' || typeof height === 'bigint') {
            blockHeight = height;
          }
        } catch (heightError) {
          console.warn('Error fetching block height:', heightError);
        }
      }
      
      if (typeof actor.get_average_block_time === 'function') {
        try {
          const result = await actor.get_average_block_time([10]);
          if (result && result.Ok) {
            blockTime = result.Ok;
          }
        } catch (blockTimeError) {
          console.warn('Error fetching block time:', blockTimeError);
        }
      }
      
      // Update circulation
      if (typeof actor.get_metrics === 'function') {
        try {
          const metricsResult = await actor.get_metrics();
          if (metricsResult && metricsResult.Ok) {
            circulatingSupply = metricsResult.Ok.circulating_supply;
            totalSupply = metricsResult.Ok.total_supply;
          }
        } catch (metricsError) {
          console.warn('Error fetching metrics:', metricsError);
        }
      }
    } catch (error) {
      console.error("Error in fetchMiningInfo:", error);
    }
  }

  // Polling interval
  let pollingInterval;
  
  onMount(() => {
    // Immediately fetch data
    fetchMiningInfo();
    
    // Set up polling every 30 seconds
    pollingInterval = setInterval(fetchMiningInfo, 30000);
  });
  
  onDestroy(() => {
    // Clean up interval on component destruction
    if (pollingInterval) clearInterval(pollingInterval);
  });
</script>

<div class="transform-gpu group/card">
  <div class="relative w-full overflow-hidden rounded-xl bg-kong-bg-light bg-opacity-10 backdrop-blur-sm shadow-inner-white transition-all duration-200 hover:scale-[1.02] hover:z-10 hover:shadow-2xl border border-kong-border/20 hover:border-kong-accent-blue/50">
    <!-- Top-right chain type ribbon -->
    {#if token.chain}
      {@const chainName = Object.keys(token.chain)[0]}
      <div class="absolute -right-12 top-4 rotate-45 z-20 py-1 px-10 text-xs font-bold tracking-wider font-play bg-kong-accent-blue text-white">
        {chainName || 'UNKNOWN'}
      </div>
    {/if}

    <button
      class="w-full text-left relative overflow-hidden group"
      on:click={handleTokenClick}
    >
      <!-- Card content -->
      <div class="relative z-10 p-4 lg:p-5">
        <div class="flex flex-col sm:flex-row gap-3 sm:gap-5">
          <!-- Left side: SVG progress ring + logo -->
          <div class="relative flex-shrink-0 self-center sm:self-auto">
            <!-- SVG progress ring -->
            <svg class="w-16 h-16 sm:w-20 sm:h-20" viewBox="0 0 100 100">
              <!-- Background circle -->
              <circle cx="50" cy="50" r="36" fill="transparent" stroke="rgba(255,255,255,0.05)" stroke-width="4" />
              
              <!-- Progress arc with gradient -->
              <circle 
                cx="50" 
                cy="50" 
                r="36" 
                fill="transparent" 
                stroke-width="4"
                stroke-dasharray={getProgressDashArray(miningProgress)}
                stroke-dashoffset="0"
                stroke-linecap="round"
                class="transition-all duration-700 ease-out"
                style="transform: rotate(-90deg); transform-origin: center; stroke: url(#progress-gradient);"
              />
              
              <!-- Progress text -->
              <text x="50" y="50" text-anchor="middle" dominant-baseline="middle" class="font-play text-[10px] fill-white opacity-80">
                {miningProgress}%
              </text>
              
              <!-- Define gradient based on progress -->
              <defs>
                <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" class="{progressColor.split(' ')[0]} stop-color" />
                  <stop offset="100%" class="{progressColor.split(' ')[1]} stop-color" />
                </linearGradient>
              </defs>
            </svg>
            
            <!-- Logo or ticker inside the ring -->
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-black/5 shadow-inner-white">
              {#if token.logo && ((Array.isArray(token.logo) && token.logo.length > 0 && token.logo[0]) || typeof token.logo === 'string')}
                <img
                  src={Array.isArray(token.logo) ? token.logo[0] : token.logo}
                  alt={token.name}
                  class="w-full h-full object-cover"
                />
              {:else}
                <div class={`flex items-center justify-center w-full h-full bg-gradient-to-br ${token.randomGradient}`}>
                  <div class={`${token.randomAnimation}`}>
                    {#if token.ticker}
                      <span class="font-play text-base font-bold text-white">{token.ticker.substring(0, 2)}</span>
                    {:else}
                      <Zap size={20} class="text-white" />
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </div>
          
          <!-- Right side: Token details -->
          <div class="flex-1 space-y-1.5 text-center sm:text-left">
            <!-- Token name and ticker -->
            <div>
              <h3 class="font-alumni font-bold tracking-wider text-xl text-white group-hover:text-kong-accent-blue transition-colors duration-200 line-clamp-1 hover:line-clamp-none">
                {token.name || "Unnamed Token"}
              </h3>
              <div class="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                <!-- Token ticker -->
                <span class="px-1.5 py-0.5 rounded-full bg-kong-bg-secondary/30 text-xs font-play tracking-tight text-white/90">
                  {token.ticker || "???"}
                </span>
                
                <!-- Chain type if available -->
                {#if token.chain}
                  <span class="px-1.5 py-0.5 rounded-full bg-kong-bg-secondary/30 text-xs font-play tracking-tight text-kong-accent-blue/90">
                    {token.chain}
                  </span>
                {/if}
                
                <!-- ICRC standards -->
                <span class="px-1.5 py-0.5 rounded-full bg-kong-bg-secondary/30 text-xs font-play tracking-tight text-kong-accent-green/90">
                  ICRC-1/2/3
                </span>
              </div>
            </div>
            
            <!-- Token halving countdown -->
            {#if blocksToHalving > 0}
              <div class="flex items-center justify-between gap-2 px-3 py-1.5 bg-gradient-to-r from-kong-accent-blue/15 via-kong-accent-yellow/15 to-kong-accent-red/15 rounded-md backdrop-blur-sm border border-kong-border/20 mt-1 w-full overflow-hidden">
                <Clock size={15} class="text-kong-accent-yellow" />
                <span class="text-xs font-bold uppercase tracking-wide text-kong-text-primary whitespace-nowrap">Halving in</span>
                <span class="font-play text-sm text-kong-text-primary ml-auto truncate">{timeToHalving || `${formatCompactNumber(blocksToHalving, 0)} blocks`}</span>
              </div>
            {/if}
          </div>
        </div>
        
        <!-- Mining stats grid -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          
          <!-- Block Time -->
          <div class="bg-kong-surface-dark/30 hover:bg-kong-surface-dark/40 rounded-lg p-4 flex flex-col justify-between h-full border border-kong-border/10 transition-colors duration-200">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-full bg-kong-accent-yellow/15"><Clock size={12} class="text-kong-accent-yellow" /></span>
              <span class="text-xs uppercase tracking-wide font-medium text-kong-text-secondary truncate">Block Time</span>
            </div>
            <div class="font-play text-sm text-kong-text-primary pl-1 mt-2">
              {formatBlockTime(blockTime)}
            </div>
          </div>
          
          <!-- Network Difficulty -->
          <div class="bg-kong-surface-dark/30 hover:bg-kong-surface-dark/40 rounded-lg p-4 flex flex-col justify-between h-full border border-kong-border/10 transition-colors duration-200">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-full bg-kong-accent-purple/15"><Hash size={12} class="text-kong-accent-purple" /></span>
              <span class="text-xs uppercase tracking-wide font-medium text-kong-text-secondary truncate">Difficulty</span>
            </div>
            <div class="font-play text-sm text-kong-text-primary pl-1 mt-2">
              {formatCompactNumber(difficulty, 2)}
            </div>
          </div>
          
          <!-- Miners -->
          <div class="bg-kong-surface-dark/30 hover:bg-kong-surface-dark/40 rounded-lg p-4 flex flex-col justify-between h-full border border-kong-border/10 transition-colors duration-200">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-full bg-kong-accent-green/15"><Server size={12} class="text-kong-accent-green" /></span>
              <span class="text-xs uppercase tracking-wide font-medium text-kong-text-secondary truncate">Miners</span>
            </div>
            <div class="font-play text-sm text-kong-text-primary pl-1 mt-2">
              {minerCount > 0 ? `${minerCount} online` : '--'}
            </div>
          </div>
        </div>
        
        <!-- Block height and extra info -->
        <div class="flex items-center justify-between mt-3 sm:mt-4 px-1">
          <div class="text-xs text-kong-text-secondary font-play bg-kong-surface-dark/20 px-2 py-1 rounded-md">
            Block #{formatCompactNumber(blockHeight, 0)}
          </div>
          
          <div class="flex items-center gap-1.5 bg-kong-accent-blue/10 p-1 rounded-full transition-all duration-200 group-hover:bg-kong-accent-blue/20">
            <ArrowRight size={16} class="text-kong-accent-blue opacity-80 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </button>
  </div>
</div>

<style>
  /* Keyframes and animations */
  @keyframes spin-slow {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes pulse-fast {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
  
  /* Tailwind gradient text fallback */
  .from-kong-accent-blue.stop-color { stop-color: rgb(0, 149, 235); }
  .to-kong-accent-blue.stop-color { stop-color: rgb(0, 149, 235); }
  .from-kong-accent-green.stop-color { stop-color: rgb(0, 203, 160); }
  .to-kong-accent-green.stop-color { stop-color: rgb(0, 203, 160); }
  .from-orange-500.stop-color { stop-color: rgb(249, 115, 22); }
  .to-kong-accent-red.stop-color { stop-color: rgb(255, 59, 59); }

  
  @keyframes glow {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.2); }
  }
  
  .animate-pulse-fast {
    animation: pulse-fast 1.5s ease-in-out infinite;
  }
  
  .animate-pulse-subtle {
    animation: pulse-subtle 2s ease-in-out infinite;
  }
  
  .animate-bounce {
    animation: bounce 1.5s ease-in-out infinite;
  }
  
  .animate-spin-slow {
    animation: spin-slow 3s linear infinite;
  }
  
  .animate-glow {
    animation: glow 2s ease-in-out infinite;
  }
  
  .shadow-glow {
    box-shadow: 0 0 15px rgba(249, 115, 22, 0.3);
  }
</style>
