<script lang="ts">
  import AdvancedOptions from '$lib/components/launch/token/AdvancedOptions.svelte';
  import { Settings } from "lucide-svelte";

  // Basic token parameters
  export let name: string = "";
  export let symbol: string = "";
  export let decimals: number = 8;
  export let transferFee: number = 0; // Stored in base units (10^decimals)
  export let logo: string = "";

  // Logo file handling
  let logoPreview: string = logo; // Initialize from the logo prop
  let showAdvanced = false;

  let humanFee: string = (transferFee / 10 ** decimals).toFixed(decimals);
  let baseFeeInput: string = transferFee.toString();
  
  // Make sure logoPreview stays in sync with logo when coming back to this step
  $: logoPreview = logo || logoPreview;
  
  // Sync when decimals change
  $: {
    // Update human fee when base units change
    if (parseInt(baseFeeInput) !== transferFee) {
      humanFee = (transferFee / 10 ** decimals).toFixed(decimals);
      baseFeeInput = transferFee.toString();
    }
  }

  function updateFromHuman() {
    const value = parseFloat(humanFee);
    if (!isNaN(value)) {
      transferFee = Math.round(value * 10 ** decimals);
      baseFeeInput = transferFee.toString();
    }
  }

  function updateFromBase() {
    const value = parseInt(baseFeeInput);
    if (!isNaN(value)) {
      transferFee = value;
      humanFee = (value / 10 ** decimals).toFixed(decimals);
    }
  }

  function handleLogoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        logoPreview = e.target?.result as string;
        logo = logoPreview;
      };
      reader.readAsDataURL(file);
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-3 mb-6">
    <div class="w-1.5 h-6 rounded-full bg-kong-primary animate-pulse"></div>
    <h3 class="text-xl font-bold font-space-grotesk text-kong-text-primary">
      Token Foundations
    </h3>
  </div>

  <div class="grid gap-6 md:grid-cols-2">
    <!-- Left Column -->
    <div class="space-y-6">
      <!-- Token Name -->
      <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
        <label class="block mb-2 text-sm font-medium text-kong-text-primary/80">
          Token Name <span class="text-kong-accent-red">*</span>
        </label>
        <input
          type="text"
          bind:value={name}
          class="w-full px-4 py-3 text-sm transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
          placeholder="My Token"
          maxlength="40"
        />
        <div class="flex justify-between mt-2 text-xs text-kong-text-secondary/50">
          <span class="flex items-center gap-1.5">
            {#if name.length === 0}
              <span class="w-2 h-2 rounded-full bg-kong-accent-red/80 animate-pulse"></span>
              Required
            {:else}
              <span class="w-2 h-2 rounded-full bg-kong-primary/80"></span>
              {name.length}/40
            {/if}
          </span>
          <span>Display name</span>
        </div>
      </div>

      <!-- Token Symbol -->
      <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
        <label class="block mb-2 text-sm font-medium text-kong-text-primary/80">
          Token Symbol <span class="text-kong-accent-red">*</span>
        </label>
        <input
          type="text"
          bind:value={symbol}
          class="w-full px-4 py-3 text-sm transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
          placeholder="MTK"
          maxlength="10"
        />
        <div class="flex justify-between mt-2 text-xs text-kong-text-secondary/50">
          <span class="flex items-center gap-1.5">
            {#if symbol.length === 0}
              <span class="w-2 h-2 rounded-full bg-kong-accent-red/80 animate-pulse"></span>
              Required
            {:else}
              <span class="w-2 h-2 rounded-full bg-kong-primary/80"></span>
              {symbol.length}/10
            {/if}
          </span>
          <span>Ticker symbol</span>
        </div>
      </div>
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
            None
          </button>
          <button 
            on:click={() => { humanFee = (0.0001).toFixed(4); updateFromHuman(); }} 
            class={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${transferFee === Math.round(0.0001 * 10 ** decimals) ? 'bg-kong-primary/20 border border-kong-primary/30 text-kong-primary' : 'bg-kong-bg-dark/50 border border-kong-border/30 text-kong-text-secondary hover:border-kong-primary/30'}`}
          >
            Minimal
          </button>
          <button 
            on:click={() => { humanFee = (0.001).toFixed(3); updateFromHuman(); }} 
            class={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${transferFee === Math.round(0.001 * 10 ** decimals) ? 'bg-kong-primary/20 border border-kong-primary/30 text-kong-primary' : 'bg-kong-bg-dark/50 border border-kong-border/30 text-kong-text-secondary hover:border-kong-primary/30'}`}
          >
            Low
          </button>
          <button 
            on:click={() => { humanFee = (0.01).toFixed(2); updateFromHuman(); }} 
            class={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${transferFee === Math.round(0.01 * 10 ** decimals) ? 'bg-kong-accent-red/20 border border-kong-accent-red/30 text-kong-accent-red' : 'bg-kong-bg-dark/50 border border-kong-border/30 text-kong-text-secondary hover:border-kong-primary/30'}`}
          >
            Standard
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
            <div class="flex items-center h-12 px-4 text-sm border-r border-t border-b border-kong-border/30 rounded-r-xl text-kong-text-secondary bg-kong-bg-dark/30">
              {symbol || "TOKEN"}
            </div>
          </div>
        </div>

        <!-- Fee Info Card -->
        <div class="p-3 rounded-lg bg-gradient-to-r from-kong-bg-dark/50 to-kong-bg-light/10 border border-kong-border/20">
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
            {:else if humanFee <= 0.0001}
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-kong-primary animate-pulse"></div>
                <span class="text-kong-primary">Minimal fee: {humanFee} {symbol || "TOKEN"}</span>
              </div>
              <p class="text-kong-text-secondary/60">Protects against spam while keeping costs very low</p>
            {:else if humanFee <= 0.001}
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-kong-primary animate-pulse"></div>
                <span class="text-kong-primary">Low fee: {humanFee} {symbol || "TOKEN"}</span>
              </div>
              <p class="text-kong-text-secondary/60">Balanced approach for most tokens</p>
            {:else if humanFee <= 0.01}
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-kong-accent-blue animate-pulse"></div>
                <span class="text-kong-accent-blue">Medium fee: {humanFee} {symbol || "TOKEN"}</span>
              </div>
              <p class="text-kong-text-secondary/60">Higher fee helps incentivize holding</p>
            {:else}
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-kong-accent-red animate-pulse"></div>
                <span class="text-kong-accent-red">High fee: {humanFee} {symbol || "TOKEN"}</span>
              </div>
              <p class="text-kong-text-secondary/60">May discourage frequent transfers</p>
            {/if}
            
            {#if transferFee > 0}
              <div class="flex items-center gap-2 pt-1 mt-1 border-t border-kong-border/10">
                <span class="text-kong-text-secondary/80">Actual amount: {transferFee.toLocaleString()} base units</span>
                <span class="px-1.5 py-0.5 text-[10px] rounded bg-kong-bg-dark/70 text-kong-text-secondary/60">
                  {(transferFee / 10 ** decimals * 100).toFixed(2)}%
                </span>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Right Column -->
    <div class="space-y-6">
      <!-- Logo Upload -->
      <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
        <label class="block mb-3 text-sm font-medium text-kong-text-primary/80">
          Token Logo
        </label>
        <label class="flex flex-col items-center justify-center w-full h-48 overflow-hidden transition-all duration-200 border-2 border-dashed cursor-pointer rounded-xl border-kong-border/30 hover:border-kong-primary/50 group">
          {#if logoPreview}
            <div class="relative w-32 h-32 overflow-hidden transition-transform duration-300 rounded-full group-hover:scale-105">
              <img 
                src={logoPreview} 
                alt="Token logo" 
                class="object-cover w-full h-full"
                width="128"
                height="128"
              />
            </div>
          {:else}
            <div class="text-center">
              <div class="mb-2 text-kong-text-secondary/50">
                <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <span class="text-xs text-kong-text-secondary/60">Click to upload</span>
              <span class="block text-xs text-kong-text-secondary/40">PNG, JPG (max 2MB)</span>
            </div>
          {/if}
          <input type="file" accept="image/*" on:change={handleLogoUpload} class="hidden" />
        </label>
      </div>

      <!-- Decimals -->
      <div class="p-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
        <label class="block mb-2 text-sm font-medium text-kong-text-primary/80">
          Decimals <span class="text-kong-accent-red">*</span>
        </label>
        <input
          type="number"
          bind:value={decimals}
          class="w-full px-4 py-3 text-sm transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
          min="0"
          max="18"
        />
        <div class="mt-2 text-xs text-kong-text-secondary/50">
          {#if decimals < 0 || decimals > 18}
            <span class="text-kong-accent-red/80">Must be between 0-18</span>
          {:else}
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-kong-primary/80"></span>
              {decimals} decimal places
            </span>
          {/if}
        </div>
        <div class="p-2 mt-2 rounded-lg bg-kong-bg-dark/30">
          <p class="text-xs leading-relaxed text-kong-text-secondary/60">
            <span class="font-medium text-kong-primary/80">Common examples:</span><br>
            • Bitcoin-style: 8 decimals<br>
            • USD-stablecoins: 6 decimals<br>
            • Ethereum-style: 18 decimals<br>
            • Most ICRC tokens: 8 decimals<br>
            <span class="inline-block mt-1 text-kong-accent-blue/80">
              (1 token = 10<sup class="text-[0.6em]">{decimals}</sup> base units)
            </span>
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Advanced Options -->
  <div class="pt-4 border-t border-kong-border/20">
    <button 
      class="flex items-center gap-2 px-4 py-2.5 transition-all duration-200 rounded-xl
             bg-gradient-to-r from-kong-primary/90 to-kong-accent-blue/90 hover:from-kong-primary 
             hover:to-kong-accent-blue hover:shadow-glow"
      on:click={() => showAdvanced = true}
    >
      <Settings size={18} class="text-white/90" />
      <span class="font-medium text-white/90 drop-shadow-sm">Advanced Configuration</span>
    </button>
  </div>

  {#if showAdvanced}
    <div class="p-6 mt-4 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
      <AdvancedOptions />
      
      <button
        class="w-full px-6 py-3 mt-6 font-medium text-white transition-all duration-300 rounded-xl 
               bg-gradient-to-r from-kong-primary/90 to-kong-accent-blue/90 hover:from-kong-primary 
               hover:to-kong-accent-blue hover:shadow-glow active:scale-[0.98]"
        on:click={() => showAdvanced = false}
      >
        <span class="drop-shadow-sm">Save Advanced Settings</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .shadow-glow {
    box-shadow: 0 0 20px rgba(var(--primary), 0.15);
  }
</style>
