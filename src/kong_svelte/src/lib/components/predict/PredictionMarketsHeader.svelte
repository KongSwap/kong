<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { marketStore, filteredMarkets } from "$lib/stores/marketStore";
  import { ChevronLeft, ChevronRight } from "lucide-svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

  interface Props {
    openBetModal: (market: any, outcomeIndex?: number) => void;
    userClaims?: any[];
  }

  let { openBetModal, userClaims = [] }: Props = $props();

  // Carousel state
  let carouselRef: HTMLDivElement;
  let currentIndex = $state(0);
  let canScrollLeft = $state(false);
  let canScrollRight = $state(true);

  // Get featured markets (active markets sorted by volume)
  const featuredMarkets = $derived(
    $filteredMarkets
      .filter(m => m.status === "Active")
      .sort((a, b) => Number(b.total_volume) - Number(a.total_volume))
      .slice(0, 6)
  );

  // Check scroll position
  function checkScroll() {
    if (!carouselRef) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = carouselRef;
    canScrollLeft = scrollLeft > 0;
    canScrollRight = scrollLeft < scrollWidth - clientWidth - 10;
  }

  // Scroll functions
  function scrollToIndex(index: number) {
    if (!carouselRef) return;
    
    const cards = carouselRef.querySelectorAll('.market-card');
    if (cards[index]) {
      cards[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      currentIndex = index;
    }
  }

  function scrollLeft() {
    const newIndex = Math.max(0, currentIndex - 1);
    scrollToIndex(newIndex);
  }

  function scrollRight() {
    const newIndex = Math.min(featuredMarkets.length - 1, currentIndex + 1);
    scrollToIndex(newIndex);
  }

  // Format pool size for display
  function formatPoolSize(volume: bigint, decimals: number = 8): string {
    const value = Number(volume) / Math.pow(10, decimals);
    return formatToNonZeroDecimal(value);
  }
</script>

<div class="mb-8 px-4">
  <div class="sm:w-full lg:w-5/6 mx-auto overflow-hidden relative">
    <div class="relative z-10 md:pb-4">
      <div class="max-w-7xl mx-auto">
        <!-- Main headline -->
        <div class="text-center mb-6">
          <h1 class="text-4xl md:text-5xl font-bold text-kong-text-primary mb-4">
            Predict the <span
              class="text-transparent font-black bg-clip-text bg-gradient-to-r from-kong-primary to-kong-accent-blue animate-shine"
              >Future</span
            > and Earn
          </h1>
          <p class="text-lg md:text-base text-kong-text-secondary !max-w-2xl mx-auto">
            Trade on real-world outcomes. Create markets, place predictions, and
            <span class="text-kong-text-primary font-semibold"
              >earn rewards from your insights.</span
            >
          </p>
        </div>

        <!-- Featured Markets Carousel -->
        {#if featuredMarkets.length > 0}
          <div class="mb-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-kong-text-primary">Featured Markets</h2>
              <div class="flex items-center gap-2">
                <button
                  onclick={scrollLeft}
                  disabled={!canScrollLeft}
                  class="p-1.5 rounded-lg bg-kong-bg-secondary border border-kong-text-primary/10 
                         hover:bg-kong-bg-tertiary transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous market"
                >
                  <ChevronLeft class="w-4 h-4" />
                </button>
                <button
                  onclick={scrollRight}
                  disabled={!canScrollRight}
                  class="p-1.5 rounded-lg bg-kong-bg-secondary border border-kong-text-primary/10 
                         hover:bg-kong-bg-tertiary transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next market"
                >
                  <ChevronRight class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Carousel Container -->
            <div class="relative">
              <div
                bind:this={carouselRef}
                onscroll={checkScroll}
                class="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
              >
                {#each featuredMarkets as market, index}
                  <div class="market-card flex-none w-[320px] md:w-[380px]">
                    <div class="bg-kong-bg-secondary rounded-xl border border-kong-text-primary/10 p-4 
                                hover:border-kong-primary/30 transition-all duration-200 h-full">
                      <!-- Market Title -->
                      <h3 class="font-semibold text-kong-text-primary mb-3 line-clamp-2">
                        {market.title}
                      </h3>

                      <!-- Outcomes Grid -->
                      <div class="grid grid-cols-2 gap-2 mb-3">
                        {#each market.outcomes as outcome, outcomeIndex}
                          <button
                            onclick={() => openBetModal(market, outcomeIndex)}
                            class="relative overflow-hidden rounded-lg border border-kong-text-primary/10 
                                   bg-kong-bg-tertiary/50 p-3 text-left transition-all duration-200
                                   hover:bg-kong-bg-tertiary hover:border-kong-primary/30"
                          >
                            <div class="relative z-10">
                              <div class="text-xs text-kong-text-secondary mb-1">{outcome}</div>
                              <div class="text-lg font-bold text-kong-text-primary">
                                {((Number(market.odds[outcomeIndex]) / Number(market.total_odds)) * 100).toFixed(1)}%
                              </div>
                            </div>
                            <!-- Background fill based on percentage -->
                            <div 
                              class="absolute inset-0 bg-gradient-to-r from-kong-primary/20 to-kong-primary/10"
                              style="width: {(Number(market.odds[outcomeIndex]) / Number(market.total_odds)) * 100}%"
                            ></div>
                          </button>
                        {/each}
                      </div>

                      <!-- Market Stats -->
                      <div class="flex items-center justify-between text-sm">
                        <div class="flex items-center gap-3">
                          <span class="text-kong-text-secondary">Pool:</span>
                          <span class="font-medium text-kong-text-primary">
                            {formatPoolSize(market.total_volume)} KONG
                          </span>
                        </div>
                        <span class="text-xs text-kong-text-secondary">
                          {market.bets_placed} bets
                        </span>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}

        <!-- CTA section -->
        <div class="mt-6 text-center">
          <div class="flex items-center justify-center gap-4 text-sm text-kong-text-secondary">
            <div class="flex items-center gap-1">
              <svg class="w-4 h-4 text-kong-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{$marketStore.markets.length} Total Markets</span>
            </div>  
            <div class="hidden sm:block w-px h-4 bg-kong-border"></div>
            <div class="flex items-center gap-1">
              <span class="text-kong-success">●</span>
              <span>Binary Outcomes</span>
            </div>
            <div class="hidden sm:block w-px h-4 bg-kong-border"></div>
            {#if $auth.isConnected}
              <button
                onclick={() => goto('/predict/create')}
                class="flex items-center gap-1.5 px-3 py-1.5 text-base bg-kong-primary/10 hover:bg-kong-primary/20 text-kong-primary rounded-lg transition-all duration-200"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span class="font-medium">Create Market</span>
              </button>
            {:else}
              <button
                onclick={() => walletProviderStore.open()}
                class="flex items-center gap-1.5 px-3 py-1.5 text-base bg-kong-primary/10 hover:bg-kong-primary/20 text-kong-primary rounded-lg transition-all duration-200"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span class="font-medium">Connect Wallet</span>
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* Hide scrollbar but keep functionality */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  /* Shine animation for gradient text */
  :global(.animate-shine) {
    background-size: 200% auto;
    animation: shine 3s linear infinite;
  }

  @keyframes shine {
    to {
      background-position: 200% center;
    }
  }
</style>