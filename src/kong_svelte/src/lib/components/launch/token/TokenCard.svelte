<script lang="ts">
  import { ArrowRight, Rocket, Copy, Clock, Target, Activity, Zap, Hash, Flame, Server, BarChart, AlertCircle } from "lucide-svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { goto } from "$app/navigation";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { onMount, onDestroy } from "svelte";
  import * as powBackendAPI from "$lib/api/powBackend";
  import Panel from "$lib/components/common/Panel.svelte";
  import { auth } from "$lib/stores/auth";
  
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

      const principalText = token.principal.toString();

      try {
        // Get mining info
        const miningInfo = await powBackendAPI.getMiningInfo(principalText);
        if (miningInfo) {
          difficulty = miningInfo.current_difficulty;
          nextHalvingInterval = miningInfo.next_halving_interval;
          blockReward = miningInfo.current_block_reward;
          
          // Calculate next halving block
          const currentHeightNum = typeof blockHeight === 'bigint' ? Number(blockHeight) : blockHeight;
          const halvingIntervalNum = typeof nextHalvingInterval === 'bigint' ? Number(nextHalvingInterval) : nextHalvingInterval;

          if (currentHeightNum > 0 && halvingIntervalNum > 0) {
            nextHalvingBlock = Math.ceil(currentHeightNum / halvingIntervalNum) * halvingIntervalNum;
            
            // Estimate time to halving
            if (blockTime > 0) {
              const secondsToHalving = blocksToHalving * blockTime; 
              timeToHalving = formatTimeDuration(secondsToHalving);
            }
          }
        }
      } catch (miningInfoError) {
        console.warn('Error fetching mining info:', miningInfoError);
      }
      
      try {
        // Get miners count
        const miners = await powBackendAPI.getMiners(principalText);
        if (miners && Array.isArray(miners)) {
          minerCount = miners.filter(m => m && m.status && m.status.hasOwnProperty('Active')).length;
        }
      } catch (minersError) {
        console.warn('Error fetching miners:', minersError);
      }
      
      try {
        // Update block height
        const height = await powBackendAPI.getBlockHeight(principalText);
        if (typeof height === 'number' || typeof height === 'bigint') {
          blockHeight = height;
        }
      } catch (heightError) {
        console.warn('Error fetching block height:', heightError);
      }
      
      try {
        // Update block time
        const avgBlockTime = await powBackendAPI.getAverageBlockTime(principalText, 10n);
        if (avgBlockTime) {
          blockTime = avgBlockTime;
        }
      } catch (blockTimeError) {
        console.warn('Error fetching block time:', blockTimeError);
      }
      
      try {
        // Update circulation and total supply
        const metrics = await powBackendAPI.getMetrics(principalText);
        if (metrics) {
          circulatingSupply = metrics.circulating_supply;
          totalSupply = metrics.total_supply;
        }
      } catch (metricsError) {
        console.warn('Error fetching metrics:', metricsError);
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

<Panel
  className="group/card transition-all duration-200 hover:scale-[1.02] hover:z-10 !p-0 !m-0 h-full"
  variant="solid"
  roundness="rounded-xl"
  interactive={true}
  shadow="shadow-md hover:shadow-lg"
>
  <button
    class="w-full h-full text-left relative overflow-hidden outline-none"
    onclick={handleTokenClick}
  >
    <!-- Top-right chain type badge -->
    {#if token.chain}
      {@const chainName = Object.keys(token.chain)[0]}
      <div class="absolute top-0 right-0 py-1 px-2 text-xs font-medium rounded-bl-md bg-kong-accent-blue/90 text-white z-10">
        {chainName || 'UNKNOWN'}
      </div>
    {/if}

    <!-- Card content -->
    <div class="p-4 sm:p-5">
      <!-- Header section with coin and title -->
      <div class="flex items-center gap-4 mb-4">
        <!-- Token logo/icon -->
        <div class="relative flex-shrink-0">
          <div class="w-14 h-14 rounded-full overflow-hidden border-2 border-kong-border/20 shadow-inner-white flex items-center justify-center bg-kong-bg-dark">
            {#if token.logo && ((Array.isArray(token.logo) && token.logo.length > 0 && token.logo[0]) || typeof token.logo === 'string')}
              <img
                src={Array.isArray(token.logo) ? token.logo[0] : token.logo}
                alt={token.name}
                class="w-full h-full object-cover"
              />
            {:else}
              <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-kong-accent-blue/30 to-kong-accent-green/30">
                {#if token.ticker}
                  <span class="font-play text-base font-bold text-white">{token.ticker.substring(0, 2)}</span>
                {:else}
                  <Zap size={20} class="text-white" />
                {/if}
              </div>
            {/if}
          </div>
          
          <!-- Mining progress ring overlaid -->
          <div class="absolute -inset-1">
            <svg viewBox="0 0 100 100" class="w-16 h-16">
              <!-- Background track -->
              <circle cx="50" cy="50" r="44" fill="transparent" stroke="rgba(255,255,255,0.05)" stroke-width="3" />
              
              <!-- Progress arc -->
              <circle 
                cx="50" 
                cy="50" 
                r="44" 
                fill="transparent" 
                stroke-width="3"
                stroke-dasharray={`${2 * Math.PI * 44 * miningProgress / 100} ${2 * Math.PI * 44}`}
                stroke-dashoffset="0"
                stroke-linecap="round"
                class="transition-all duration-500 ease-out"
                style="transform: rotate(-90deg); transform-origin: center;"
                stroke="url(#progress-gradient-{token.principal.toString()})"
              />
              
              <!-- Define gradient based on progress -->
              <defs>
                <linearGradient id="progress-gradient-{token.principal.toString()}" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" class="{progressColor.split(' ')[0]} stop-color" />
                  <stop offset="100%" class="{progressColor.split(' ')[1]} stop-color" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
        
        <!-- Title and badges -->
        <div class="flex-1 min-w-0">
          <!-- Token name with progress percentage -->
          <div class="flex items-center justify-between">
            <h3 class="font-alumni font-bold tracking-wider text-xl text-white group-hover/card:text-kong-accent-blue transition-colors duration-200 line-clamp-1 hover:line-clamp-none">
              {token.name || "Unnamed Token"}
            </h3>
            <!-- Progress percentage -->
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold tabular-nums bg-gradient-to-r {progressColor} bg-opacity-20 text-white">
              {miningProgress}%
            </span>
          </div>
          
          <!-- Token badges/tags -->
          <div class="flex flex-wrap gap-1.5 mt-1">
            <!-- Token ticker -->
            <span class="px-2 py-0.5 rounded-md bg-kong-bg-light/30 text-xs font-medium text-white/90">
              {token.ticker || "???"}
            </span>
            
            <!-- ICRC standards -->
            <span class="px-2 py-0.5 rounded-md bg-kong-bg-light/30 text-xs font-medium text-kong-accent-green/90">
              ICRC-1/2/3
            </span>
            
            <!-- Block height -->
            <span class="px-2 py-0.5 rounded-md bg-kong-bg-light/30 text-xs font-medium text-kong-text-secondary">
              Block #{formatCompactNumber(blockHeight, 0)}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Halving countdown if applicable -->
      {#if blocksToHalving > 0}
        <div class="mb-4 p-3 rounded-md bg-gradient-to-r from-kong-accent-blue/10 via-kong-accent-yellow/5 to-kong-accent-red/10 border border-kong-border/30">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Clock size={16} class="text-kong-accent-yellow" />
              <span class="text-sm font-medium text-kong-text-primary">Halving in:</span>
            </div>
            <div class="font-play text-sm font-bold text-kong-accent-yellow">
              {timeToHalving || `${formatCompactNumber(blocksToHalving, 0)} blocks`}
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Mining stats grid -->
      <div class="grid grid-cols-3 gap-3">
        <!-- Stats cards using similar pattern to prediction markets -->
        
        <!-- Block Time -->
        <div class="flex flex-col p-3 rounded-md bg-kong-bg-light/5 border border-kong-border/10 transition-colors hover:bg-kong-bg-light/10">
          <div class="flex items-center gap-2 mb-1">
            <div class="p-1.5 rounded-full bg-kong-accent-yellow/10">
              <Clock size={12} class="text-kong-accent-yellow" />
            </div>
            <span class="text-xs uppercase font-medium text-kong-text-secondary">Block Time</span>
          </div>
          <div class="font-play text-sm font-bold text-kong-text-primary mt-1">
            {formatBlockTime(blockTime)}
          </div>
        </div>
        
        <!-- Network Difficulty -->
        <div class="flex flex-col p-3 rounded-md bg-kong-bg-light/5 border border-kong-border/10 transition-colors hover:bg-kong-bg-light/10">
          <div class="flex items-center gap-2 mb-1">
            <div class="p-1.5 rounded-full bg-kong-accent-purple/10">
              <Hash size={12} class="text-kong-accent-purple" />
            </div>
            <span class="text-xs uppercase font-medium text-kong-text-secondary">Difficulty</span>
          </div>
          <div class="font-play text-sm font-bold text-kong-text-primary mt-1">
            {formatCompactNumber(difficulty, 2)}
          </div>
        </div>
        
        <!-- Miners -->
        <div class="flex flex-col p-3 rounded-md bg-kong-bg-light/5 border border-kong-border/10 transition-colors hover:bg-kong-bg-light/10">
          <div class="flex items-center gap-2 mb-1">
            <div class="p-1.5 rounded-full bg-kong-accent-green/10">
              <Server size={12} class="text-kong-accent-green" />
            </div>
            <span class="text-xs uppercase font-medium text-kong-text-secondary">Miners</span>
          </div>
          <div class="font-play text-sm font-bold text-kong-text-primary mt-1">
            {minerCount > 0 ? minerCount : '--'}
          </div>
        </div>
      </div>
      
      <!-- Footer with view details indicator -->
      <div class="mt-4 flex items-center justify-end">
        <div class="flex items-center gap-1.5 text-sm text-kong-accent-blue transition-colors group-hover/card:text-kong-accent-blue/80">
          <span class="font-medium">View Details</span>
          <ArrowRight size={16} class="transition-transform group-hover/card:translate-x-1" />
        </div>
      </div>
    </div>
  </button>
</Panel>

<style>
  /* Tailwind gradient text fallback */
  .from-kong-accent-blue.stop-color { stop-color: rgb(0, 149, 235); }
  .to-kong-accent-blue.stop-color { stop-color: rgb(0, 149, 235); }
  .from-kong-accent-green.stop-color { stop-color: rgb(0, 203, 160); }
  .to-kong-accent-green.stop-color { stop-color: rgb(0, 203, 160); }
  .from-orange-500.stop-color { stop-color: rgb(249, 115, 22); }
  .to-kong-accent-red.stop-color { stop-color: rgb(255, 59, 59); }
</style>
