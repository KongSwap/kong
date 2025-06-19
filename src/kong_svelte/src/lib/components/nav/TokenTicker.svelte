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
  let priceFlashStates = new Map<string, { class: string; timeout: NodeJS.Timeout }>();
  let isVisible = true;
  let quoteToken: Kong.Token | null = null;
  let tickerTokens: Kong.Token[] = [];
  let icpToken: Kong.Token | null = null;
  let ckUSDCToken: Kong.Token | null = null;
  let actualQuoteToken: 'ckUSDT' | 'ICP' = 'ckUSDT';
  let previousPrices = new Map<string, number>();
  let pendingUpdates = new Set<Kong.Token>();
  let updateScheduled = false;
  
  let tickerElement: HTMLElement;
  let scrollElement: HTMLElement | null = null;
  let animationFrameId: number | null = null;
  let scrollPosition = 0;
  let scrollSpeed = 0.3; // pixels per frame - reduced from 1 to 0.3 for slower scrolling
  let isPaused = false;

  function startScrollAnimation() {
    if (animationFrameId) return;
    
    function animate() {
      if (!scrollElement || isPaused) return;
      
      scrollPosition -= scrollSpeed;
      if (scrollPosition <= -scrollElement.scrollWidth / 2) {
        scrollPosition = 0;
      }
      
      scrollElement.style.transform = `translateX(${scrollPosition}px)`;
      animationFrameId = requestAnimationFrame(animate);
    }
    
    animationFrameId = requestAnimationFrame(animate);
  }

  function stopScrollAnimation() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

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

      quoteToken = tokens.find(t => t.symbol === "ckUSDT") || null;
      icpToken = tokens.find(t => t.symbol === "ICP") || null;
      ckUSDCToken = tokens.find(t => t.symbol === "ckUSDC") || null;

      const newTokenIds = sortedTokens.map(t => t.address).join(',');
      const currentTokenIds = tickerTokens.map(t => t.address).join(',');
      const hasNewTokensOrOrderChanged = newTokenIds !== currentTokenIds;

      sortedTokens.forEach(newToken => pendingUpdates.add(newToken));
      scheduleUpdate();

      if (hasNewTokensOrOrderChanged || tickerTokens.length === 0) {
        tickerTokens = sortedTokens;
      } else {
        const tokenMap = new Map(sortedTokens.map(t => [t.address, t]));
        tickerTokens = tickerTokens.map(token => {
          const newData = tokenMap.get(token.address);
          if (newData && newData.metrics) return { ...token, metrics: { ...newData.metrics } };
          return token;
        });
      }
    } catch (error) {
      console.error('[Ticker] Error fetching ticker data:', error);
    }
  }

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
      const prevPrice = previousPrices.get(token.address);
      const currentPrice = Number(token.metrics?.price || 0);

      if (prevPrice !== undefined && prevPrice !== currentPrice) {
        const flashClass = currentPrice > prevPrice ? "flash-green" : "flash-red";
        if (priceFlashStates.has(token.address)) {
          clearTimeout(priceFlashStates.get(token.address)!.timeout);
        }
        const timeout = setTimeout(() => {
          if (priceFlashStates.has(token.address)) {
            priceFlashStates.delete(token.address);
            priceFlashStates = priceFlashStates;
          }
        }, 2000);
        priceFlashStates.set(token.address, { class: flashClass, timeout });
      }
      previousPrices.set(token.address, currentPrice);
    });
    pendingUpdates.clear();
    if (isVisible) {
      priceFlashStates = priceFlashStates;
    }
  }

  let observer: IntersectionObserver;

  onMount(() => {
    scrollElement = tickerElement.querySelector<HTMLElement>(".ticker-content");
    
    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          isVisible = entry.isIntersecting;
          isPaused = !isVisible || isChartHovered || isTickerHovered;
          if (isVisible && !isPaused) {
            startScrollAnimation();
          } else {
            stopScrollAnimation();
          }
        }
      },
      { threshold: 0, rootMargin: "50px 0px" }
    );

    if (tickerElement) {
      observer.observe(tickerElement);
    }

    fetchTickerData();
    startPolling("tickerData", () => {
      if (isVisible && !isChartHovered && !isTickerHovered) {
        fetchTickerData();
      }
    }, 14000);

    return () => {
      if (observer) observer.disconnect();
      stopPolling("tickerData");
      stopScrollAnimation();
      priceFlashStates.forEach((state) => clearTimeout(state.timeout));
      if (hoverTimeout) clearTimeout(hoverTimeout);
    };
  });

  function handleMouseEnter(event: MouseEvent, token: Kong.Token) {
    if (!isVisible) return;
    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    chartPosition = { x: rect.left, y: rect.bottom + 8 };
    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => { hoveredToken = token; }, 200);
  }

  function handleMouseLeave() {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => { hoveredToken = null; }, 200);
  }

  function handleChartMouseEnter() {
    clearTimeout(hoverTimeout);
    isChartHovered = true;
    isPaused = true;
    stopScrollAnimation();
  }

  function handleChartMouseLeave() {
    isChartHovered = false;
    isPaused = isTickerHovered || !isVisible;
    if (!isPaused) {
      startScrollAnimation();
    }
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
  class="w-full opacity-90 hover:opacity-100 transition-opacity duration-200 overflow-hidden text-sm token-ticker-bg token-ticker-border shadow-lg h-8 flex items-center"
  style="max-width: 100vw;"
>
  <div class="ticker-container h-full flex items-center">
    <div
      class="ticker-content h-full flex items-center"
      role="list"
      onmouseenter={() => {
        isTickerHovered = true;
        isPaused = true;
        stopScrollAnimation();
      }}
      onmouseleave={() => {
        isTickerHovered = false;
        isPaused = isChartHovered || !isVisible;
        if (!isPaused) {
          startScrollAnimation();
        }
      }}
    >
      {#each [...tickerTokens, ...tickerTokens] as token, index (token.address + index)}
        {#if token.metrics}
          <button
            class="flex items-center gap-2 cursor-pointer whitespace-nowrap relative px-4 h-full {priceFlashStates.get(
              token.address,
            )?.class || ''}"
            onclick={() => goto(`/stats/${token.address}`)}
            onmouseenter={(e) => handleMouseEnter(e, token)}
            onmouseleave={handleMouseLeave}
          >
            <span class="text-kong-text-secondary">{index % tickerTokens.length + 1}.</span>
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
    class="fixed z-[999] w-[300px] h-[150px] bg-kong-bg-primary border border-kong-border rounded-xl shadow-lg overflow-hidden {$page.url.pathname === `/stats/${hoveredToken.address}` ? 'ring-2 ring-kong-success' : ''}"
    style="left: {chartPosition.x}px; top: {chartPosition.y}px;"
    onmouseenter={handleChartMouseEnter}
    onmouseleave={handleChartMouseLeave}
    onclick={() => goto(`/stats/${hoveredToken.address}`)}
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
            hoveredToken :
          hoveredToken.symbol === "ckUSDT" || hoveredToken.symbol === "ckUSDC" ?
            ckUSDCToken ?? hoveredToken :
            hoveredToken
        }
        quoteToken={
          hoveredToken.symbol === "ICP" || hoveredToken.symbol === "ckUSDT" || hoveredToken.symbol === "ckUSDC" ?
            quoteToken ?? hoveredToken :
            quoteToken ?? icpToken ?? hoveredToken
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
  :global(.token-ticker-bg) {
    background-color: rgb(var(--bg-dark) / calc(var(--token-ticker-bg-opacity, 80) / 100));
  }
  :global(.token-ticker-border) {
    border-bottom: var(--token-ticker-border, 1px solid rgba(255, 255, 255, 0.1));
  }
  :global([style*="--token-ticker-border-style: win95"] .token-ticker-border) {
    border: none;
    box-shadow: inset 1px 1px 0px #FFFFFF, 
                inset -1px -1px 0px #808080, 
                inset 2px 2px 0px #DFDFDF, 
                inset -2px -2px 0px #404040;
  }
  :global([style*="--token-ticker-border-style: none"] .token-ticker-border) {
    border: none;
    box-shadow: none;
  }

  .ticker-container {
    width: 100%;
    overflow: hidden;
    position: relative;
    -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
    mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
  }

  .ticker-content {
    display: flex;
    align-items: center;
    white-space: nowrap;
    flex-shrink: 0;
    width: max-content;
    will-change: transform;
  }

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
    0% { opacity: 0; }
    15% { opacity: 1; }
    85% { opacity: 1; }
    100% { opacity: 0; }
  }

  button {
    transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    transform-style: preserve-3d;
    contain: layout style paint;
  }

  .positive { @apply text-kong-success; }
  .negative { @apply text-kong-error; }
  .neutral { @apply text-kong-text-secondary; }
  .divider { @apply absolute right-0 w-px h-4 bg-kong-text-primary/50 opacity-50; }
</style>
