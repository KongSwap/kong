<script lang="ts">
  import { Check, Rocket } from 'lucide-svelte';
  
  export let selectedValue: string;
  export let options: Array<{
    id: string;
    name: string;
    symbol: string;
    color: string;
    gradient: string;
    available: boolean;
    priority: number;
    description: string;
  }>;

  // Sort chains by priority (lower number = higher priority)
  $: sortedOptions = [...options].sort((a, b) => a.priority - b.priority);
</script>

<div class="chain-selector-container">
  <div class="mb-8">
    <h2 class="text-2xl font-bold text-kong-text-primary">Select Network</h2>
    <p class="mt-2 text-kong-text-secondary">Choose which blockchain you want to deploy your token on</p>
  </div>

  <div class="grid gap-6 md:grid-cols-2">
    {#each sortedOptions as chain}
      <div 
        class={`relative overflow-hidden p-0.5 rounded-xl transition-all duration-300 ${!chain.available ? 'opacity-70' : ''}`}
        style={`border: ${chain.available ? `2px solid ${chain.color}40` : 'none'}`}
      >
        <div 
          class={`h-full p-5 rounded-[10px] backdrop-blur-sm border transition-all duration-300
          ${selectedValue === chain.id && chain.available 
            ? `border-2 border-${chain.color} bg-kong-bg-light/5` 
            : 'bg-kong-bg-light/5 border-kong-border/20'}
          ${!chain.available ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-kong-bg-light/10'}`}
          on:click={() => {
            if (chain.available) {
              selectedValue = chain.id;
            }
          }}
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-4">
              <div class={`w-12 h-12 rounded-full flex items-center justify-center`}>
                <img 
                  src={`/tokens/${chain.symbol}.svg`} 
                  alt={chain.symbol} 
                  class="w-9 h-9"
                  on:error={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-lg text-kong-text-primary">{chain.name}</h3>
                  {#if selectedValue === chain.id && chain.available}
                    <div class="text-white bg-kong-primary p-0.5 rounded-full">
                      <Check size={16} />
                    </div>
                  {/if}
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-sm text-kong-text-secondary">{chain.symbol}</span>
                  {#if chain.id === "sol"}
                    <span class="text-xs bg-green-600/30 text-green-400 px-1.5 py-0.5 rounded-sm font-medium">PRIORITY</span>
                  {/if}
                </div>
              </div>
            </div>
            
            {#if !chain.available}
              <div class="px-2 py-1 bg-kong-bg-dark/90 rounded-md text-xs font-medium text-kong-text-secondary border border-kong-border/20">
                Coming Soon
              </div>
            {/if}
          </div>
          
          <div class="mt-4 text-sm text-kong-text-secondary">
            <p>{chain.description}</p>
          </div>
          
          {#if chain.available}
            <div class="mt-3 inline-flex items-center gap-2 text-xs font-medium bg-kong-bg-dark/90 text-green-400 px-3 py-1.5 rounded-md border border-green-500/20">
              <span class="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/30"></span>
              <span>Ready for deployment</span>
            </div>
          {:else if chain.id === "sol"}
            <div class="mt-3 inline-flex items-center gap-2 text-xs font-medium bg-green-500/15 text-green-400 px-3 py-1.5 rounded-md border border-green-500/20">
              <span class="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-500/30"></span>
              <span>Development in progress</span>
            </div>
          {:else}
            <div class="mt-3 inline-flex items-center gap-2 text-xs font-medium bg-yellow-500/15 text-yellow-400 px-3 py-1.5 rounded-md border border-yellow-500/20">
              <span class="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-sm shadow-yellow-500/30"></span>
              <span>Soon</span>
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  /* Clean container with positioning for the dropdown */
  .chain-selector-container {
    position: relative;
    width: 100%;
  }

  /* For chain card animations */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
</style>
