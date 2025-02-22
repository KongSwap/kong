<script lang="ts">
  import AdvancedOptions from '$lib/components/launch/token/AdvancedOptions.svelte';
  import { Settings } from "lucide-svelte";

  // Basic token parameters
  export let name: string = "";
  export let symbol: string = "";
  export let decimals: number = 8;
  export let transferFee: number = 0;
  export let logo: string = "";

  // Logo file handling
  let logoPreview: string = "";
  let showAdvanced = false;

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

<div class="space-y-6 custom-params-section group">
  <div class="flex items-center gap-3 mb-6">
    <div class="w-1.5 h-6 rounded-full bg-kong-primary animate-pulse"></div>
    <h3 class="text-xl font-bold font-space-grotesk text-kong-text-primary">
      Token Foundations
    </h3>
  </div>

  {#if !showAdvanced}
  <div class="space-y-6">
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
      <!-- Token Name Input -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-kong-text-primary/80">
          Token Name <span class="text-kong-accent-red">*</span>
        </label>
        <input
          type="text"
          bind:value={name}
          class="w-full px-4 py-3 text-sm transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
          placeholder="My Token"
          maxlength="40"
        />
        <div class="flex justify-between text-xs text-kong-text-secondary/50">
          <span>{name.length}/40 characters</span>
          <span>Display name</span>
        </div>
      </div>

      <!-- Token Symbol Input -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-kong-text-primary/80">
          Token Symbol <span class="text-kong-accent-red">*</span>
        </label>
        <input
          type="text"
          bind:value={symbol}
          class="w-full px-4 py-3 text-sm transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
          placeholder="MTK"
          maxlength="10"
        />
        <div class="flex justify-between text-xs text-kong-text-secondary/50">
          <span>{symbol.length}/10 characters</span>
          <span>3-5 letters</span>
        </div>
      </div>

      <!-- Decimals Input -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-kong-text-primary/80">
          Decimals <span class="text-kong-accent-red">*</span>
        </label>
        <input
          type="number"
          bind:value={decimals}
          class="w-full px-4 py-3 text-sm transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
          min="0"
          max="18"
        />
        <div class="text-xs text-kong-text-secondary/50">
          1 token = 10<sup class="text-[0.6em]">{decimals}</sup> base units
        </div>
      </div>

      <!-- Transfer Fee Input -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-kong-text-primary/80">
          Transfer Fee
        </label>
        <input
          type="number"
          bind:value={transferFee}
          class="w-full px-4 py-3 text-sm transition-all duration-200 border rounded-xl bg-kong-bg-light border-kong-border/30 placeholder:text-kong-text-secondary/50 focus:ring-2 focus:ring-kong-primary/50"
          min="0"
        />
        <div class="flex justify-between text-xs text-kong-text-secondary/50">
          <span>{transferFee > 0 ? `${transferFee} per transfer` : 'No transfer fee'}</span>
          <span>Common values: 0.01 or 0.0001 </span>
        </div>
      </div>

      <!-- Logo Upload -->
      <div class="space-y-2 md:col-span-2">
        <label class="block text-sm font-medium text-kong-text-primary/80">
          Token Logo
        </label>
        <label class="flex items-center justify-center w-full h-24 transition-all duration-200 border-2 border-dashed cursor-pointer rounded-xl border-kong-border/30 bg-kong-bg-light/30 hover:border-kong-primary/50 hover:shadow-glow">
          <input
            type="file"
            class="hidden"
            accept="image/*"
            on:change={handleLogoUpload}
          />
          {#if logoPreview}
            <img 
              src={logoPreview} 
              alt="Token logo" 
              class="object-cover w-16 h-16 transition-transform duration-200 rounded-lg hover:scale-105" 
            />
          {:else}
            <div class="text-center text-kong-text-secondary/60">
              <span class="block text-sm">Click to upload</span>
              <span class="text-xs">PNG, JPG up to 5MB</span>
            </div>
          {/if}
        </label>
      </div>
    </div>

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
  </div>
  {:else}
  <div class="space-y-6">
    <div class="p-6 border rounded-xl bg-kong-bg-light/30 border-kong-border/20">
      <AdvancedOptions />
    </div>
    
    <button
      class="w-full px-6 py-3 font-medium text-white transition-all duration-300 rounded-xl 
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
  .custom-params-section {
    margin-top: 1.5rem;
    border-radius: 1rem;
    background: linear-gradient(
      145deg,
      rgba(var(--bg-dark), 0.8) 0%,
      rgba(var(--bg-light), 0.4) 100%
    );
    backdrop-filter: blur(4px);
    border: 1px solid rgba(var(--border), 0.3);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .shadow-glow {
    box-shadow: 0 0 20px rgba(var(--primary), 0.15);
  }
</style>
