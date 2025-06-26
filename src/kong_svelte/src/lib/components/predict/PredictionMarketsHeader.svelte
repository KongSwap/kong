<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { marketStore, filteredMarkets } from "$lib/stores/marketStore";
  import { ChartBar, ChartLine, ChevronLeft, ChevronRight, HelpCircle, Plus, History } from "lucide-svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";

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
      .filter(m => 'Active' in m.status)
      .sort((a, b) => Number(b.total_pool) - Number(a.total_pool))
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
        <div class="text-center mb-4">
          <h1 class="text-4xl md:text-5xl font-bold text-kong-text-primary mb-4">
            Put Your <span
              class="text-transparent font-black bg-clip-text bg-gradient-to-r from-kong-primary via-kong-accent-blue to-kong-primary animate-shine"
              >Knowledge</span
            > to Work
          </h1>
          <p class="text-lg md:text-base text-kong-text-secondary !max-w-3xl mx-auto">
            Turn your predictions into <span class="text-kong-text-primary font-semibold">profit</span>. Stake on outcomes you believe in and
            <span class="text-kong-text-primary font-semibold"
              >earn when you're right.</span
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
                        {market.question}
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
                                {market.outcome_percentages[outcomeIndex]?.toFixed(1) || '0.0'}%
                              </div>
                            </div>
                            <!-- Background fill based on percentage -->
                            <div 
                              class="absolute inset-0 bg-gradient-to-r from-kong-primary/20 to-kong-primary/10"
                              style="width: {market.outcome_percentages[outcomeIndex] || 0}%"
                            ></div>
                          </button>
                        {/each}
                      </div>

                      <!-- Market Stats -->
                      <div class="flex items-center justify-between text-sm">
                        <div class="flex items-center gap-3">
                          <span class="text-kong-text-secondary">Pool:</span>
                          <span class="font-medium text-kong-text-primary">
                            {formatPoolSize(market.total_pool)} KONG
                          </span>
                        </div>
                        <span class="text-xs text-kong-text-secondary">
                          {market.bet_counts.reduce((sum, count) => sum + Number(count), 0)} bets
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
        <div class="text-center">
          <!-- Total Markets -->
          <div class="flex items-center justify-center gap-1 text-sm text-kong-text-secondary mb-4">
            <svg class="w-4 h-4 text-kong-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span><span class="font-semibold text-kong-text-primary">{$marketStore.markets.length}</span> Total Markets</span>
            <div class="hidden sm:block w-px mx-2 h-4 bg-kong-border"></div>
            <ChartLine class="w-4 h-4 text-kong-primary" />
            <span><span class="font-semibold text-kong-text-primary">20k+</span> Predictions</span>
            <div class="hidden sm:block w-px mx-2 h-4 bg-kong-border"></div>
            <ChartBar class="w-4 h-4 text-kong-primary" />
            <span><span class="font-semibold text-kong-text-primary">$1.41M</span> Total Volume</span>
          </div>
          
          <!-- Action Buttons -->
          <div class="flex items-center justify-center gap-3 pt-2">
            <ButtonV2
              theme="primary"
              variant="transparent"
              size="lg"
              onclick={() => goto('/predict/faq')}
            >
              <div class="flex items-center gap-2">
                <HelpCircle class="w-4 h-4" />
                <span>Learn More</span>
              </div>
            </ButtonV2>
            
            {#if $auth.isConnected}
              <ButtonV2
                theme="primary"
                variant="transparent"
                size="lg"
                onclick={() => goto('/predict/history')}
              >
                <div class="flex items-center gap-2">
                  <History class="w-4 h-4" />
                  <span>My History</span>
                </div>
              </ButtonV2>
              <ButtonV2
                theme="primary"
                variant="solid"
                size="lg"
                onclick={() => goto('/predict/create')}
              > 
                <div class="flex items-center gap-2">
                  <Plus class="w-4 h-4" />
                  <span>Create Market</span>
                </div>
              </ButtonV2>
            {:else}
              <ButtonV2
                theme="primary"
                variant="solid"
                size="lg"
                onclick={() => walletProviderStore.open()}
              >
                <div class="flex items-center gap-2">
                  <Plus class="w-4 h-4" />
                  <span>Connect Wallet</span>
                </div>
              </ButtonV2>
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

  /* Enhanced shine animation for gradient text */
  :global(.animate-shine) {
    background-size: 400% 100%;
    background-position: 0% 50%;
    animation: shine 4s ease-in-out infinite;
  }

  @keyframes shine {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
</style>