<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { tokenStore } from "$lib/stores/tokenData";
  import { ArrowUp, ArrowDown } from "lucide-svelte";
  import SimpleChart from "$lib/components/common/SimpleChart.svelte";
  import { fade } from "svelte/transition";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { onDestroy, onMount } from "svelte";
  import { writable } from "svelte/store";

  let hoveredToken: FE.Token | null = null;
  let hoverTimeout: NodeJS.Timeout;
  let chartPosition = { x: 0, y: 0 };
  let isChartHovered = false;
  let isTickerHovered = false;
  let priceFlashStates = new Map<
    string,
    { class: string; timeout: NodeJS.Timeout }
  >();
  let isVisible = true;

  // Create a local store for ticker tokens
  const tickerTokens = writable<FE.Token[]>([]);

  // Track previous prices to detect changes using a more efficient structure
  let previousPrices = new Map<string, number>();

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
    // More efficient observer options
    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          isVisible = entry.isIntersecting;
          // Use requestAnimationFrame for smoother state updates
          requestAnimationFrame(() => {
            const scrollElement = tickerElement?.querySelector(".ticker-content");
            if (scrollElement) {
              scrollElement.classList.toggle("paused", !isVisible);
            }
          });
        }
      },
      { 
        threshold: 0,
        rootMargin: "50px 0px" // Preload before visible
      }
    );

    if (tickerElement) {
      observer.observe(tickerElement);
    }
  });

  onDestroy(() => {
    // Clean up Intersection Observer
    if (observer) {
      observer.disconnect();
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

  // Add reactive statement to handle token updates
  $: if ($tokenStore && isVisible) {
    // Sort tokens by volume and take top 10
    const sortedTokens = [...$tokenStore]
      .filter(token => Number(token.metrics?.volume_24h || 0) > 100)
      .sort((a, b) => {
        const volumeA = Number(a.metrics?.volume_24h || 0);
        const volumeB = Number(b.metrics?.volume_24h || 0);
        return volumeB - volumeA;
      })
      .slice(0, 10);

    // Track price changes for sorted tokens
    sortedTokens.forEach(token => {
      const currentPrice = Number(token.metrics?.price || 0);
      const prevPrice = previousPrices.get(token.canister_id);
      
      if (prevPrice !== undefined && prevPrice !== currentPrice) {
        pendingUpdates.add(token);
        scheduleUpdate();
      }
      
      previousPrices.set(token.canister_id, currentPrice);
    });

    // Update the local ticker store instead of the main store
    tickerTokens.set(sortedTokens);
  }

  $: if (hoveredToken) {
    console.log('Tokens for chart:', {
      hoveredSymbol: hoveredToken.symbol,
      ckUSDT: $tokenStore.find((t) => t.symbol === "ckUSDT"),
      ICP: $tokenStore.find((t) => t.symbol === "ICP")
    });
  }
</script>

<div
  bind:this={tickerElement}
  class="w-full overflow-hidden border-b border-kong-text-primary/10 text-sm bg-kong-bg-dark/80 shadow-lg h-8 flex items-center"
>
  <div class="ticker-container h-full flex items-center">
    <div
      class="ticker-content h-full flex items-center"
      role="list"
      class:paused={isChartHovered || !isVisible || isTickerHovered}
      on:mouseenter={() => (isTickerHovered = true)}
      on:mouseleave={() => (isTickerHovered = false)}
    >
      {#each $tickerTokens as token, index (token.canister_id)}
        {#if token.metrics}
          <button
            class="flex items-center gap-2 cursor-pointer whitespace-nowrap relative px-4 h-full {priceFlashStates.get(
              token.canister_id,
            )?.class || ''}"
            on:click={() => goto(`/stats/${token.address}`)}
            on:mouseenter={(e) => handleMouseEnter(e, token)}
            on:mouseleave={handleMouseLeave}
          >
            <span class="text-kong-text-secondary">{index + 1}.</span>
            <span class="font-medium text-kong-text-primary">{token.symbol}</span>
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
      {#each $tickerTokens as token, index (token.canister_id + "_dup")}
        {#if token.metrics}
          <button
            class="flex items-center gap-2 cursor-pointer whitespace-nowrap relative px-4 h-full {priceFlashStates.get(
              token.canister_id,
            )?.class || ''}"
            on:click={() => goto(`/stats/${token.address}`)}
            on:mouseenter={(e) => handleMouseEnter(e, token)}
            on:mouseleave={handleMouseLeave}
          >
            <span class="text-kong-text-secondary">{index + 1}.</span>
            <span class="font-medium text-kong-text-primary">{token.symbol}</span>
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
    class="fixed z-[999] w-[300px] h-[150px] bg-kong-bg-dark border border-kong-border rounded-xl shadow-lg overflow-hidden {$page.url.pathname === `/stats/${hoveredToken.address}` ? 'ring-2 ring-kong-accent-green' : ''}"
    style="left: {chartPosition.x}px; top: {chartPosition.y}px;"
    on:mouseenter={handleChartMouseEnter}
    on:mouseleave={handleChartMouseLeave}
    on:click={() => goto(`/stats/${hoveredToken.address}`)}
    transition:fade={{ duration: 150 }}
  >
    <div class="flex justify-between items-center px-2">
      <span class="font-medium text-kong-text-primary">
        {#if hoveredToken.symbol === "ICP"}
          ICP/ckUSDT
        {:else if hoveredToken.symbol === "ckUSDT"}
          ckUSDC/ckUSDT
        {:else if hoveredToken.symbol === "ckUSDC"}
          ckUSDC/ckUSDT
        {:else}
          {hoveredToken.symbol}/ICP
        {/if}
      </span>
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
          )}%
        </span>
      </div>
    </div>
    {#key hoveredToken.address}
      <SimpleChart
        baseToken={
          hoveredToken.symbol === "ICP" ? 
            hoveredToken :  // Pass ICP as base for ICP/ckUSDT
          hoveredToken.symbol === "ckUSDT" || hoveredToken.symbol === "ckUSDC" ?
            $tokenStore.find((t) => t.symbol === "ckUSDC") ?? hoveredToken :
            hoveredToken
        }
        quoteToken={
          hoveredToken.symbol === "ICP" ? 
            $tokenStore.find((t) => t.symbol === "ckUSDT") ?? hoveredToken :
          hoveredToken.symbol === "ckUSDT" || hoveredToken.symbol === "ckUSDC" ?
            $tokenStore.find((t) => t.symbol === "ckUSDT") ?? hoveredToken :
            $tokenStore.find((t) => t.symbol === "ICP") ?? hoveredToken
        }
      />
    {/key}
  </button>
{/if}

<style scoped lang="postcss">
  .ticker-container {
    width: 100%;
    overflow: hidden;
    position: relative;
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      black 5%,
      black 95%,
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      black 5%,
      black 95%,
      transparent
    );
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
    backface-visibility: hidden;
    perspective: 1000;
    isolation: isolate;
    contain: content;
    z-index: 1;
  }

  .ticker-content {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    animation: ticker 30s linear infinite;
    transform: translate3d(0, 0, 0) translateZ(0);
    will-change: transform;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    perspective: 1000;
    -webkit-perspective: 1000;
    contain: content;
  }

  .ticker-content.paused {
    animation-play-state: paused;
  }

  @keyframes ticker {
    0% {
      transform: translate3d(0, 0, 0);
    }
    100% {
      transform: translate3d(-50%, 0, 0);
    }
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
    @apply absolute right-0 w-px h-4 bg-kong-text-primary/50 opacity-50;
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
