<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { Info, X, TrendingUp, BarChart2 } from 'lucide-svelte';
  
  export let onHide: () => void;
  
  // ICP token logo for the example - using a more reliable source
  const icpLogoUrl = "https://assets.coingecko.com/coins/images/14495/small/Internet_Computer_logo.png";
</script>

<div 
  class="sticky top-0 z-10 bg-kong-bg-tertiary rounded-md p-3 mb-3 border border-kong-border" 
  in:fly={{ y: -10, duration: 200 }}
  out:fade={{ duration: 150 }}
>
  <div class="flex items-start gap-2">
    <Info class="w-4 h-4 text-kong-primary shrink-0 mt-0.5" />
    
    <div class="flex-1">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-sm font-medium text-kong-text-primary">TrollBox Tips</h4>
        <button 
          onclick={onHide}
          class="text-kong-text-secondary hover:text-kong-text-primary transition-colors p-1 rounded-full"
          title="Close tips"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
      
      <p class="text-xs text-kong-text-primary mb-1.5">
        Display live token prices using commands:
      </p>
      
      <div class="bg-kong-bg-primary p-2 rounded-sm text-xs font-mono mb-2 overflow-x-auto">
        <span class="text-kong-accent-blue">/</span><span class="text-kong-primary">price</span> <span class="text-kong-text-primary">canister-id</span>
      </div>
      
      <p class="text-xs text-kong-text-primary mb-1">Example:</p>
      <div class="bg-kong-bg-primary p-2 rounded-sm text-xs font-mono mb-2 overflow-x-auto">
        Check out <span class="text-kong-accent-blue">/</span><span class="text-kong-primary">price</span> <span class="text-kong-text-primary">ryjl3-tyaaa-aaaaa-aaaba-cai</span>
      </div>
      
      <p class="text-xs text-kong-text-primary mb-1">Displays as:</p>
      <div class="bg-kong-bg-primary p-2 rounded-sm mb-1">
        <span class="text-xs">Check out</span>
        <span class="bg-kong-primary/20 rounded px-1.5 py-0.5 text-kong-text-primary text-xs inline-flex items-center gap-1 ml-0.5 border border-kong-primary/20">
          <span class="flex items-center gap-0.5">
            <img src={icpLogoUrl} alt="ICP" class="w-3.5 h-3.5 rounded-full" />
            ICP 
          </span>
          <span class="flex items-center gap-0.5">
            $6.27
            <span class="text-kong-error flex items-center gap-0.5">(−9.014%)
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
                <polyline points="17 18 23 18 23 12"></polyline>
              </svg>
            </span>
          </span>
        </span>
      </div>
    </div>
  </div>
</div> 