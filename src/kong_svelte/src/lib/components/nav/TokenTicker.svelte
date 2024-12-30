<script lang="ts">
  import { goto } from "$app/navigation";
  import { liveTokens } from "$lib/services/tokens/tokenStore";
  import { ArrowUp, ArrowDown } from "lucide-svelte";
  import { derived } from "svelte/store";
  import SimpleChart from "$lib/components/common/SimpleChart.svelte";
  import { fade } from "svelte/transition";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

  let hoveredToken: FE.Token | null = null;
  let hoverTimeout: NodeJS.Timeout;
  let chartPosition = { x: 0, y: 0 };
  let isChartHovered = false;

  function handleMouseEnter(event: MouseEvent, token: FE.Token) {
    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();

    // Position the chart below the ticker item
    chartPosition = {
      x: rect.left,
      y: rect.bottom + 8,
    };

    // Clear any existing timeout
    if (hoverTimeout) clearTimeout(hoverTimeout);

    // Set a small delay before showing the chart
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

  const sortedTokens = derived(liveTokens, ($tokens) => {
    return [...$tokens].sort((a, b) => {
      const volumeA = Number(a.metrics?.volume_24h || 0);
      const volumeB = Number(b.metrics?.volume_24h || 0);
      return volumeB - volumeA;
    });
  });

  function getChangeClass(change: number): string {
    return change > 0 ? "positive" : change < 0 ? "negative" : "neutral";
  }

  function formatChange(change: number): string {
    return `${Math.abs(change).toFixed(2)}%`;
  }
</script>

<div
  class="w-full overflow-hidden border-b border-kong-text-primary/10 text-sm bg-kong-bg-dark/80"
>
  <div class="w-full overflow-hidden relative">
    <div
      class="inline-flex px-2 animate-scroll whitespace-nowrap relative will-change-transform"
      class:paused={isChartHovered}
    >
      {#each $liveTokens.sort((a, b) => Number(b.metrics.volume_24h) - Number(a.metrics.volume_24h)).slice(0, 20) as token}
        {#if token.metrics}
          <button
            class="flex items-center gap-2 cursor-pointer whitespace-nowrap relative px-4 py-1.5"
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
      {#each $liveTokens.sort((a, b) => Number(b.metrics.volume_24h) - Number(a.metrics.volume_24h)).slice(0, 20) as token}
        {#if token.metrics}
          <button
            class="flex items-center gap-2 cursor-pointer whitespace-nowrap relative px-4 py-1.5"
            on:click={() => goto(`/stats/${token.address}`)}
            on:mouseenter={(e) => handleMouseEnter(e, token)}
            on:mouseleave={handleMouseLeave}
          >
            <span class="font-medium text-kong-text-primary">{token.symbol}</span>
            <span class="text-kong-text-secondary">${formatToNonZeroDecimal(Number(token.metrics.price))}</span>
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

{#if hoveredToken}
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
        <span class="text-kong-text-primary font-medium"
          >${formatToNonZeroDecimal(Number(hoveredToken.metrics.price))}</span
        >
        <span
          class="text-sm {getChangeClass(
            Number(hoveredToken.metrics.price_change_24h),
          )}"
        >
          {formatToNonZeroDecimal(Number(hoveredToken.metrics.price_change_24h))}
        </span>
      </div>
    </div>
    {#key hoveredToken.address}
      <SimpleChart
        baseToken={hoveredToken}
        quoteToken={$sortedTokens.find((t) => t.symbol === "ICP")}
      />
    {/key}
  </button>
{/if}

<style lang="postcss">
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
  }

  .animate-scroll:hover,
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
</style>
