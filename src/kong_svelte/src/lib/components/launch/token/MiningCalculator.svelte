<script lang="ts">
  import { onMount } from 'svelte';
  import { AlertTriangle, ArrowRight, Settings, Clock, Zap, ChevronsRight, TrendingUp } from 'lucide-svelte';
  export let blockReward = 0;
  export let halvingBlocks = 0;
  export let blockTimeSeconds = 0;
  export let maxSupply: number = 0;
  // Set isDynamicSupply to false by default - we want manual control
  let isDynamicSupply = false;
  export let decimals = 8;
  export let circulationDays = 0;
  export let totalMined = 0;
  export let minedPercentage = "0%";
  export let tokenTicker = "";
  export let tokenLogo = "";
  export let name = "";
  export let transferFee = 0;
  export let miningComplete = false;
  export let currentSubStep = 1; // This will be bound to the parent component

  // Track whether we're in preset view or custom view
  $: isCustomView = currentSubStep === 2;

  // Track which preset is currently selected
  let selectedPreset: string | null = null;

  type Preset = {
    id: string;
    name: string;
    description: string;
    blockReward: number;
    halvingBlocks: number;
    blockTimeSeconds: number;
    maxSupply: number;
    category: 'popular' | 'fast' | 'balanced' | 'slow';
    icon?: string;
  };

  const presets: Preset[] = [
    {
      id: "bitcoin",
      name: "Bitcoin Classic",
      description: "The original deflationary model with halving every 210,000 blocks",
      blockReward: 50,
      halvingBlocks: 210000,
      blockTimeSeconds: 600,
      maxSupply: 21000000,
      category: 'popular',
      icon: "₿"
    },
    {
      id: "bitcoin-turbo",
      name: "Rapid Bitcoin",
      description: "Bitcoin economics with much faster block times",
      blockReward: 50,
      halvingBlocks: 210000,
      blockTimeSeconds: 60,
      maxSupply: 21000000,
      category: 'fast',
      icon: "⚡"
    },
    {
      id: "litecoin",
      name: "Litecoin",
      description: "Faster blocks and 4x the supply of Bitcoin",
      blockReward: 50,
      halvingBlocks: 840000,
      blockTimeSeconds: 150,
      maxSupply: 84000000,
      category: 'popular',
      icon: "Ł"
    },
    {
      id: "dogecoin",
      name: "Dogecoin",
      description: "High reward with fast blocks and larger supply",
      blockReward: 10000,
      halvingBlocks: 100000,
      blockTimeSeconds: 60,
      maxSupply: 100000000000,
      category: 'popular',
      icon: "Ð"
    },
    {
      id: "hyper-fast",
      name: "Lightning Fast",
      description: "Extremely fast blocks for high-frequency mining",
      blockReward: 10,
      halvingBlocks: 3000000,
      blockTimeSeconds: 5,
      maxSupply: 30000000,
      category: 'fast',
      icon: "🚀"
    },
    {
      id: "slow-burn",
      name: "Steady Miner",
      description: "Slow and steady with high rewards",
      blockReward: 500,
      halvingBlocks: 50000,
      blockTimeSeconds: 900,
      maxSupply: 25000000,
      category: 'slow',
      icon: "🐢"
    },
    {
      id: "bitcoin-slow",
      name: "Bitcoin Long",
      description: "Bitcoin-style with slower block times",
      blockReward: 50,
      halvingBlocks: 210000,
      blockTimeSeconds: 1200,
      maxSupply: 21000000,
      category: 'slow',
      icon: "₿"
    },
    {
      id: "balanced",
      name: "Balanced",
      description: "Balanced parameters for steady emission",
      blockReward: 100,
      halvingBlocks: 250000,
      blockTimeSeconds: 60,
      maxSupply: 50000000,
      category: 'balanced',
      icon: "⚖️"
    },
    {
      id: "goldcoin",
      name: "Gold Standard",
      description: "Medium-paced mining with balanced rewards",
      blockReward: 50,
      halvingBlocks: 210000,
      blockTimeSeconds: 180,
      maxSupply: 21000000,
      category: 'balanced',
      icon: "🔶"
    },
    {
      id: "eth-classic",
      name: "Ethereum Style",
      description: "Similar to early Ethereum economics",
      blockReward: 5,
      halvingBlocks: 0, // No halvings
      blockTimeSeconds: 13,
      maxSupply: 210000000,
      category: 'popular',
      icon: "Ξ"
    }
  ];

  // Group presets by category
  $: popularPresets = presets.filter(p => p.category === 'popular');
  $: fastPresets = presets.filter(p => p.category === 'fast');
  $: balancedPresets = presets.filter(p => p.category === 'balanced');
  $: slowPresets = presets.filter(p => p.category === 'slow');

  // Track which preset's timeline is being shown
  let selectedPresetForTimeline: string | null = null;
  let presetTimeline: TimelinePeriod[] = [];
  
  function applyPreset(preset: Preset) {
    // When applying a preset, we use its fixed maxSupply
    blockReward = preset.blockReward;
    halvingBlocks = preset.halvingBlocks;
    blockTimeSeconds = preset.blockTimeSeconds;
    maxSupply = preset.maxSupply;
    selectedPreset = preset.id; // Mark this preset as selected
  }

  function switchToCustomView() {
    // When switching to custom view, we'll maintain the current maxSupply
    currentSubStep = 2;
  }

  function continueWithSelectedPreset() {
    // Keep the preset supply when continuing
    currentSubStep = 2;
  }

  // Helper functions for unit conversion
  function toBaseUnits(tokenUnits: number): number {
    return tokenUnits * (10 ** decimals);
  }
  
  function toTokenUnits(baseUnits: number): number {
    return baseUnits / (10 ** decimals);
  }

  function formatNumber(n: number): string {
    if (!n) return "0";
    if (n < 1 && n >= minimumUnit) {
      // For very small numbers, use scientific notation if too long
      if (n < 0.0001) {
        return n.toExponential(2);
      }
      return n.toFixed(decimals).replace(/\.?0+$/, '');
    }
    if (n >= 1000000000) {
      return (n / 1000000000).toFixed(1) + "B";
    } else if (n >= 1000000) {
      return (n / 1000000).toFixed(1) + "M";
    } else if (n >= 1000) {
      return Math.floor(n / 1000).toLocaleString() + "K";
    }
    return n.toLocaleString();
  }

  // Add timeline type
  type TimelinePeriod = {
    reward: number; // Store in token units
    blocks: number;
    durationDays: number;
    mined: number; // Store in token units
    economicallyViable: boolean;
  };

  let timeline: TimelinePeriod[] = [];
  let finalReward = 0;
  let incompleteMiningWarning = false;
  let circulationYears = "0";
  let showAllPeriods = false;

  // Calculate in base units to avoid floating point issues
  let minimumUnit = 1 / (10 ** decimals);

  // Add to existing variables
  let totalHalvings = 0;

  // Add state for tracking effective halvings before transfer fee limit
  let effectiveHalvingLimit = 0;
  let effectiveHalvingLimitReached = false;
  let transferFeeLimitReached = false;

  // Add this computed value to convert transferFee to base units
  $: transferFeeBaseUnits = transferFee; 

  $: {
    timeline = [];
    let remainingSupply = maxSupply;
    // Convert input values to base units for calculations
    let currentRewardBaseUnits = toBaseUnits(blockReward);
    let totalBlocks = 0;
    totalMined = 0;
    finalReward = 0;
    incompleteMiningWarning = false;
    circulationDays = 0;
    totalHalvings = 0;
    effectiveHalvingLimit = 0;
    effectiveHalvingLimitReached = false;
    transferFeeLimitReached = false;

    if (maxSupply && blockReward && halvingBlocks >= 0 && blockTimeSeconds) {
      // First, check if the initial reward is already below transfer fee
      if (transferFeeBaseUnits > 0 && currentRewardBaseUnits <= transferFeeBaseUnits) {
        transferFeeLimitReached = true;
      }

      // Continue mining simulation until out of supply, regardless of transfer fee
      while (remainingSupply > 0) {
        // Convert to token units for calculation
        const currentRewardTokenUnits = toTokenUnits(currentRewardBaseUnits);
        
        // Calculate how many blocks in this period
        const blocksInPeriod = halvingBlocks === 0 
          ? Math.ceil(remainingSupply / currentRewardTokenUnits)
          : Math.min(halvingBlocks, Math.ceil(remainingSupply / currentRewardTokenUnits));
        
        if (blocksInPeriod <= 0) break;

        // Calculate exact amount mined in this period (in token units)
        const exactMinedTokenUnits = blocksInPeriod * currentRewardTokenUnits;
        
        // Keep track of economically viable mining - only if transfer fee is greater than zero
        // rewards <= transfer fee are not economically viable
        const economicallyViable = transferFeeBaseUnits === 0 || currentRewardBaseUnits > transferFeeBaseUnits;
        
        // Calculate actual mined amount, capped by remaining supply (in token units)
        const actualMinedTokenUnits = Math.min(exactMinedTokenUnits, remainingSupply);

        // Calculate duration in days
        const periodDuration = (blocksInPeriod * blockTimeSeconds) / (24 * 60 * 60);
        circulationDays += periodDuration;

        // Add this period to the timeline (store in token units for display)
        timeline.push({
          reward: currentRewardTokenUnits,
          blocks: blocksInPeriod,
          durationDays: periodDuration,
          mined: actualMinedTokenUnits,
          economicallyViable
        });

        // Update totals
        totalBlocks += blocksInPeriod;
        totalMined += actualMinedTokenUnits;
        remainingSupply -= actualMinedTokenUnits;
        finalReward = currentRewardTokenUnits;
        
        // Handle halving logic
        if (halvingBlocks > 0 && blocksInPeriod === halvingBlocks) {
          // Calculate next reward exactly as backend does (in base units)
          if (halvingBlocks === 0) {
            // No halvings - same as backend logic
            // No change needed
          } else {
            // Calculate halving exactly as backend does (using bit shift)
            // This is equivalent to dividing by 2, but it's done in integer math in the backend
            currentRewardBaseUnits = Math.floor(currentRewardBaseUnits / 2); // Integer division to match backend
          }
          
          // Check if this is the first time we're dropping below transfer fee (only if transfer fee > 0)
          if (transferFeeBaseUnits > 0 && !transferFeeLimitReached && currentRewardBaseUnits <= transferFeeBaseUnits) {
            transferFeeLimitReached = true;
            effectiveHalvingLimit = totalHalvings + 1; // Current halving is the last effective one
          }
          
          // Increment halvings
          totalHalvings += 1;
          
          // If reached zero reward, stop (matches backend isComplete condition)
          if (currentRewardBaseUnits === 0) {
            break;
          }
        } else {
          // If this wasn't a halving round, we're done
          break;
        }
      }

      // If we never hit the transfer fee limit during simulation, set the effective limit 
      // to the total halvings (all halvings were effective)
      if (!transferFeeLimitReached && totalHalvings > 0) {
        effectiveHalvingLimit = totalHalvings;
      }

      // Mark if we hit the effective halving limit (only if transfer fee is non-zero)
      effectiveHalvingLimitReached = transferFeeBaseUnits > 0 && transferFeeLimitReached && effectiveHalvingLimit > 0;

      // Update warning condition - only show warning for supply gap, not for transfer fee limit
      incompleteMiningWarning = (remainingSupply / maxSupply) > 0.01 && 
                              !(transferFeeBaseUnits > 0 && transferFeeLimitReached);

      // Calculate percentage mined
      minedPercentage = ((totalMined / maxSupply) * 100).toFixed(1);
      
      // Calculate years for display if needed
      circulationYears = (circulationDays / 365).toFixed(1);
    }
  }

  function calculateRequiredBlockReward() {
    const remaining = maxSupply - totalMined;
    const required = remaining / (halvingBlocks > 0 ? halvingBlocks : 1000);
    blockReward = Math.ceil(required * 1.2); // Add 20% buffer
  }

  function calculateRequiredHalvingBlocks() {
    const remaining = maxSupply - totalMined;
    const required = remaining / blockReward;
    halvingBlocks = Math.ceil(required * 0.8); // Use 80% of calculated value
  }
  
  // Calculate total supply from mining parameters
  function calculateTotalSupply() {
    if (!blockReward || !halvingBlocks) return;
    
    // For Bitcoin-like halving schedule
    if (halvingBlocks > 0) {
      let calculatedSupply = 0;
      let currentReward = blockReward;
      let halving = 0;
      
      // Calculate through halvings until reward becomes negligible
      while (currentReward > 0.00001 && halving < 50) {
        calculatedSupply += currentReward * halvingBlocks;
        currentReward = Math.floor(currentReward / 2); // Integer division to match backend
        halving++;
      }
      
      // Round to a nice number
      const magnitude = Math.pow(10, Math.floor(Math.log10(calculatedSupply)));
      maxSupply = Math.ceil(calculatedSupply / magnitude) * magnitude;
    } else {
      // For non-halving tokens, use a reasonable fixed supply
      maxSupply = blockReward * 10000;
    }
  }
  
  // Only calculate total supply when explicitly requested, not automatically
  onMount(() => {
    // No automatic supply calculation on mount
  });

  // Function to get a quick description of mining duration
  function getDurationDescription(seconds: number, halvings: number): string {
    if (halvings === 0) {
      return "Single phase";
    }
    const totalDays = (halvings * halvingBlocks * seconds) / (24 * 60 * 60);
    
    if (totalDays < 30) {
      return `${Math.ceil(totalDays)} days`;
    } else if (totalDays < 365) {
      return `${Math.ceil(totalDays / 30)} months`;
    } else {
      return `${(totalDays / 365).toFixed(1)} years`;
    }
  }
  
  // Function to get block time description
  function getBlockTimeDescription(seconds: number): string {
    if (seconds < 10) return "Ultra Fast";
    if (seconds < 30) return "Very Fast";
    if (seconds < 60) return "Fast";
    if (seconds < 300) return "Medium";
    if (seconds < 600) return "Slow";
    return "Very Slow";
  }
  
  // Function to calculate emissions per day for a preset
  function getEmissionsPerDay(preset: Preset): number {
    return Math.floor(86400 / preset.blockTimeSeconds) * preset.blockReward;
  }

  // Quick calculation for estimated mining timeline
  function getEstimatedYears(preset: Preset): string {
    if (preset.halvingBlocks === 0) {
      return "∞";
    }
    
    let reward = preset.blockReward;
    let supply = preset.maxSupply;
    let days = 0;
    let halvingCount = 0;
    
    while (supply > 0 && halvingCount < 10) {
      const blocksPerDay = 86400 / preset.blockTimeSeconds;
      const daysToHalving = preset.halvingBlocks / blocksPerDay;
      const minedInPeriod = daysToHalving * blocksPerDay * reward;
      
      if (minedInPeriod >= supply) {
        // Final period
        days += supply / (reward * blocksPerDay);
        break;
      }
      
      days += daysToHalving;
      supply -= minedInPeriod;
      reward /= 2;
      halvingCount++;
      
      if (reward < 0.001) break;
    }
    
    const years = days / 365;
    if (years < 1) {
      return `${Math.ceil(days)} days`;
    }
    return `${years.toFixed(1)} years`;
  }

  // Calculate timeline for a preset
  function calculatePresetTimeline(preset: Preset) {
    // Reset timeline
    presetTimeline = [];
    
    let remainingSupply = preset.maxSupply;
    let currentReward = preset.blockReward;
    let totalDays = 0;
    
    if (preset.halvingBlocks === 0) {
      // For non-halving presets, calculate single period
      const blocksNeeded = Math.ceil(remainingSupply / currentReward);
      const durationDays = (blocksNeeded * preset.blockTimeSeconds) / (24 * 60 * 60);
      
      presetTimeline.push({
        reward: currentReward,
        blocks: blocksNeeded,
        durationDays: durationDays,
        mined: Math.min(blocksNeeded * currentReward, remainingSupply),
        economicallyViable: true
      });
      
      return;
    }
    
    // For halving presets
    let halvingCount = 0;
    
    while (remainingSupply > 0 && currentReward > 0.00001 && halvingCount < 10) {
      const blocksInPeriod = Math.min(preset.halvingBlocks, Math.ceil(remainingSupply / currentReward));
      const exactMined = blocksInPeriod * currentReward;
      const actualMined = Math.min(exactMined, remainingSupply);
      const periodDuration = (blocksInPeriod * preset.blockTimeSeconds) / (24 * 60 * 60);
      
      presetTimeline.push({
        reward: currentReward,
        blocks: blocksInPeriod,
        durationDays: periodDuration,
        mined: actualMined,
        economicallyViable: true
      });
      
      totalDays += periodDuration;
      remainingSupply -= actualMined;
      
      if (blocksInPeriod === preset.halvingBlocks) {
        currentReward = Math.floor(currentReward / 2);
        halvingCount++;
      } else {
        break;
      }
    }
  }

  function viewPresetTimeline(preset: Preset) {
    if (selectedPresetForTimeline === preset.id) {
      selectedPresetForTimeline = null;
      presetTimeline = [];
    } else {
      selectedPresetForTimeline = preset.id;
      calculatePresetTimeline(preset);
    }
  }
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
    <div class="flex items-center gap-3">
      <div class="w-1.5 h-6 rounded-full bg-kong-primary animate-pulse"></div>
      <h3 class="text-xl font-bold font-space-grotesk text-kong-text-primary">
        {isCustomView ? "Mining Dynamics Simulator" : "Select Mining Profile"}
      </h3>
    </div>
    {#if isCustomView}
      <!-- Custom view indicator -->
      <button 
        on:click={() => currentSubStep = 1}
        class="px-3 py-1.5 text-sm font-medium border rounded-lg text-kong-accent-blue border-kong-accent-blue/30 bg-kong-accent-blue/10 hover:bg-kong-accent-blue/20"
      >
        Back to Presets
      </button>
    {/if}
  </div>

  {#if !isCustomView}
    <!-- STEP 1: Preset Selection View -->
    <div class="transition-all duration-300 animate-fadeIn">
      <!-- Additional Presets Sections -->
      <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
        <!-- Fast Mining -->
        <div>
          <h4 class="flex items-center gap-2 mb-3 text-sm font-medium text-kong-text-primary">
            <div class="w-1 h-4 rounded-full bg-gradient-to-b from-kong-accent-green to-kong-primary"></div>
            Fast Mining
          </h4>
          
          <div class="space-y-3">
            {#each fastPresets as preset}
              <button 
                on:click={() => applyPreset(preset)}
                class="flex items-center w-full gap-3 p-3 transition-all duration-200 border rounded-lg group hover:border-kong-primary/30 bg-gradient-to-br from-kong-bg-dark/70 to-kong-bg-light/5 border-kong-border/20 {selectedPreset === preset.id ? 'ring-2 ring-kong-accent-green/70 border-kong-accent-green/30' : ''}"
              >
                <div class="flex items-center justify-center flex-shrink-0 w-8 h-8 text-base font-bold transition-all duration-200 border rounded-lg bg-gradient-to-br from-kong-primary/5 to-kong-accent-green/5 border-kong-primary/10 text-kong-accent-green">
                  {preset.icon || preset.name[0]}
                </div>
                <div class="overflow-hidden text-left">
                  <h5 class="text-sm font-medium truncate text-kong-text-primary">{preset.name}</h5>
                  <div class="flex flex-wrap mt-1 gap-x-4 gap-y-1">
                    <span class="text-xs text-kong-text-secondary/70">{preset.blockTimeSeconds}s blocks</span>
                    <span class="text-xs text-kong-accent-green">{preset.blockReward} rewards</span>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
        
        <!-- Balanced Mining -->
        <div>
          <h4 class="flex items-center gap-2 mb-3 text-sm font-medium text-kong-text-primary">
            <div class="w-1 h-4 rounded-full bg-gradient-to-b from-kong-primary to-kong-accent-blue"></div>
            Balanced Mining
          </h4>
          
          <div class="space-y-3">
            {#each balancedPresets as preset}
              <button 
                on:click={() => applyPreset(preset)}
                class="flex items-center w-full gap-3 p-3 transition-all duration-200 border rounded-lg group hover:border-kong-primary/30 bg-gradient-to-br from-kong-bg-dark/70 to-kong-bg-light/5 border-kong-border/20 {selectedPreset === preset.id ? 'ring-2 ring-kong-primary/70 border-kong-primary/30' : ''}"
              >
                <div class="flex items-center justify-center flex-shrink-0 w-8 h-8 text-base font-bold transition-all duration-200 border rounded-lg bg-gradient-to-br from-kong-primary/5 to-kong-accent-blue/5 border-kong-primary/10 text-kong-primary">
                  {preset.icon || preset.name[0]}
                </div>
                <div class="overflow-hidden text-left">
                  <h5 class="text-sm font-medium truncate text-kong-text-primary">{preset.name}</h5>
                  <div class="flex flex-wrap mt-1 gap-x-4 gap-y-1">
                    <span class="text-xs text-kong-text-secondary/70">{preset.blockTimeSeconds}s blocks</span>
                    <span class="text-xs text-kong-primary">{preset.blockReward} rewards</span>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
        
        <!-- Slow Mining -->
        <div>
          <h4 class="flex items-center gap-2 mb-3 text-sm font-medium text-kong-text-primary">
            <div class="w-1 h-4 rounded-full bg-gradient-to-b from-kong-accent-blue to-kong-accent-red"></div>
            Slow Mining
          </h4>
          
          <div class="space-y-3">
            {#each slowPresets as preset}
              <button 
                on:click={() => applyPreset(preset)}
                class="flex items-center w-full gap-3 p-3 transition-all duration-200 border rounded-lg group hover:border-kong-primary/30 bg-gradient-to-br from-kong-bg-dark/70 to-kong-bg-light/5 border-kong-border/20 {selectedPreset === preset.id ? 'ring-2 ring-kong-accent-red/70 border-kong-accent-red/30' : ''}"
              >
                <div class="flex items-center justify-center flex-shrink-0 w-8 h-8 text-base font-bold transition-all duration-200 border rounded-lg bg-gradient-to-br from-kong-accent-blue/5 to-kong-accent-red/5 border-kong-accent-red/10 text-kong-accent-red">
                  {preset.icon || preset.name[0]}
                </div>
                <div class="overflow-hidden text-left">
                  <h5 class="text-sm font-medium truncate text-kong-text-primary">{preset.name}</h5>
                  <div class="flex flex-wrap mt-1 gap-x-4 gap-y-1">
                    <span class="text-xs text-kong-text-secondary/70">{preset.blockTimeSeconds}s blocks</span>
                    <span class="text-xs text-kong-accent-red">{preset.blockReward} rewards</span>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Preview of Selected Parameters -->
      <div class="p-5 mt-6 border rounded-xl bg-gradient-to-br from-kong-bg-dark/60 to-kong-bg-light/5 border-kong-border/20">
        <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h4 class="text-base font-medium text-kong-text-primary">Selected Mining Profile</h4>
          <div class="flex items-center gap-2">
            <button
              on:click={switchToCustomView}
              class="flex items-center gap-1 px-3 py-2 text-sm transition-all duration-200 rounded-lg bg-kong-bg-dark/60 text-kong-text-primary hover:bg-kong-bg-dark/80"
            >
              <Settings size={16} />
              <span>Create Custom</span>
            </button>
            <button 
              on:click={continueWithSelectedPreset}
              class="px-4 py-2 text-sm font-medium text-white transition-all duration-200 rounded-lg bg-gradient-to-r from-kong-primary to-kong-accent-blue hover:from-kong-primary/90 hover:to-kong-accent-blue/90"
            >
              Customize This Preset
            </button>
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <div class="overflow-hidden border rounded-lg bg-gradient-to-br from-kong-bg-dark/80 to-kong-bg-light/5 border-kong-border/20">
            <div class="px-3 py-2">
              <span class="text-xs font-medium text-kong-text-secondary/70">Block Reward</span>
              <div class="mt-1 text-lg font-bold text-kong-primary">{blockReward} <span class="text-xs text-kong-text-secondary/70">{tokenTicker || "tokens"}</span></div>
            </div>
          </div>
          
          <div class="overflow-hidden border rounded-lg bg-gradient-to-br from-kong-bg-dark/80 to-kong-bg-light/5 border-kong-border/20">
            <div class="px-3 py-2">
              <span class="text-xs font-medium text-kong-text-secondary/70">Block Time</span>
              <div class="mt-1 text-lg font-bold text-kong-accent-blue">{blockTimeSeconds} <span class="text-xs text-kong-text-secondary/70">seconds</span></div>
            </div>
          </div>
          
          <div class="overflow-hidden border rounded-lg bg-gradient-to-br from-kong-bg-dark/80 to-kong-bg-light/5 border-kong-border/20">
            <div class="px-3 py-2">
              <span class="text-xs font-medium text-kong-text-secondary/70">Halving Blocks</span>
              <div class="mt-1 text-lg font-bold text-kong-accent-green">{halvingBlocks ? halvingBlocks.toLocaleString() : "None"}</div>
            </div>
          </div>
          
          <div class="overflow-hidden border rounded-lg bg-gradient-to-br from-kong-bg-dark/80 to-kong-bg-light/5 border-kong-border/20">
            <div class="px-3 py-2">
              <span class="text-xs font-medium text-kong-text-secondary/70">Total Supply</span>
              <div class="mt-1 text-lg font-bold text-kong-text-primary">{formatNumber(maxSupply)} <span class="text-xs text-kong-text-secondary/70">{tokenTicker || "tokens"}</span></div>
            </div>
          </div>
        </div>
        
        <!-- Supply Progress Bar Preview -->
        <div class="px-4 pt-4 mt-6 border-t border-kong-border/20">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-kong-text-primary">Estimated Timeline</span>
            <span class="text-xs text-kong-accent-blue">
              {circulationDays > 365 ? `${circulationYears} years` : `${Math.ceil(circulationDays)} days`}
            </span>
          </div>
          <div class="w-full h-3 mb-2 overflow-hidden rounded-full bg-kong-bg-dark/80">
            <div 
              class="h-3 transition-all duration-500 bg-gradient-to-r from-kong-primary to-kong-accent-blue" 
              style="width: {minedPercentage}%"
            ></div>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-kong-text-secondary">0%</span>
            <span class="font-medium text-kong-primary">{minedPercentage}% Minable</span>
            <span class="text-kong-text-secondary">100%</span>
          </div>
        </div>
      </div>
    </div>

  {:else}
    <!-- STEP 2: Custom Configuration View -->
    <!-- Mining Complete Banner -->
    {#if miningComplete}
      <div class="p-4 mb-6 border rounded-xl bg-gradient-to-br from-kong-accent-green/20 to-kong-bg-dark/50 border-kong-accent-green/30">
        <div class="flex items-center gap-3">
          <div class="w-2 h-2 rounded-full bg-kong-accent-green animate-pulse"></div>
          <h4 class="text-lg font-medium text-kong-accent-green">Mining Complete</h4>
        </div>
        <p class="mt-2 text-sm text-kong-text-secondary/80">
          This token has reached its maximum supply or minimum reward threshold. No new blocks will be mined.
        </p>
      </div>
    {/if}

    <div class="grid gap-8 lg:grid-cols-2">
      <!-- Left Column - Inputs -->
      <div class="space-y-6">

        <div class="space-y-4">
          <!-- Block Reward Input -->
          <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-kong-text-primary/80">Block Reward</label>
              <div class="flex items-center gap-1">
                <button 
                  on:click={() => blockReward = Math.max(1, blockReward / 2)} 
                  class="w-6 h-6 font-bold transition-colors rounded-full text-kong-text-secondary hover:bg-kong-bg-dark/70 hover:text-kong-text-primary"
                >
                  -
                </button>
                <button 
                  on:click={() => blockReward = blockReward * 2} 
                  class="w-6 h-6 font-bold transition-colors rounded-full text-kong-text-secondary hover:bg-kong-bg-dark/70 hover:text-kong-text-primary"
                >
                  +
                </button>
              </div>
            </div>
            
            <div class="flex items-center mb-2">
              <input
                type="range"
                bind:value={blockReward}
                min="1"
                max="10000"
                step="1"
                class="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-kong-bg-dark/70 accent-kong-primary"
              />
              <div class="flex items-center justify-center w-20 h-8 ml-3 font-mono text-sm rounded bg-kong-bg-dark/70 text-kong-primary">
                {blockReward}
              </div>
            </div>
            
            <div class="relative">
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg class="w-5 h-5 text-kong-text-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <input
                type="number"
                bind:value={blockReward}
                min="0"
                step="1"
                class="w-full py-3 pl-10 pr-4 text-sm transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
                placeholder="e.g., 50, 100, 1000"
              />
            </div>
            
            <div class="flex items-center justify-between mt-2 text-xs">
              <div class="flex items-center gap-1.5 text-kong-text-secondary/70">
                <span class="w-2 h-2 rounded-full bg-kong-primary/80 animate-pulse"></span>
                <span>{blockReward.toLocaleString()} {tokenTicker || "tokens"}/block</span>
              </div>
              <div class="px-2 py-0.5 rounded bg-kong-bg-dark/30 text-kong-text-secondary/70">
                {((blockReward * blockTimeSeconds) * 24 * 60 * 60 / blockTimeSeconds).toLocaleString()} daily emission
              </div>
            </div>
          </div>

          <!-- Halving Blocks Input -->
          <div class="p-4 rounded-xl bg-kong-bg-light/30 border-kong-border/20">
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-kong-text-primary/80">Halving Interval</label>
              <div class="flex items-center gap-2">
                <button 
                  on:click={() => halvingBlocks = 0} 
                  class={`px-2 py-0.5 text-xs rounded-lg transition-all duration-200 ${halvingBlocks === 0 ? 'bg-kong-primary/20 text-kong-primary' : 'bg-kong-bg-dark/50 text-kong-text-secondary hover:text-kong-text-primary'}`}
                >
                  None
                </button>
              </div>
            </div>
            
            <div class="p-3 mb-3 rounded-lg bg-gradient-to-r from-kong-bg-dark/50 to-kong-bg-light/10">
              <div class="flex items-center justify-between text-sm">
                <span class="text-xs text-kong-text-secondary/70">Continuous</span>
                <span class="text-xs font-medium text-kong-primary">Periodic Halvings</span>
              </div>
              <input
                type="range"
                bind:value={halvingBlocks}
                min="0"
                max="1000000"
                step="10000"
                disabled={halvingBlocks === 0}
                class="w-full h-2 mt-2 rounded-lg appearance-none cursor-pointer bg-kong-bg-dark/70 accent-kong-primary"
              />
              <div class="flex items-center justify-between mt-1">
                <span class="text-xs text-kong-text-secondary/70">Fixed Rate</span>
                <span class="text-xs text-kong-text-secondary/70">Deflationary</span>
              </div>
            </div>
            
            <div class="relative">
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg class="w-5 h-5 text-kong-text-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <input
                type="number"
                bind:value={halvingBlocks}
                class="w-full py-3 pl-10 pr-4 text-sm transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
                min="0"
                placeholder="e.g., 210000 (like Bitcoin)"
              />
            </div>
            
            <div class="flex items-center justify-between mt-2">
              {#if halvingBlocks > 0}
                <div class="flex items-center gap-1.5 text-xs text-kong-accent-blue">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Every {(halvingBlocks * blockTimeSeconds / 86400).toFixed(1)} days</span>
                </div>
                <div class="px-2 py-0.5 text-xs rounded bg-kong-bg-dark/30 text-kong-text-secondary/70">
                  {totalHalvings} halvings needed
                </div>
              {:else}
                <div class="text-xs text-kong-accent-green">Continuous emission (no halvings)</div>
                <div class="px-2 py-0.5 text-xs rounded bg-kong-bg-dark/30 text-kong-text-secondary/70">
                  Fixed rate
                </div>
              {/if}
            </div>
          </div>

          <!-- Block Time Input -->
          <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-kong-text-primary/80">Block Time Target</label>
              <div class="text-xs text-kong-accent-blue">Auto-adjusting</div>
            </div>
            
            <div class="p-3 mb-3 border rounded-lg bg-gradient-to-r from-kong-bg-dark/50 to-kong-bg-light/10 border-kong-border/10">
              <div class="flex items-center justify-between text-sm">
                <span class="text-xs text-kong-text-secondary/70">Fast</span>
                <span class="text-xs text-kong-text-secondary/70">Medium</span>
                <span class="text-xs text-kong-text-secondary/70">Slow</span>
              </div>
              <input
                type="range"
                bind:value={blockTimeSeconds}
                min="3"
                max="600"
                step="1"
                class="w-full h-2 mt-2 rounded-lg appearance-none cursor-pointer bg-kong-bg-dark/70 accent-kong-primary"
              />
              <div class="flex items-center justify-between mt-1">
                <span class="text-xs font-medium text-kong-accent-green">3s</span>
                <span class="text-xs font-medium text-kong-primary">30s</span>
                <span class="text-xs font-medium text-kong-accent-red">10m</span>
              </div>
            </div>
            
            <div class="relative">
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg class="w-5 h-5 text-kong-text-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <input
                type="number"
                bind:value={blockTimeSeconds}
                class="w-full py-3 pl-10 pr-4 text-sm transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
                min="3"
                placeholder="e.g., 30, 60, 600"
              />
            </div>
            
            <div class="flex flex-wrap items-center justify-between gap-2 mt-2">
              <div class="flex items-center gap-1.5 text-xs">
                <span class="w-2 h-2 rounded-full animate-pulse" class:bg-kong-accent-green={blockTimeSeconds < 30} class:bg-kong-primary={blockTimeSeconds >= 30 && blockTimeSeconds <= 120} class:bg-kong-accent-red={blockTimeSeconds > 120}></span>
                <span class="text-kong-text-secondary/70">
                  {#if blockTimeSeconds < 60}
                    {blockTimeSeconds} seconds per block
                  {:else}
                    {Math.floor(blockTimeSeconds / 60)} minute{Math.floor(blockTimeSeconds / 60) !== 1 ? 's' : ''} per block
                  {/if}
                </span>
              </div>
              <div class="px-2 py-0.5 text-xs rounded bg-kong-bg-dark/30 text-kong-text-secondary/70">
                ~{Math.floor(86400 / blockTimeSeconds).toLocaleString()} blocks daily
              </div>
            </div>
          </div>

          <!-- Supply Settings -->
          <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-kong-text-primary/80">Total Supply</label>
            </div>
            
            <div class="relative mb-3">
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg class="w-5 h-5 text-kong-text-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <input
                type="number"
                bind:value={maxSupply}
                class="w-full py-3 pl-10 pr-4 text-sm transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
                min="1"
                placeholder="e.g., 21000000"
              />
            </div>
            
            <div class="flex items-center justify-between text-xs text-kong-text-secondary/70">
              <div>Manually set supply</div>
              <span>{formatNumber(maxSupply)} {tokenTicker}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column - Visualizations -->
      <div class="p-6 border rounded-xl bg-gradient-to-br from-kong-bg-dark/50 to-kong-bg-light/10 border-kong-border/20">
        <!-- Supply Overview with Token Preview -->
        <div class="mb-6">
          <div class="flex flex-wrap items-center gap-4 mb-5">
            {#if tokenLogo}
              <img src={tokenLogo} alt={name || "Token"} class="object-cover w-12 h-12 rounded-lg" />
            {:else}
              <div class="flex items-center justify-center w-12 h-12 font-bold rounded-lg bg-gradient-to-br from-kong-primary/20 to-kong-accent-blue/20 text-kong-primary">
                {tokenTicker?.[0] || "T"}
              </div>
            {/if}
            <div>
              <h3 class="text-lg font-bold text-kong-text-primary">{name || "Your Token"}</h3>
              <div class="flex items-center gap-2 mt-1">
                <span class="px-2 py-0.5 text-xs rounded-full bg-kong-primary/20 text-kong-primary">{tokenTicker || "TOKEN"}</span>
                <span class="text-xs text-kong-text-secondary">Mining Simulation</span>
              </div>
            </div>
          </div>
          
          <!-- Interactive Supply Bar -->
          <div class="mb-6 overflow-hidden border rounded-lg bg-gradient-to-r from-kong-bg-dark/80 to-kong-bg-light/5 border-kong-border/20">
            <div class="p-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs font-medium uppercase text-kong-text-secondary/60">Total Supply</span>
                  <div class="font-mono text-2xl font-bold text-kong-text-primary">
                    {formatNumber(maxSupply)} <span class="text-sm text-kong-text-secondary">{tokenTicker}</span>
                  </div>
                </div>
                <div class="text-right">
                  <span class="text-xs font-medium uppercase text-kong-text-secondary/60">Mined</span>
                  <div class="font-mono text-xl font-bold text-transparent bg-gradient-to-r from-kong-primary to-kong-accent-blue bg-clip-text">
                    {minedPercentage}%
                  </div>
                </div>
              </div>
            </div>
            
            <div class="relative h-4 bg-kong-bg-dark/80">
              <div 
                class="absolute top-0 left-0 h-full transition-all duration-500 bg-gradient-to-r from-kong-primary to-kong-accent-blue" 
                style="width: {minedPercentage}%"
              >
                {#if parseFloat(minedPercentage) > 5}
                  <div class="absolute top-0 right-0 w-1 h-full bg-white/30"></div>
                {/if}
              </div>
              
              <!-- Future supply markers -->
              {#if halvingBlocks > 0}
                {#each Array(Math.min(5, totalHalvings)) as _, i}
                  <div 
                    class="absolute top-0 h-full border-l border-kong-text-secondary/30"
                    style="left: {Math.min(100, (100 / (2 ** (i + 1))))}%;"
                  ></div>
                {/each}
              {/if}
            </div>
          </div>

          <!-- Mining Stats Cards -->
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <!-- Days to Mine -->
            <div class="overflow-hidden border rounded-lg bg-gradient-to-br from-kong-bg-dark/80 to-kong-bg-light/5 border-kong-border/20">
              <div class="px-3 py-2 text-center">
                <span class="text-xs font-medium text-kong-text-secondary/70">Duration</span>
                <div class="flex items-center justify-center gap-1 mt-1">
                  <span class="text-xl font-bold text-kong-accent-blue">
                    {circulationDays > 365 ? `${(circulationDays/365).toFixed(1)}` : circulationDays.toFixed(0)}
                  </span>
                  <span class="text-xs text-kong-text-secondary/70">
                    {circulationDays > 365 ? 'years' : 'days'}
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Halvings -->
            <div class="overflow-hidden border rounded-lg bg-gradient-to-br from-kong-bg-dark/80 to-kong-bg-light/5 border-kong-border/20">
              <div class="px-3 py-2 text-center">
                <span class="text-xs font-medium text-kong-text-secondary/70">Halvings</span>
                <div class="flex items-center justify-center gap-1 mt-1">
                  <span class="text-xl font-bold text-transparent bg-gradient-to-r from-kong-primary to-kong-accent-green bg-clip-text">
                    {halvingBlocks === 0 ? '0' : totalHalvings}
                  </span>
                  <span class="text-xs text-kong-text-secondary/70">
                    {halvingBlocks === 0 ? 'none' : 'events'}
                  </span>
                </div>
                {#if effectiveHalvingLimitReached && effectiveHalvingLimit > 0}
                  <div class="mt-1 text-xs text-kong-accent-red">
                    {effectiveHalvingLimit} economically viable
                  </div>
                {/if}
              </div>
            </div>
            
            <!-- Daily Output -->
            <div class="overflow-hidden border rounded-lg bg-gradient-to-br from-kong-bg-dark/80 to-kong-bg-light/5 border-kong-border/20">
              <div class="px-3 py-2 text-center">
                <span class="text-xs font-medium text-kong-text-secondary/70">Daily Output</span>
                <div class="flex items-center justify-center gap-1 mt-1">
                  <span class="text-xl font-bold text-kong-primary">
                    {formatNumber(Math.floor(86400 / blockTimeSeconds) * blockReward)}
                  </span>
                  <span class="text-xs text-kong-text-secondary/70">
                    {tokenTicker}
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Final Reward -->
            <div class="overflow-hidden border rounded-lg bg-gradient-to-br from-kong-bg-dark/80 to-kong-bg-light/5 border-kong-border/20">
              <div class="px-3 py-2 text-center">
                <span class="text-xs font-medium text-kong-text-secondary/70">Final Reward</span>
                <div class="flex items-center justify-center gap-1 mt-1">
                  <span class="text-lg font-bold text-kong-accent-yellow">
                    {formatNumber(finalReward)}
                  </span>
                  <span class="text-xs text-kong-text-secondary/70">
                    {tokenTicker}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Warning Cards -->
        {#if incompleteMiningWarning}
          <div class="p-4 mb-6 border rounded-lg bg-gradient-to-br from-kong-accent-red/10 to-kong-bg-dark/50 border-kong-accent-red/30">
            <div class="flex items-start gap-3">
              <AlertTriangle class="flex-shrink-0 w-5 h-5 mt-0.5 text-kong-accent-red animate-pulse" />
              <div>
                <h4 class="text-sm font-medium text-kong-accent-red">Supply Gap Detected</h4>
                <p class="mt-1 text-xs text-kong-text-secondary/80">
                  Current parameters will only mine <span class="font-medium text-kong-accent-red">{minedPercentage}%</span> of total supply 
                  ({formatNumber(totalMined)} of {formatNumber(maxSupply)} {tokenTicker}).
                </p>
                <div class="flex flex-wrap gap-2 mt-3">
                  <button
                    on:click={calculateRequiredBlockReward}
                    class="px-3 py-1.5 text-xs rounded-lg bg-kong-accent-red/10 hover:bg-kong-accent-red/20 
                           text-kong-accent-red transition-all duration-200 border border-kong-accent-red/20"
                  >
                    Boost Block Reward
                  </button>
                  <button
                    on:click={calculateRequiredHalvingBlocks}
                    class="px-3 py-1.5 text-xs rounded-lg bg-kong-accent-red/10 hover:bg-kong-accent-red/20 
                           text-kong-accent-red transition-all duration-200 border border-kong-accent-red/20"
                  >
                    Extend Halving Interval
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}
        
        <!-- Transfer fee info note (only if effective halving limit reached) -->
        {#if effectiveHalvingLimitReached}
          <div class="p-4 mb-6 border rounded-lg bg-gradient-to-br from-kong-primary/10 to-kong-bg-dark/50 border-kong-primary/30">
            <div class="flex items-start gap-3">
              <Zap class="flex-shrink-0 w-5 h-5 mt-0.5 text-kong-primary" />
              <div>
                <h4 class="text-sm font-medium text-kong-primary">Transfer Fee Threshold</h4>
                <p class="mt-1 text-xs text-kong-text-secondary/80">
                  After {effectiveHalvingLimit} halvings, block rewards become smaller than the transfer fee 
                  ({(transferFeeBaseUnits / Math.pow(10, decimals)).toFixed(decimals)} {tokenTicker}).
                  <span class="text-kong-text-primary"> Locked periods in the timeline are not economically viable to mine.</span>
                </p>
              </div>
            </div>
          </div>
        {/if}

        <!-- Timeline Visualization -->
        {#if timeline.length > 0}
          <div class="pt-4 border-t border-kong-border/20">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-1 h-6 rounded-full bg-gradient-to-b from-kong-primary to-kong-accent-green"></div>
                <h4 class="text-base font-medium text-kong-text-primary">Mining Timeline</h4>
              </div>
              {#if timeline.length > 1}
                <button 
                  on:click={() => showAllPeriods = !showAllPeriods}
                  class="flex items-center gap-1 px-2 py-1 text-xs transition-colors rounded-lg text-kong-text-secondary hover:text-kong-text-primary bg-kong-bg-dark/30 hover:bg-kong-bg-dark/50"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={showAllPeriods ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                  </svg>
                  {showAllPeriods ? 'Collapse' : 'Expand All'}
                </button>
              {/if}
            </div>
            
            <!-- Timeline Visualization -->
            <div class="relative pb-4 pl-4 mb-2 border-l-2 border-dashed border-kong-border/30">
              <div class="absolute top-0 left-[-8px] w-4 h-4 rounded-full bg-kong-primary"></div>
              <div class="absolute bottom-0 left-[-6px] w-3 h-3 rounded-full bg-kong-accent-green"></div>
              
              {#if halvingBlocks > 0 && timeline.length > 1}
                {@const totalDuration = timeline.reduce((sum, period) => sum + period.durationDays, 0)}
                {@const cumulativeDurations = timeline.reduce((acc, period, idx) => {
                  const prevTotal = idx > 0 ? acc[idx-1] : 0;
                  acc.push(prevTotal + period.durationDays);
                  return acc;
                }, [])}
                
                {#each timeline.slice(0, timeline.length - 1) as _, i}
                  {#if i > 0}
                    <div 
                      class="absolute left-[-6px] w-3 h-3 rounded-full bg-kong-accent-blue" 
                      style="top: {(cumulativeDurations[i-1] / totalDuration) * 100}%;"
                    >
                      <div class="absolute left-4 transform -translate-y-1/2 px-1.5 py-0.5 text-[10px] rounded bg-kong-bg-dark/80 text-kong-accent-blue whitespace-nowrap">
                        Halving {i}
                      </div>
                    </div>
                  {/if}
                {/each}
              {/if}
            </div>
            
            <div class="space-y-3">
              {#each timeline.slice(0, showAllPeriods ? timeline.length : Math.min(3, timeline.length)) as period, i}
                <div class="p-4 transition-all duration-200 border rounded-lg bg-gradient-to-br from-kong-bg-dark/80 to-kong-bg-light/5 hover:from-kong-bg-dark/90 hover:to-kong-bg-light/0 border-kong-border/20 hover:border-kong-border/30
                  {!period.economicallyViable ? 'opacity-70' : ''}">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="flex items-center justify-center w-5 h-5 rounded-full bg-kong-bg-dark/70 text-kong-accent-blue">
                      <span class="text-xs font-bold">{i+1}</span>
                    </div>
                    <span class="font-medium text-kong-text-primary">
                      {i === 0 ? 'Initial Period' : i === timeline.length - 1 && halvingBlocks > 0 ? 'Final Period' : `Halving ${i}`}
                    </span>
                    {#if period.reward !== blockReward && i === 0}
                      <span class="px-1.5 py-0.5 text-xs rounded bg-kong-primary/10 text-kong-primary">Start</span>
                    {/if}
                    {#if !period.economicallyViable}
                      <span class="ml-auto flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-kong-bg-dark/50 text-kong-text-secondary/80">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>Locked</span>
                      </span>
                    {/if}
                  </div>
                  <div class="grid grid-cols-2 text-sm gap-x-6 gap-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-kong-text-secondary/80">Reward</span>
                      <span class="font-mono text-xs font-medium text-kong-primary">{formatNumber(period.reward)} {tokenTicker}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-kong-text-secondary/80">Duration</span>
                      <span class="font-mono text-xs font-medium text-kong-accent-blue">
                        {period.durationDays > 365 ? `${(period.durationDays/365).toFixed(1)}y` : `${period.durationDays.toFixed(1)}d`}
                      </span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-kong-text-secondary/80">Blocks</span>
                      <span class="font-mono text-xs font-medium text-kong-text-primary">{formatNumber(period.blocks)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-kong-text-secondary/80">Mined</span>
                      <span class="font-mono text-xs font-medium text-kong-accent-green">{formatNumber(period.mined)}</span>
                    </div>
                  </div>
                  
                  {#if i === 0 && timeline.length > 1}
                    <div class="mt-3 text-xs text-right text-kong-text-secondary/60">
                      First halving at block {halvingBlocks}
                    </div>
                  {/if}
                </div>
              {/each}
              
              {#if !showAllPeriods && timeline.length > 3}
                <button 
                  on:click={() => showAllPeriods = true}
                  class="flex items-center justify-center w-full gap-1 py-2 text-xs transition-all duration-200 border rounded-lg bg-kong-bg-dark/30 border-kong-border/20 hover:bg-kong-bg-dark/50 text-kong-text-secondary hover:text-kong-text-primary"
                >
                  <span>Show {timeline.length - 3} more periods</span>
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .shadow-glow {
    box-shadow: 0 0 20px rgba(var(--primary), 0.15);
  }
  
  .shadow-glow-sm {
    box-shadow: 0 0 10px rgba(var(--primary), 0.1);
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-in-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
