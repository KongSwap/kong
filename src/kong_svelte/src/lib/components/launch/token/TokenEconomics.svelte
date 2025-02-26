<script lang="ts">
  import { Settings } from "lucide-svelte";

  // Economics parameters
  export let decimals: number = 8;
  // Ensure decimals is within valid range
  $: if (decimals < 6) decimals = 6;
  $: if (decimals > 18) decimals = 18;
  
  export let transferFee: number = 0; // Stored in base units (10^decimals)
  export let symbol: string = ""; // We need symbol from the TokenIdentity component for display
  
  // Ensure symbol is always uppercase for display
  $: displaySymbol = symbol.toUpperCase();
  
  let showAdvanced = false;
  let humanFee: string = (transferFee / 10 ** decimals).toFixed(decimals);
  let baseFeeInput: string = transferFee.toString();
  
  // Sync when decimals change
  $: {
    // Update human fee when base units change
    if (parseInt(baseFeeInput) !== transferFee) {
      humanFee = (Math.max(0, transferFee) / 10 ** decimals).toFixed(decimals);
      baseFeeInput = transferFee.toString();
    }
  }

  function updateFromHuman() {
    const value = parseFloat(humanFee);
    if (!isNaN(value) && value >= 0) {
      transferFee = Math.round(value * 10 ** decimals);
      baseFeeInput = transferFee.toString();
    } else {
      // Handle invalid input - reset to 0
      transferFee = 0;
      humanFee = "0";
      baseFeeInput = "0";
    }
  }

  function updateFromBase() {
    const value = parseInt(baseFeeInput);
    if (!isNaN(value) && value >= 0) {
      transferFee = value;
      humanFee = (value / 10 ** decimals).toFixed(decimals);
    } else {
      // Handle invalid input - reset to 0
      transferFee = 0;
      humanFee = "0";
      baseFeeInput = "0";
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-3 mb-6">
    <div class="w-1.5 h-6 rounded-full bg-kong-primary animate-pulse"></div>
    <h3 class="text-xl font-bold font-space-grotesk text-kong-text-primary">
      Token Economics & Precision
    </h3>
  </div>

  <div class="grid gap-6 md:grid-cols-2">
    <!-- Left Column: Transfer Fee -->
    <div>
      <!-- Transfer Fee -->
      <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
        <label class="block mb-2 text-sm font-medium text-kong-text-primary/80">
          Transfer Fee
        </label>
        
        <!-- Fee Presets -->
        <div class="flex flex-wrap gap-2 mb-3">
          <button 
            on:click={() => { humanFee = "0"; updateFromHuman(); }} 
            class={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${transferFee === 0 ? 'bg-kong-accent-green/20 border border-kong-accent-green/30 text-kong-accent-green' : 'bg-kong-bg-dark/50 border border-kong-border/30 text-kong-text-secondary hover:border-kong-primary/30'}`}
          >
            Free
          </button>
          <button 
            on:click={() => { humanFee = (0.0001).toFixed(4); updateFromHuman(); }} 
            class={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${transferFee === Math.round(0.0001 * 10 ** decimals) ? 'bg-kong-primary/20 border border-kong-primary/30 text-kong-primary' : 'bg-kong-bg-dark/50 border border-kong-border/30 text-kong-text-secondary hover:border-kong-primary/30'}`}
          >
            Common
          </button>
          <button 
            on:click={() => { humanFee = (0.01).toFixed(2); updateFromHuman(); }} 
            class={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${transferFee === Math.round(0.01 * 10 ** decimals) ? 'bg-kong-accent-red/20 border border-kong-accent-red/30 text-kong-accent-red' : 'bg-kong-bg-dark/50 border border-kong-border/30 text-kong-text-secondary hover:border-kong-primary/30'}`}
          >
            High
          </button>
        </div>
        
        <!-- Human Input -->
        <div class="mb-3">
          <div class="flex items-center">
            <input
              type="number"
              bind:value={humanFee}
              on:change={updateFromHuman}
              class="w-full px-4 py-3 text-sm transition-all duration-200 border rounded-l-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
              placeholder="0.00"
            />
            <div class="flex items-center h-12 px-4 text-sm border-t border-b border-r border-kong-border/30 rounded-r-xl text-kong-text-secondary bg-kong-bg-dark/30">
              {displaySymbol || "TOKEN"}
            </div>
          </div>
        </div>

        <!-- Fee Info Card -->
        <div class="p-3 border rounded-lg bg-gradient-to-r from-kong-bg-dark/50 to-kong-bg-light/10 border-kong-border/20">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-kong-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 class="text-sm font-medium text-kong-text-primary">Fee Impact</h4>
          </div>
          
          <div class="space-y-2 text-xs">
            {#if transferFee === 0}
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-kong-accent-green animate-pulse"></div>
                <span class="text-kong-accent-green">Free transfers (zero fee)</span>
              </div>
              <p class="text-kong-text-secondary/60">Users can transfer tokens without any cost</p>
            {:else if parseFloat(humanFee) <= 0.0001}
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-kong-primary animate-pulse"></div>
                <span class="text-kong-primary">Common fee: {humanFee} {displaySymbol || "TOKEN"}</span>
              </div>
              <p class="text-kong-text-secondary/60">Standard fee used by most ICRC tokens</p>
            {:else if parseFloat(humanFee) <= 0.001}
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-kong-primary animate-pulse"></div>
                <span class="text-kong-primary">Standard fee: {humanFee} {displaySymbol || "TOKEN"}</span>
              </div>
              <p class="text-kong-text-secondary/60">Balanced approach for most tokens</p>
            {:else if parseFloat(humanFee) <= 0.01}
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-kong-accent-red animate-pulse"></div>
                <span class="text-kong-accent-red">High fee: {humanFee} {displaySymbol || "TOKEN"}</span>
              </div>
              <p class="text-kong-text-secondary/60">Higher fee helps incentivize holding</p>
            {:else}
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-kong-accent-red animate-pulse"></div>
                <span class="text-kong-accent-red">Very high fee: {humanFee} {displaySymbol || "TOKEN"}</span>
              </div>
              <p class="text-kong-text-secondary/60">May discourage frequent transfers</p>
            {/if}
            
            {#if transferFee > 0}
              <div class="flex items-center gap-2 pt-1 mt-1 border-t border-kong-border/10">
                <span class="text-kong-text-secondary/80">Actual amount: {transferFee.toLocaleString()} base units</span>
                <span class="px-1.5 py-0.5 text-[10px] rounded bg-kong-bg-dark/70 text-kong-text-secondary/60">
                  {(parseFloat(humanFee) * 100).toFixed(2)}%
                </span>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Right Column: Decimals -->
    <div>
      <!-- Decimals -->
      <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
        <label class="block mb-2 text-sm font-medium text-kong-text-primary/80">
          Decimals <span class="text-kong-accent-red">*</span>
        </label>
        
        <!-- Decimals Presets -->
        <div class="flex flex-wrap gap-2 mb-3">
          <button 
            on:click={() => { decimals = 8; }} 
            class={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${decimals === 8 ? 'bg-kong-primary/20 border border-kong-primary/30 text-kong-primary' : 'bg-kong-bg-dark/50 border border-kong-border/30 text-kong-text-secondary hover:border-kong-primary/30'}`}
          >
            ICP/ICRC (8)
          </button>
          <button 
            on:click={() => { decimals = 6; }} 
            class={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${decimals === 6 ? 'bg-kong-primary/20 border border-kong-primary/30 text-kong-primary' : 'bg-kong-bg-dark/50 border border-kong-border/30 text-kong-text-secondary hover:border-kong-primary/30'}`}
          >
            USDC (6)
          </button>
          <button 
            on:click={() => { decimals = 18; }} 
            class={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${decimals === 18 ? 'bg-kong-primary/20 border border-kong-primary/30 text-kong-primary' : 'bg-kong-bg-dark/50 border border-kong-border/30 text-kong-text-secondary hover:border-kong-primary/30'}`}
          >
            MAX (18)
          </button>
        </div>
        
        <!-- Custom input with slider -->
        <div class="mb-3">
          <div class="flex items-center gap-3">
            <input
              type="range"
              bind:value={decimals}
              min="6"
              max="18"
              step="1"
              class="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-kong-bg-dark/70 accent-kong-primary"
            />
            <div class="flex items-center justify-center w-12 h-8 font-mono text-sm font-semibold rounded bg-kong-bg-dark/70 text-kong-primary">
              {decimals}
            </div>
          </div>
        </div>

        <!-- Decimals Visualization -->
        <div class="p-3 border rounded-lg bg-gradient-to-r from-kong-bg-dark/50 to-kong-bg-light/10 border-kong-border/20">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-kong-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 class="text-sm font-medium text-kong-text-primary">Divisibility</h4>
          </div>
          
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-kong-accent-blue animate-pulse"></div>
              <span class="text-xs text-kong-accent-blue">1 {displaySymbol || "TOKEN"} = 
                <span class="font-mono font-medium text-kong-accent-green">
                  {decimals > 0 ? `10${decimals === 1 ? '' : '<sup>' + decimals + '</sup>'}` : '1'} 
                </span> 
                base units
              </span>
            </div>
            
            <div class="flex items-center gap-1">
              <span class="text-xs font-medium text-kong-text-primary">Minimum:</span>
              <span class="font-mono text-xs text-kong-text-secondary">
                {`0.${'0'.repeat(decimals-1)}1`} {displaySymbol || "TOKEN"}
              </span>
            </div>
            
            <div class="pt-1 mt-1 text-xs border-t border-kong-border/10">
              {#if decimals <= 6}
                <span class="text-kong-text-secondary/70">Minimum precision similar to USDC</span>
              {:else if decimals <= 8}
                <span class="text-kong-text-secondary/70">Standard precision for most cryptocurrencies</span>
              {:else if decimals <= 12}
                <span class="text-kong-text-secondary/70">High precision for advanced use cases</span>
              {:else}
                <span class="text-kong-text-secondary/70">Very high precision for specialized tokens</span>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .shadow-glow {
    box-shadow: 0 0 20px rgba(var(--primary), 0.15);
  }
</style> 
