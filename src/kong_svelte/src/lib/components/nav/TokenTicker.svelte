<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { ArrowUp, ArrowDown } from "lucide-svelte";
  import SimpleChart from "$lib/components/common/SimpleChart.svelte";
  import { fade } from "svelte/transition";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { onMount } from "svelte";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { startPolling, stopPolling } from "$lib/utils/pollingService";

  let hoveredToken: Kong.Token | null = null;
  let hoverTimeout: NodeJS.Timeout;
  let chartPosition = { x: 0, y: 0 };
  let isChartHovered = false;
  let isTickerHovered = false;
  let priceFlashStates = new Map<
    string,
    { class: string; timeout: NodeJS.Timeout }
  >();
  let isVisible = true;
  let quoteToken: Kong.Token | null = null;
  let tickerTokens: Kong.Token[] = [];
  let icpToken: Kong.Token | null = null;
  let ckUSDCToken: Kong.Token | null = null;
  let actualQuoteToken: 'ckUSDT' | 'ICP' = 'ckUSDT';
  let previousPrices = new Map<string, number>();
  let tickerWidth = 0;
  let contentWidth = 0;

  async function fetchTickerData() {
    try {
      const { tokens } = await fetchTokens();
      const sortedTokens = tokens
        .filter(token => Number(token.metrics?.volume_24h || 0) > 100)
        .sort((a, b) => {
          const volumeA = Number(a.metrics?.volume_24h || 0);
          const volumeB = Number(b.metrics?.volume_24h || 0);
          return volumeB - volumeA;
        })
        .slice(0, 10);

      // Update reference tokens
      quoteToken = tokens.find(t => t.symbol === "ckUSDT") || null;
      icpToken = tokens.find(t => t.symbol === "ICP") || null;
      ckUSDCToken = tokens.find(t => t.symbol === "ckUSDC") || null;

      // Check for new tokens or rearrangement
      const newTokenIds = sortedTokens.map(t => t.address).join(',');
      const currentTokenIds = tickerTokens.map(t => t.address).join(',');
      const hasNewTokens = newTokenIds !== currentTokenIds;

      // Update ticker tokens if the list changed
      if (hasNewTokens || tickerTokens.length === 0) {
        tickerTokens = sortedTokens;
        // Only process price updates for new token lists
        sortedTokens.forEach(newToken => {
          const currentPrice = Number(newToken.metrics?.price || 0);
          previousPrices.set(newToken.address, currentPrice);
        });
      } else {
        // Create a map of new token data by canister_id
        const tokenMap = new Map(sortedTokens.map(t => [t.address, t]));
        
        // Update existing token data and handle price flashing
        tickerTokens = tickerTokens.map(token => {
          const newData = tokenMap.get(token.address);
          if (newData && newData.metrics) {
            const updatedToken = { ...token, metrics: { ...newData.metrics } };
            
            // Handle price flash animation
            const prevPrice = previousPrices.get(token.address);
            const currentPrice = Number(newData.metrics?.price || 0);
            
            if (prevPrice !== undefined && prevPrice !== currentPrice && isVisible) {
              const flashClass = currentPrice > prevPrice ? "flash-green" : "flash-red";
              
              // Clear existing timeout if any
              if (priceFlashStates.has(token.address)) {
                clearTimeout(priceFlashStates.get(token.address)!.timeout);
              }
              
              // Set new flash state
              const timeout = setTimeout(() => {
                if (priceFlashStates.has(token.address)) {
                  priceFlashStates.delete(token.address);
                  priceFlashStates = new Map(priceFlashStates); // Trigger reactivity
                }
              }, 2000);
              
              priceFlashStates.set(token.address, { class: flashClass, timeout });
              priceFlashStates = new Map(priceFlashStates); // Trigger reactivity
            }
            
            // Update previous price
            previousPrices.set(token.address, currentPrice);
            
            return updatedToken;
          }
          return token;
        });
      }
    } catch (error) {
      console.error('Error fetching ticker data:', error);
    }
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

    const resizeObserver = new ResizeObserver(entries => {
      // Use a simple debounce mechanism to prevent excessive updates
      let timeoutId: NodeJS.Timeout;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        let newTickerWidth = tickerWidth;
        let newContentWidth = contentWidth;
        
        for (const entry of entries) {
          if (entry.target.classList.contains('ticker-container')) {
            newTickerWidth = entry.contentRect.width;
          } else if (entry.target.classList.contains('ticker-content')) {
            newContentWidth = entry.contentRect.width / 2;
          }
        }
        
        // Only update if values actually changed
        if (newTickerWidth !== tickerWidth || newContentWidth !== contentWidth) {
          tickerWidth = newTickerWidth;
          contentWidth = newContentWidth;
          
          if (tickerWidth && contentWidth) {
            const scrollElement = tickerElement?.querySelector(".ticker-content") as HTMLElement;
            if (scrollElement) {
              // Slower scroll for smoother animation
              const duration = (contentWidth / 25) * 1000;
              scrollElement.style.setProperty('--ticker-duration', `${duration}ms`);
            }
          }
        }
      }, 100); // 100ms debounce
    });

    // Observe both container and content
    const container = tickerElement?.querySelector(".ticker-container");
    const content = tickerElement?.querySelector(".ticker-content");
    if (container) resizeObserver.observe(container);
    if (content) resizeObserver.observe(content);

    // Initial fetch
    fetchTickerData();

    startPolling(
      "tickerData",
      () => {
        if (isVisible && !isChartHovered && !isTickerHovered) {
          fetchTickerData();
        }
      },
      14000
    );

    // Cleanup function
    return () => {
      if (observer) {
        observer.disconnect();
      }
      stopPolling("tickerData");
      priceFlashStates.forEach((state) => {
        clearTimeout(state.timeout);
      });
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      resizeObserver.disconnect();
    };
  });

  function handleMouseEnter(event: MouseEvent, token: Kong.Token) {
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
</script>

<div
  bind:this={tickerElement}
  class="w-full overflow-hidden text-sm token-ticker-bg token-ticker-border shadow-lg h-8 flex items-center"
>
  <div class="ticker-container h-full flex items-center">
    <div
      class="ticker-content h-full flex items-center"
      role="list"
      class:paused={isChartHovered || !isVisible || isTickerHovered}
      on:mouseenter={() => (isTickerHovered = true)}
      on:mouseleave={() => (isTickerHovered = false)}
    >
      {#each tickerTokens as token, index (token.address)}
        {#if token.metrics}
          <button
            class="flex items-center gap-2 cursor-pointer whitespace-nowrap relative px-4 h-full {priceFlashStates.get(
              token.address,
            )?.class || ''}"
            on:click={() => goto(`/stats/${token.address}`)}
            on:mouseenter={(e) => handleMouseEnter(e, token)}
            on:mouseleave={handleMouseLeave}
          >
            <span class="text-kong-text-secondary">{index + 1}.</span>
            <span class="font-medium text-kong-text-primary">{token.symbol}</span>
            <span class="text-kong-text-secondary"
              >${formatToNonZeroDecimal(Number(token.metrics?.price || 0))}</span
            >
            <span
              class="flex items-center gap-0.5 {getChangeClass(
                Number(token.metrics?.price_change_24h || 0),
              )}"
            >
              {#if Number(token.metrics?.price_change_24h || 0) > 0}
                <ArrowUp class="inline" size={12} />
              {:else if Number(token.metrics?.price_change_24h || 0) < 0}
                <ArrowDown class="inline" size={12} />
              {/if}
              {formatChange(Number(token.metrics?.price_change_24h || 0))}
            </span>
            <span class="divider"></span>
          </button>
        {/if}
      {/each}
      {#each tickerTokens as token, index (`${token.address}-duplicate`)}
        {#if token.metrics}
          <button
            class="flex items-center gap-2 cursor-pointer whitespace-nowrap relative px-4 h-full {priceFlashStates.get(
              token.address,
            )?.class || ''}"
            on:click={() => goto(`/stats/${token.address}`)}
            on:mouseenter={(e) => handleMouseEnter(e, token)}
            on:mouseleave={handleMouseLeave}
          >
            <span class="text-kong-text-secondary">{index + 1}.</span>
            <span class="font-medium text-kong-text-primary">{token.symbol}</span>
            <span class="text-kong-text-secondary"
              >${formatToNonZeroDecimal(Number(token.metrics?.price || 0))}</span
            >
            <span
              class="flex items-center gap-0.5 {getChangeClass(
                Number(token.metrics?.price_change_24h || 0),
              )}"
            >
              {#if Number(token.metrics?.price_change_24h || 0) > 0}
                <ArrowUp class="inline" size={12} />
              {:else if Number(token.metrics?.price_change_24h || 0) < 0}
                <ArrowDown class="inline" size={12} />
              {/if}
              {formatChange(Number(token.metrics?.price_change_24h || 0))}
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
          {hoveredToken.symbol}/{actualQuoteToken}
        {/if}
      </span>
      <div class="flex items-center gap-2">
        <span class="text-kong-text-primary font-medium">
          ${formatToNonZeroDecimal(Number(hoveredToken.metrics?.price || 0))}
        </span>
        <span
          class="text-sm {getChangeClass(
            Number(hoveredToken.metrics?.price_change_24h || 0),
          )}"
        >
          {formatToNonZeroDecimal(
            Number(hoveredToken.metrics?.price_change_24h || 0),
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
            ckUSDCToken ?? hoveredToken :
            hoveredToken
        }
        quoteToken={
          hoveredToken.symbol === "ICP" || hoveredToken.symbol === "ckUSDT" || hoveredToken.symbol === "ckUSDC" ?
            quoteToken ?? hoveredToken :
            quoteToken ?? icpToken ?? hoveredToken  // Always try ckUSDT first, fallback to ICP
        }
        price_change_24h={hoveredToken && hoveredToken.metrics ? Number(hoveredToken.metrics?.price_change_24h || 0) : 0}
        on:quoteTokenUsed={(event) => {
          actualQuoteToken = event.detail.symbol === "ckUSDT" ? "ckUSDT" : "ICP";
        }}
      />
    {/key}
  </button>
{/if}

<style scoped lang="postcss">
  /* Add token ticker background class */
  :global(.token-ticker-bg) {
    background-color: rgb(var(--bg-dark) / calc(var(--token-ticker-bg-opacity, 80) / 100));
  }

  /* Token ticker border styles */
  :global(.token-ticker-border) {
    /* Default border style */
    border-bottom: var(--token-ticker-border, 1px solid rgba(255, 255, 255, 0.1));
  }

  /* Windows 95 style border */
  :global([style*="--token-ticker-border-style: win95"] .token-ticker-border) {
    border: none;
    box-shadow: inset 1px 1px 0px #FFFFFF, 
                inset -1px -1px 0px #808080, 
                inset 2px 2px 0px #DFDFDF, 
                inset -2px -2px 0px #404040;
  }

  /* No border style */
  :global([style*="--token-ticker-border-style: none"] .token-ticker-border) {
    border: none;
    box-shadow: none;
  }

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
    transform: translate3d(0, 0, 0);
    -webkit-transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    perspective: 1000;
    -webkit-perspective: 1000;
    transform-style: preserve-3d;
    contain: layout style paint;
    z-index: 1;
  }

  .ticker-content {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    animation: none; /* Remove default animation */
    transform: translate3d(0, 0, 0);
    will-change: transform;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    perspective: 1000;
    -webkit-perspective: 1000;
    transform-style: preserve-3d;
    contain: layout style paint;
    /* Use CSS custom property for transform */
    animation: ticker var(--ticker-duration, 30000ms) linear infinite;
    animation-play-state: var(--ticker-play-state, running);
  }

  .ticker-content.paused {
    --ticker-play-state: paused;
  }

  @keyframes ticker {
    0% {
      transform: translate3d(0, 0, 0);
    }
    100% {
      transform: translate3d(-50%, 0, 0);
    }
  }

  /* Move flash animations to pseudo elements to prevent main element reflows */
  .flash-green::before,
  .flash-red::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: -1;
    opacity: 0;
    will-change: opacity;
  }

  .flash-green::before {
    background: rgba(0, 204, 129, 0.06);
    animation: flash-opacity 1.2s ease-out;
  }

  .flash-red::before {
    background: rgba(209, 27, 27, 0.06);
    animation: flash-opacity 1.2s ease-out;
  }

  @keyframes flash-opacity {
    0% {
      opacity: 0;
    }
    15% {
      opacity: 1;
    }
    85% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  /* Optimize button rendering */
  button {
    transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    transform-style: preserve-3d;
    contain: layout style paint;
  }

  .positive {
    @apply text-kong-text-accent-green;
  }

  .negative {
    @apply text-kong-text-accent-red;
  }

  .neutral {
    @apply text-kong-text-secondary;
  }

  .divider {
    @apply absolute right-0 w-px h-4 bg-kong-text-primary/50 opacity-50;
  }
</style>
