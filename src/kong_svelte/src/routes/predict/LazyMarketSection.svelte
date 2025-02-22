<!-- LazyMarketSection.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Market, MarketResult } from '$lib/types/predictionMarket';
  import MarketSection from './MarketSection.svelte';

  export let title: string;
  export let statusColor: string;
  export let markets: Market[] | MarketResult[];
  export let isResolved = false;
  export let showEndTime = true;
  export let openBetModal: (market: Market, outcomeIndex?: number) => void;
  export let onMarketResolved: () => Promise<void>;

  let sectionElement: HTMLElement;
  let isVisible = false;
  let observer: IntersectionObserver;

  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisible = true;
            // Disconnect observer once section is visible
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Start loading when section is 100px from viewport
        threshold: 0
      }
    );

    observer.observe(sectionElement);

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  });
</script>

<div bind:this={sectionElement}>
  {#if isVisible}
    <MarketSection
      {title}
      {statusColor}
      {markets}
      {isResolved}
      {showEndTime}
      {openBetModal}
      {onMarketResolved}
    />
  {:else}
    <div class="py-8 text-center text-kong-pm-text-secondary">
      <div class="animate-pulse">
        <div class="h-6 w-32 bg-kong-surface-dark rounded mx-auto mb-4"></div>
        <div class="h-24 bg-kong-surface-dark rounded-lg max-w-3xl mx-auto"></div>
      </div>
    </div>
  {/if}
</div> 