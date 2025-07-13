<script lang="ts">
  import SwapContainer from "$lib/features/swap/components/SwapContainer.svelte";
  import PredictionMarketsBox from "$lib/components/home/PredictionMarketsBox.svelte";
  import KongTokenBox from "$lib/components/home/KongTokenBox.svelte";
  import SwapStats from "$lib/components/home/SwapStats.svelte";
  import LiquidityPools from "$lib/components/home/LiquidityPools.svelte";
  import WelcomeBox from "$lib/components/home/WelcomeBox.svelte";
  import FastSwapsBox from "$lib/components/home/FastSwapsBox.svelte";
  import RoutingBox from "$lib/components/home/RoutingBox.svelte";
  import Footer from "$lib/components/home/Footer.svelte";
  import { settingsStore } from "$lib/stores/settingsStore";
  import { ChevronDown } from "lucide-svelte";
  import { fetchPoolTotals, fetchPools } from "$lib/api/pools";
  import { onMount } from "svelte";
  import { leaderboardStore } from "$lib/stores/leaderboardStore";
  import { themeStore } from "$lib/stores/themeStore";
  import { getCoreThemeById } from "$lib/themes/themeRegistry";

  let poolStats = $state<{
    total_volume_24h: number;
    total_tvl: number;
    total_fees_24h: number;
  }>({ total_volume_24h: 0, total_tvl: 0, total_fees_24h: 0 });

  let poolCount = $state(0);

  let isLoadingStats = $state(true);

  // Calculate height based on ticker visibility
  // Base height: 100px (navbar) + 32px (ticker when visible)
  let sectionHeight = $derived(
    $settingsStore.ticker_enabled
      ? "h-[calc(100vh-132px)]"
      : "h-[calc(100vh-90px)]",
  );

  // Get current theme and swap page background settings
  let currentCoreTheme = $derived(getCoreThemeById($themeStore));
  let swapPageBgConfig = $derived(
    (() => {
      if (!currentCoreTheme) return null;

      const themeWithBg = currentCoreTheme as any; // Type assertion to access swapPageBg
      return themeWithBg.swapPageBg || null;
    })(),
  );

  function scrollToExplore() {
    document
      .getElementById("explore-section")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async function loadStats() {
    try {
      const [poolData, poolsData] = await Promise.all([
        fetchPoolTotals(),
        fetchPools({ limit: 1 }), // Just get total count
        leaderboardStore.loadLeaderboard("day"),
      ]);
      poolStats = poolData;
      poolCount = poolsData.total_count || 0;
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      isLoadingStats = false;
    }
  }

  onMount(() => {
    loadStats();
  });
</script>

<section class="relative {sectionHeight} flex flex-col bg-transparent">
  <!-- Swap Section with Explore Button -->
  <div class="flex-1 w-full flex flex-col bg-transparent relative">
    <!-- Theme-based Swap Page Background positioned behind everything -->
    {#if swapPageBgConfig}
      <div
        class="fixed inset-x-0 w-full"
        style="top: 0; height: {sectionHeight
          .replace('h-[', '')
          .replace(']', '')}; z-index: 0; pointer-events: none;"
      >
        <!-- Background layer (image or CSS) -->
        <div
          class="absolute inset-0"
          style="
            {swapPageBgConfig.image
            ? `background-image: url(${swapPageBgConfig.image});`
            : ''}
            {swapPageBgConfig.css ||
            (swapPageBgConfig.image
              ? 'background-size: cover; background-position: center center; background-repeat: no-repeat;'
              : '')}
            opacity: {swapPageBgConfig.opacity || 0.3};
          "
        ></div>

        <!-- Gradient overlay to blend with page background -->
        <div
          class="absolute inset-0 bg-gradient-to-t from-kong-bg-primary/10 via-transparent to-transparent"
        ></div>
      </div>
    {/if}

    <div
      class="flex-1 w-full flex flex-col items-center pt-1 md:p-0 md:mt-6 transition-all duration-200 bg-transparent relative"
    >
      <!-- Professional Header Section -->
      <header class="text-center mb-8 relative" role="banner">
        <!-- Subtle background accent -->
        <div class="absolute inset-0 rounded-2xl -z-10"></div>

        <!-- Main headline with professional typography -->
        <div class="space-y-2">
          <!-- KongSwap title -->
          <h1
            class="font-title-thick text-4xl md:text-5xl lg:text-6xl text-kong-text-primary tracking-tight"
          >
            Kong<span class="text-kong-primary">Swap</span>
          </h1>

          <!-- Professional subtitle -->
          <h2
            class="text-kong-text-secondary text-lg md:text-xl lg:text-2xl font-medium max-w-md mx-auto leading-relaxed"
          >
            Bridgeless Multi-Chain DeFi
          </h2>
        </div>

        <!-- Clean feature description -->
        <div class="!max-w-lg mx-auto mt-3">
          <p
            class="text-kong-text-secondary/80 text-sm md:text-base leading-relaxed"
          >
            Trade seamlessly across multiple blockchains with
            <span class="text-kong-primary font-medium">zero bridges</span> and
            <span class="text-kong-primary font-medium"
              >zero wrappers</span
            >.
          </p>
        </div>
      </header>

      <!-- Swap Container with enhanced spacing -->
      <div class="w-full max-w-md mx-auto">
        <SwapContainer />
      </div>
    </div>
    <!-- Explore Button -->
    <div class="w-full bg-transparent relative z-10">
      <button
        onclick={scrollToExplore}
        class="w-full hover:bg-kong-bg-primary/20 transition-all duration-300 group"
      >
        <span
          class="text-kong-text-secondary pb-4 text-sm flex flex-col items-center justify-center opacity-80 group-hover:opacity-100"
        >
          <span class="hidden sm:inline">Explore KongSwap</span>
          <ChevronDown
            class="w-5 h-5 transition-transform group-hover:translate-y-0.5 stroke-kong-text-secondary text-kong-text-secondary"
          />
        </span>
      </button>
    </div>
  </div>
</section>

<!-- Bento Boxes Section -->
<section
  id="explore-section"
  class="w-full px-4 md:py-24 bg-gradient-to-b from-kong-bg-primary to-kong-bg-secondary min-h-screen"
>
  <div class="max-w-7xl mx-auto">
    <!-- Bento Grid -->
    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-min"
    >
      <!-- Welcome Box -->
      <WelcomeBox />

      <!-- Swap Stats Box -->
      <SwapStats {poolStats} {isLoadingStats} />

      <!-- Fast Swaps Box -->
      <FastSwapsBox {poolStats} {isLoadingStats} />

      <!-- Routing Box -->
      <RoutingBox />

      <!-- Kong Token & DAO Box -->
      <KongTokenBox />

      <!-- Prediction Markets Box -->
      <PredictionMarketsBox />

      <!-- Liquidity Pools Box -->
      <LiquidityPools {poolStats} {poolCount} {isLoadingStats} />
    </div>
  </div>
</section>

<!-- Footer -->
<Footer />

<style>
  /* Add smooth scroll behavior */
  :global(html) {
    scroll-behavior: smooth;
  }

  /* Animate bento boxes on scroll */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
