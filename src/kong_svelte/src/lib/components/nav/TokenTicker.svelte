<script lang="ts">
  import { goto } from "$app/navigation";
  import { liveQuery } from "dexie";
  import { kongDB } from "$lib/services/db";
  import { ArrowUp, ArrowDown } from "lucide-svelte";
  import { writable } from "svelte/store";
  import SimpleChart from "$lib/components/common/SimpleChart.svelte";
  import { fade } from "svelte/transition";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { onDestroy, onMount } from "svelte";

  let hoveredToken: FE.Token | null = null;
  let hoverTimeout: NodeJS.Timeout;
  let chartPosition = { x: 0, y: 0 };
  let isChartHovered = false;
  let isTickerHovered = false;
  let priceFlashStates = new Map<
    string,
    { class: string; timeout: NodeJS.Timeout }
  >();
  let querySubscription: { unsubscribe: () => void } | null = null;
  let isVisible = true;

  // Create a writable store to hold the liveQuery results
  const tokenStore = writable<FE.Token[]>([]);

  // Track previous prices to detect changes using a more efficient structure
  const previousPrices = new Map<string, number>();

  // Batch price updates using requestAnimationFrame
  let pendingUpdates = new Set<FE.Token>();
  let updateScheduled = false;

  function scheduleUpdate() {
    if (!updateScheduled) {
      updateScheduled = true;
      requestAnimationFrame(() => {
        processPendingUpdates();
        updateScheduled = false;
      });
    }
  }

  function processPendingUpdates() {
    pendingUpdates.forEach((token) => {
      const prevPrice = previousPrices.get(token.canister_id);
      const currentPrice = Number(token.metrics?.price || 0);

      if (prevPrice !== undefined && prevPrice !== currentPrice) {
        const flashClass =
          currentPrice > prevPrice ? "flash-green" : "flash-red";

        // Clear existing timeout if any
        if (priceFlashStates.has(token.canister_id)) {
          clearTimeout(priceFlashStates.get(token.canister_id)!.timeout);
        }

        // Set new flash state
        const timeout = setTimeout(() => {
          if (priceFlashStates.has(token.canister_id)) {
            priceFlashStates.delete(token.canister_id);
            priceFlashStates = priceFlashStates; // Trigger reactivity
          }
        }, 2000);

        priceFlashStates.set(token.canister_id, { class: flashClass, timeout });
      }

      previousPrices.set(token.canister_id, currentPrice);
    });

    pendingUpdates.clear();
    if (isVisible) priceFlashStates = priceFlashStates; // Only trigger update if visible
  }

  function updatePriceFlash(token: FE.Token) {
    pendingUpdates.add(token);
    scheduleUpdate();
  }

  // Use Intersection Observer to pause animations when not visible
  let observer: IntersectionObserver;
  let tickerElement: HTMLElement;

  onMount(() => {
    // Set up Intersection Observer
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          const scrollElement = tickerElement?.querySelector(".animate-scroll");
          if (scrollElement) {
            scrollElement.classList.toggle("paused", !isVisible);
          }
        });
      },
      { threshold: 0.1 },
    );

    if (tickerElement) {
      observer.observe(tickerElement);
    }

    // Set up liveQuery subscription
    const query = liveQuery(async () => {
      const tokens = await kongDB.tokens
        .where("metrics.volume_24h")
        .above(100)
        .toArray();

      const sorted = [...tokens].sort((a, b) => {
        const volumeA = Number(a.metrics?.volume_24h || 0);
        const volumeB = Number(b.metrics?.volume_24h || 0);
        return volumeB - volumeA;
      }).slice(0, 10);

      return sorted;
    });

    querySubscription = query?.subscribe((tokens) => {
      if (tokens) {
        tokenStore.set(tokens);
      }
    });
  });

  onDestroy(() => {
    // Clean up Intersection Observer
    if (observer) {
      observer.disconnect();
    }

    // Clean up query subscription
    if (querySubscription) {
      querySubscription.unsubscribe();
    }

    // Clear all timeouts
    priceFlashStates.forEach((state) => {
      clearTimeout(state.timeout);
    });
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
  });

  function handleMouseEnter(event: MouseEvent, token: FE.Token) {
    if (!isVisible) return;

    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();

    chartPosition = {
      x: rect.left,
      y: rect.bottom + 8,
    };

    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      hoveredToken = token;
    }, 200);
  }

  function handleMouseLeave() {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      hoveredToken = null;
    }, 200);
  }

  function handleChartMouseEnter() {
    clearTimeout(hoverTimeout);
    isChartHovered = true;
  }

  function handleChartMouseLeave() {
    isChartHovered = false;
    handleMouseLeave();
  }

  function getChangeClass(change: number): string {
    return change > 0 ? "positive" : change < 0 ? "negative" : "neutral";
  }

  function formatChange(change: number): string {
    return `${Math.abs(change).toFixed(2)}%`;
  }

  // Update price flashes when tokens update, but only if visible
  $: if ($tokenStore && isVisible) {
    $tokenStore.forEach(updatePriceFlash);
  }
</script>

<div
  bind:this={tickerElement}
  class="w-full overflow-hidden border-b border-kong-text-primary/10 text-sm bg-kong-bg-dark/80"
>
  <div class="w-full overflow-hidden relative">
    <div
      class="inline-flex px-2 animate-scroll whitespace-nowrap relative will-change-transform"
      class:paused={isChartHovered || !isVisible || isTickerHovered}
      on:mouseenter={() => (isTickerHovered = true)}
      on:mouseleave={() => (isTickerHovered = false)}
    >
      {#each $tokenStore as token, index (token.canister_id)}
        {#if token.metrics}
          <button
            class="flex items-center gap-2 cursor-pointer whitespace-nowrap relative px-4 py-1.5 {priceFlashStates.get(
              token.canister_id,
            )?.class || ''}"
            on:click={() => goto(`/stats/${token.address}`)}
            on:mouseenter={(e) => handleMouseEnter(e, token)}
            on:mouseleave={handleMouseLeave}
          >
            <span class="text-kong-text-secondary"
              >{index + 1}.</span
            >
            <span class="font-medium text-kong-text-primary"
              >{token.symbol}</span
            >
            <span class="text-kong-text-secondary"
              >${formatToNonZeroDecimal(Number(token.metrics.price))}</span
            >
            <span
              class="flex items-center gap-0.5 {getChangeClass(
                Number(token.metrics.price_change_24h),
              )}"
            >
              {#if Number(token.metrics.price_change_24h) > 0}
                <ArrowUp class="inline" size={12} />
              {:else if Number(token.metrics.price_change_24h) < 0}
                <ArrowDown class="inline" size={12} />
              {/if}
              {formatChange(Number(token.metrics.price_change_24h))}
            </span>
            <span class="divider"></span>
          </button>
        {/if}
      {/each}
      {#each $tokenStore as token, index (token.canister_id + "_dup")}
        {#if token.metrics}
          <button
            class="flex items-center gap-2 cursor-pointer whitespace-nowrap relative px-4 py-1.5 {priceFlashStates.get(
              token.canister_id,
            )?.class || ''}"
            on:click={() => goto(`/stats/${token.address}`)}
            on:mouseenter={(e) => handleMouseEnter(e, token)}
            on:mouseleave={handleMouseLeave}
          >
          
            <span class="font-medium text-kong-text-primary"
              >{token.symbol}</span
            >
            <span class="text-kong-text-secondary"
              >${formatToNonZeroDecimal(Number(token.metrics.price))}</span
            >
            <span
              class="flex items-center gap-0.5 {getChangeClass(
                Number(token.metrics.price_change_24h),
              )}"
            >
              {#if Number(token.metrics.price_change_24h) > 0}
                <ArrowUp class="inline" size={12} />
              {:else if Number(token.metrics.price_change_24h) < 0}
                <ArrowDown class="inline" size={12} />
              {/if}
              {formatChange(Number(token.metrics.price_change_24h))}
            </span>
            <span class="divider"></span>
          </button>
        {/if}
      {/each}
    </div>
  </div>
</div>

{#if hoveredToken && isVisible}
  <button
    class="fixed z-[999] w-[300px] h-[150px] bg-kong-bg-dark border border-kong-border rounded-xl shadow-lg overflow-hidden"
    style="left: {chartPosition.x}px; top: {chartPosition.y}px;"
    on:mouseenter={handleChartMouseEnter}
    on:mouseleave={handleChartMouseLeave}
    transition:fade={{ duration: 150 }}
  >
    <div class="flex justify-between items-center pb-2 px-2">
      <span class="font-medium text-kong-text-primary"
        >{hoveredToken.symbol}/ICP</span
      >
      <div class="flex items-center gap-2">
        <span class="text-kong-text-primary font-medium">
          ${formatToNonZeroDecimal(Number(hoveredToken.metrics.price))}
        </span>
        <span
          class="text-sm {getChangeClass(
            Number(hoveredToken.metrics.price_change_24h),
          )}"
        >
          {formatToNonZeroDecimal(
            Number(hoveredToken.metrics.price_change_24h),
          )}
        </span>
      </div>
    </div>
    {#key hoveredToken.address}
      <SimpleChart
        baseToken={hoveredToken}
        quoteToken={$tokenStore.find((t) => t.symbol === "ICP")}
      />
    {/key}
  </button>
{/if}

<style scoped lang="postcss">
  @keyframes scroll {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }

  .animate-scroll {
    animation: scroll 80s linear infinite;
    will-change: transform;
  }

  .animate-scroll.paused {
    animation-play-state: paused;
  }

  .positive {
    @apply text-kong-accent-green;
  }

  .negative {
    @apply text-kong-accent-red;
  }

  .neutral {
    @apply text-kong-text-secondary;
  }

  .divider {
    @apply absolute right-0 w-px h-4 bg-kong-text-primary opacity-50;
  }

  /* Price flash animations */
  .flash-green {
    animation: flash-green 1.2s ease-out;
    will-change: background;
  }

  .flash-red {
    animation: flash-red 1.2s ease-out;
    will-change: background;
  }

  @keyframes flash-green {
    0% {
      background: transparent;
    }
    15% {
      background: rgba(0, 204, 129, 0.06);
    }
    85% {
      background: rgba(0, 204, 129, 0.06);
    }
    100% {
      background: transparent;
    }
  }

  @keyframes flash-red {
    0% {
      background: transparent;
    }
    15% {
      background: rgba(209, 27, 27, 0.06);
    }
    85% {
      background: rgba(209, 27, 27, 0.06);
    }
    100% {
      background: transparent;
    }
  }
</style>
