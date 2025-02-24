<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';
  export let blockReward = 0;
  export let halvingBlocks = 0;
  export let blockTimeSeconds = 0;
  export let maxSupply: number = 0;
  export let decimals = 8;
  export let circulationDays = 0;
  export let totalMined = 0;
  export let minedPercentage = "0%";
  export let tokenTicker = "";
  export let tokenLogo = "";
  export let name = "";
  export let transferFee = 0;
  export let miningComplete = false;

  type Preset = {
    name: string;
    blockReward: number;
    halvingBlocks: number;
    blockTimeSeconds: number;
    maxSupply: number;
  };

  const presets: Preset[] = [
    {
      name: "Bitcoin-like",
      blockReward: 50,
      halvingBlocks: 210000,
      blockTimeSeconds: 600,
      maxSupply: 21_000_000
    },
    {
      name: "Bitcoin-like-turbo",
      blockReward: 50,
      halvingBlocks: 2100000,
      blockTimeSeconds: 15,
      maxSupply: 21_000_000
    },
    {
      name: "Bitcoin-like-medium",
      blockReward: 50,
      halvingBlocks: 420000,
      blockTimeSeconds: 300,
      maxSupply: 21_000_000
    },
    {
      name: "Litecoin-like",
      blockReward: 50,
      halvingBlocks: 840000,
      blockTimeSeconds: 150,
      maxSupply: 84_000_000
    },
    {
      name: "Dogecoin-like",
      blockReward: 10000,
      halvingBlocks: 100000,
      blockTimeSeconds: 60,
      maxSupply: 100_000_000
    }
  ];

  function applyPreset(preset: Preset) {
    blockReward = preset.blockReward;
    halvingBlocks = preset.halvingBlocks;
    blockTimeSeconds = preset.blockTimeSeconds;
    maxSupply = preset.maxSupply;
  }

  function formatNumber(n: number): string {
    if (!n) return "0";
    if (n < 1 && n >= minimumUnit) {
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
    reward: number;
    blocks: number;
    durationDays: number;
    mined: number;
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

  $: {
    timeline = [];
    let remainingSupply = maxSupply;
    let currentReward = blockReward;
    let totalBlocks = 0;
    totalMined = 0;
    finalReward = 0;
    incompleteMiningWarning = false;
    circulationDays = 0;
    totalHalvings = 0;
    
    // Calculate practical minimum including transfer fee
    const precision = 10 ** decimals;
    const minimumSpendable = Math.max(minimumUnit, transferFee);

    if (maxSupply && blockReward && halvingBlocks >= 0 && blockTimeSeconds) {
      while (remainingSupply > 0 && currentReward >= minimumSpendable) {
        const blocksInPeriod = halvingBlocks === 0 
          ? Math.ceil(remainingSupply / currentReward)
          : Math.min(halvingBlocks, Math.ceil(remainingSupply / currentReward));
        
        if (blocksInPeriod <= 0) break;

        // Calculate actual mined amount ensuring it's spendable
        const exactMined = blocksInPeriod * currentReward;
        const adjustedMined = exactMined - (blocksInPeriod * transferFee);
        
        if (adjustedMined <= 0) break;

        const actualMined = Math.min(adjustedMined, remainingSupply);

        // Calculate duration FIRST
        const periodDuration = (blocksInPeriod * blockTimeSeconds) / (24 * 60 * 60);
        
        // Add to circulationDays HERE
        circulationDays += periodDuration;

        timeline.push({
          reward: currentReward,
          blocks: blocksInPeriod,
          durationDays: periodDuration, // Use pre-calculated value
          mined: actualMined
        });

        totalBlocks += blocksInPeriod;
        totalMined += actualMined;
        remainingSupply -= actualMined;
        finalReward = currentReward;
        
        if (halvingBlocks > 0 && blocksInPeriod === halvingBlocks) {
          const newReward = Math.floor((currentReward * precision) / 2) / precision;
          if (newReward < minimumSpendable) break;
          currentReward = newReward;
          totalHalvings += 1;
        } else {
          break;
        }
      }

      // Update warning condition
      incompleteMiningWarning = (remainingSupply / maxSupply) > 0.01;

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
</script>

<div class="space-y-6">
  <div class="flex items-center gap-3 mb-4">
    <div class="w-1.5 h-6 rounded-full bg-kong-primary animate-pulse"></div>
    <h3 class="text-xl font-bold font-space-grotesk text-kong-text-primary">
      Mining Dynamics Simulator
    </h3>
  </div>

  <!-- Mining Complete Banner -->
  {#if miningComplete}
    <div class="p-4 mb-6 rounded-xl bg-gradient-to-br from-kong-accent-green/20 to-kong-bg-dark/50 border border-kong-accent-green/30">
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
      <div class="p-4 rounded-xl bg-kong-bg-light/30">
        <h4 class="mb-3 text-sm font-medium text-kong-text-primary/80">Protocol Presets</h4>
        <div class="flex flex-wrap gap-2">
          {#each presets as preset}
            <button
              on:click={() => applyPreset(preset)}
              class="px-3 py-1.5 text-sm rounded-lg bg-gradient-to-br from-kong-bg-dark/50 to-kong-bg-light/30 
                     border border-kong-border/30 hover:border-kong-primary/50 hover:shadow-glow
                     transition-all duration-200"
            >
              <span class="text-transparent bg-gradient-to-r from-kong-primary to-kong-accent-blue bg-clip-text">
                {preset.name}
              </span>
            </button>
          {/each}
        </div>
      </div>

      <div class="space-y-4">
        <!-- Block Reward Input -->
        <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
          <label class="block mb-2 text-sm font-medium text-kong-text-primary/80">Block Reward</label>
          <input
            type="number"
            bind:value={blockReward}
            min="0"
            step="0.1"
            class="w-full px-4 py-3 transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
          />
          <div class="mt-2 text-xs text-kong-text-secondary/50">
            {#if blockReward > 0}
              <span class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-kong-primary/80 animate-pulse"></span>
                {blockReward.toLocaleString()} tokens/block
              </span>
            {:else}
              <span class="text-kong-accent-red/80">Required field</span>
            {/if}
          </div>
        </div>

        <!-- Halving Blocks Input -->
        <div class="p-4 rounded-xl bg-kong-bg-light/30 border-kong-border/20">
          <label class="block mb-2 text-sm font-medium text-kong-text-primary/80">Halving Cycle</label>
          <input
            type="number"
            bind:value={halvingBlocks}
            class="w-full px-4 py-3 transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
            min="0"
          />
          <div class="mt-2 text-xs text-kong-text-secondary/50">
            {#if halvingBlocks > 0}
              <span class="flex items-center gap-1.5">
                <svg class="w-4 h-4 fill-current text-kong-primary" viewBox="0 0 24 24">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Every {(halvingBlocks * blockTimeSeconds / 86400).toFixed(1)} days
              </span>
            {:else}
              Continuous emission
            {/if}
          </div>
        </div>

        <!-- Block Time Input -->
        <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
          <label class="block mb-2 text-sm font-medium text-kong-text-primary/80">Block Time</label>
          <input
            type="number"
            bind:value={blockTimeSeconds}
            class="w-full px-4 py-3 transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
            min="0"
          />
          <div class="flex items-start gap-1 mt-2 text-xs text-kong-text-secondary/50">
            <AlertTriangle class="flex-shrink-0 w-4 h-4 text-kong-accent-yellow/80" />
            <span>Difficulty algorithm auto-adjusts to maintain target block time</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Column - Visualizations -->
    <div class="p-6 rounded-xl bg-kong-bg-light/30 border-kong-border/20">
      <!-- Supply Overview -->
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-1.5 h-6 rounded-full bg-kong-accent-blue animate-pulse"></div>
          <h4 class="text-lg font-medium text-kong-text-primary">Supply Dynamics</h4>
        </div>
        
        <div class="p-4 mb-4 rounded-lg bg-kong-bg-dark/50">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-kong-text-secondary/80">Max Supply</span>
            <span class="font-mono text-kong-text-primary">{formatNumber(maxSupply)}</span>
          </div>
          <div class="h-2 rounded-full bg-kong-bg-light/30">
            <div 
              class="h-full transition-all duration-500 rounded-full bg-gradient-to-r from-kong-primary to-kong-accent-blue" 
              style="width: {minedPercentage}%"
            />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4 text-center">
          <div class="p-3 rounded-lg bg-kong-bg-dark/50">
            <p class="text-sm text-kong-text-secondary/80">Halvings</p>
            <p class="text-xl font-bold text-kong-primary">{totalHalvings}</p>
          </div>
          <div class="p-3 rounded-lg bg-kong-bg-dark/50">
            <p class="text-sm text-kong-text-secondary/80">Duration</p>
            <p class="text-xl font-bold text-kong-accent-blue">
              {circulationDays > 365 ? `${(circulationDays/365).toFixed(1)}y` : `${circulationDays.toFixed(0)}d`}
            </p>
          </div>
          <div class="p-3 rounded-lg bg-kong-bg-dark/50">
            <p class="text-sm text-kong-text-secondary/80">Mined</p>
            <p class="text-xl font-bold text-kong-text-primary">{formatNumber(totalMined)}</p>
          </div>
        </div>
      </div>

      {#if incompleteMiningWarning}
        <div class="p-4 mb-6 border rounded-lg bg-gradient-to-br from-kong-accent-red/20 to-kong-bg-dark/50 border-kong-accent-red/30">
          <div class="flex items-center gap-3 mb-2">
            <AlertTriangle class="w-5 h-5 text-kong-accent-red animate-pulse" />
            <h4 class="text-sm font-medium text-kong-accent-red">Supply Shortfall Detected</h4>
          </div>
          <p class="text-xs text-kong-text-secondary/80">
            Current parameters will only mine {minedPercentage} of total supply
          </p>
          <div class="flex gap-3 mt-4">
            <button
              on:click={calculateRequiredBlockReward}
              class="px-3 py-1.5 text-xs rounded-lg bg-kong-accent-red/20 hover:bg-kong-accent-red/30 
                     text-kong-accent-red transition-all duration-200"
            >
              Boost Reward
            </button>
            <button
              on:click={calculateRequiredHalvingBlocks}
              class="px-3 py-1.5 text-xs rounded-lg bg-kong-accent-red/20 hover:bg-kong-accent-red/30 
                     text-kong-accent-red transition-all duration-200"
            >
              Extend Halving
            </button>
          </div>
        </div>
      {/if}

      {#if timeline.length > 0}
        <div class="pt-4 border-t border-kong-border/20">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-1.5 h-6 rounded-full bg-kong-accent-green animate-pulse"></div>
              <h4 class="text-lg font-medium text-kong-text-primary">Emission Schedule</h4>
            </div>
            {#if timeline.length > 1}
              <button 
                on:click={() => showAllPeriods = !showAllPeriods}
                class="text-sm transition-colors text-kong-text-secondary hover:text-kong-text-primary"
              >
                {showAllPeriods ? 'Collapse' : 'Expand All'}
              </button>
            {/if}
          </div>
          
          <div class="space-y-3">
            {#each timeline.slice(0, showAllPeriods ? timeline.length : Math.min(2, timeline.length)) as period, i}
              <div class="p-4 transition-all duration-200 border rounded-lg bg-kong-bg-dark/50 hover:bg-kong-bg-dark/70 border-kong-border/30">
                <div class="flex items-center gap-3 mb-2">
                  <svg class="w-5 h-5 text-kong-accent-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                  <span class="font-medium text-kong-text-primary">Epoch {i + 1}</span>
                </div>
                <div class="grid grid-cols-2 gap-3 text-sm">
                  <div class="flex items-center gap-2">
                    <span class="text-kong-text-secondary/80">Reward:</span>
                    <span class="font-mono text-kong-primary">{formatNumber(period.reward)}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-kong-text-secondary/80">Duration:</span>
                    <span class="font-mono text-kong-accent-blue">{period.durationDays.toFixed(1)}d</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-kong-text-secondary/80">Blocks:</span>
                    <span class="font-mono text-kong-text-primary">{formatNumber(period.blocks)}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-kong-text-secondary/80">Mined:</span>
                    <span class="font-mono text-kong-accent-green">{formatNumber(period.mined)}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>

</style>
