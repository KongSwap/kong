<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { TrendingUp, Zap, Route, Info } from 'lucide-svelte';
  
  let {
    show = false,
    position = { x: 0, y: 0 },
    slippage = 0,
    gasEstimate = null,
    routePath = null,
    priceImpact = null,
    minimumReceived = null
  } = $props<{
    show?: boolean;
    position?: { x: number; y: number };
    slippage?: number;
    gasEstimate?: string | null;
    routePath?: string[] | null;
    priceImpact?: number | null;
    minimumReceived?: string | null;
  }>();
</script>

{#if show}
  <div 
    class="absolute z-50 pointer-events-none"
    style="left: {position.x}px; top: {position.y - 10}px; transform: translateX(-50%) translateY(-100%);"
    transition:fade={{ duration: 150 }}
  >
    <div 
      class="bg-gray-900/95 backdrop-blur-md border border-gray-700/50 rounded-lg p-3 shadow-xl min-w-[200px]"
      transition:scale={{ duration: 150, start: 0.95 }}
    >
      <div class="space-y-2 text-xs">
        {#if slippage > 0}
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-1.5 text-gray-400">
              <TrendingUp class="w-3.5 h-3.5" />
              <span>Max Slippage</span>
            </div>
            <span class="text-white font-medium">{slippage.toFixed(2)}%</span>
          </div>
        {/if}
        
        {#if gasEstimate}
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-1.5 text-gray-400">
              <Zap class="w-3.5 h-3.5" />
              <span>Gas Estimate</span>
            </div>
            <span class="text-white font-medium">{gasEstimate}</span>
          </div>
        {/if}
        
        {#if priceImpact !== null}
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-1.5 text-gray-400">
              <Info class="w-3.5 h-3.5" />
              <span>Price Impact</span>
            </div>
            <span class="text-white font-medium" class:text-yellow-400={priceImpact > 2} class:text-red-400={priceImpact > 5}>
              {priceImpact.toFixed(2)}%
            </span>
          </div>
        {/if}
        
        {#if minimumReceived}
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-1.5 text-gray-400">
              <TrendingUp class="w-3.5 h-3.5 rotate-180" />
              <span>Min Received</span>
            </div>
            <span class="text-white font-medium">{minimumReceived}</span>
          </div>
        {/if}
        
        {#if routePath && routePath.length > 0}
          <div class="pt-2 mt-2 border-t border-gray-700/50">
            <div class="flex items-center gap-1.5 text-gray-400 mb-1">
              <Route class="w-3.5 h-3.5" />
              <span>Route</span>
            </div>
            <div class="flex items-center gap-1 text-white font-medium">
              {#each routePath as token, i}
                <span>{token}</span>
                {#if i < routePath.length - 1}
                  <span class="text-gray-500">→</span>
                {/if}
              {/each}
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Arrow pointing down -->
      <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900/95 border-r border-b border-gray-700/50 rotate-45"></div>
    </div>
  </div>
{/if} 