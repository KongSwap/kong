<script lang="ts">
  import { Route, ArrowRight } from "lucide-svelte";
  import Card from "$lib/components/common/Card.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { onMount } from "svelte";
  import { userTokens } from "$lib/stores/userTokens";
  
  let tokenPairs = $state<Array<{ from: Kong.Token; to: Kong.Token }>>([]);
  let currentFromIndex = $state(0);
  let currentToIndex = $state(0);
  let intervalId: NodeJS.Timeout;
  
  // Generate random token pairs from available tokens
  function generateTokenPairs() {
    const tokens = $userTokens.tokens;
    if (tokens.length < 2) return;
    
    const pairs: Array<{ from: Kong.Token; to: Kong.Token }> = [];
    const usedPairs = new Set<string>();
    
    // Generate 5 unique pairs
    while (pairs.length < 5 && pairs.length < tokens.length * (tokens.length - 1)) {
      const fromIndex = Math.floor(Math.random() * tokens.length);
      let toIndex = Math.floor(Math.random() * tokens.length);
      
      // Ensure different tokens
      while (toIndex === fromIndex) {
        toIndex = Math.floor(Math.random() * tokens.length);
      }
      
      const pairKey = `${tokens[fromIndex].symbol}-${tokens[toIndex].symbol}`;
      if (!usedPairs.has(pairKey)) {
        usedPairs.add(pairKey);
        pairs.push({
          from: tokens[fromIndex],
          to: tokens[toIndex]
        });
      }
    }
    
    tokenPairs = pairs;
  }
  
  onMount(() => {
    // Generate initial pairs
    generateTokenPairs();
    
    // Alternate between changing from and to tokens
    let changeFrom = true;
    intervalId = setInterval(() => {
      if (tokenPairs.length > 0) {
        if (changeFrom) {
          currentFromIndex = (currentFromIndex + 1) % tokenPairs.length;
        } else {
          currentToIndex = (currentToIndex + 1) % tokenPairs.length;
        }
        changeFrom = !changeFrom;
      }
    }, 2000);
    
    // Regenerate pairs every 20 seconds
    const regenerateInterval = setInterval(() => {
      generateTokenPairs();
      currentFromIndex = 0;
      currentToIndex = 0;
    }, 20000);
    
    return () => {
      clearInterval(intervalId);
      clearInterval(regenerateInterval);
    };
  });
  
  // Subscribe to token changes
  $effect(() => {
    if ($userTokens.tokens.length >= 2) {
      generateTokenPairs();
    }
  });
</script>

<style>
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes fadeOutUp {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }
  
  .token-transition {
    transition: all 0.5s ease-out;
  }
</style>

<Card
  className="group relative overflow-hidden"
  isPadded={true}
>
  <!-- Animated background -->
  <div class="absolute inset-0">
    <div
      class="absolute top-0 right-0 w-32 h-32 bg-kong-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"
    ></div>
    <div
      class="absolute bottom-0 left-0 w-24 h-24 bg-kong-primary/5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700 delay-100"
    ></div>
  </div>

  <div class="relative z-10 h-full flex flex-col">
    <div class="flex items-start justify-between mb-3 sm:mb-4">
      <div>
        <h3 class="text-lg sm:text-xl font-semibold text-kong-text-primary mb-1">
          Intelligent Routing
        </h3>
        <p class="text-xs sm:text-sm text-kong-text-secondary">
          Any token, best price, lowest slippage
        </p>
      </div>
      <div class="p-2 sm:p-2.5 bg-kong-primary/10 rounded-xl group-hover:bg-kong-primary/20 transition-colors">
        <Route class="w-5 h-5 sm:w-6 sm:h-6 text-kong-primary" />
      </div>
    </div>

    <div class="flex-1 flex flex-col gap-3">
      <!-- Animated route display -->
      <div class="bg-kong-bg-tertiary rounded-lg px-4 py-3 sm:p-4 min-h-[80px] flex flex-col items-center justify-center gap-2">
        {#if tokenPairs.length > 0}
          <div class="flex items-center gap-3 sm:gap-4">
            <!-- From token -->
            <div class="relative w-[120px] sm:w-[140px] h-[40px] sm:h-[50px] flex">
              {#each tokenPairs as pair, index}
                <div 
                  class="absolute inset-0 flex items-center gap-2 token-transition justify-end mr-2"
                  style="opacity: {index === currentFromIndex ? 1 : 0}; transform: translateY({index === currentFromIndex ? 0 : 20}px)"
                >
                  <TokenImages
                    tokens={[pair.from]}
                    size={46}
                  />
                </div>
              {/each}
            </div>
            
            <!-- Arrow (static) -->
            <ArrowRight class="w-5 h-5 sm:w-6 sm:h-6 text-kong-primary flex-shrink-0" />
            
            <!-- To token -->
            <div class="relative w-[120px] sm:w-[140px] h-[40px] sm:h-[50px]">
              {#each tokenPairs as pair, index}
                <div 
                  class="absolute inset-0 flex items-center gap-2 token-transition justify-start ml-2"
                  style="opacity: {index === currentToIndex ? 1 : 0}; transform: translateY({index === currentToIndex ? 0 : 20}px)"
                >
                  <TokenImages
                    tokens={[pair.to]}
                    size={46}
                  />
                </div>
              {/each}
            </div>
          </div>
          <p class="text-xs sm:text-sm text-kong-text-secondary">
            Swap between any token
          </p>
        {:else}
          <div class="text-sm text-kong-text-secondary">Loading tokens...</div>
        {/if}
      </div>
      
      <!-- Stats -->
      <div class="grid grid-cols-2 gap-2">
        <div class="text-center p-2 bg-kong-bg-tertiary/10 rounded-lg">
          <span class="text-lg sm:text-xl font-bold text-kong-primary">200+</span>
          <span class="text-[10px] sm:text-xs text-kong-text-secondary block">Token pairs</span>
        </div>
        <div class="text-center p-2 bg-kong-bg-tertiary/10 rounded-lg">
          <span class="text-lg sm:text-xl font-bold text-kong-primary">2M+</span>
          <span class="text-[10px] sm:text-xs text-kong-text-secondary block">Swaps</span>
        </div>
      </div>
    </div>
  </div>
</Card>