<script lang="ts">
  import Swap from "$lib/components/swap/Swap.svelte";
  import PredictionMarketsBox from "$lib/components/home/PredictionMarketsBox.svelte";
  import KongTokenBox from "$lib/components/home/KongTokenBox.svelte";
  import SwapStats from "$lib/components/home/SwapStats.svelte";
  import LiquidityPools from "$lib/components/home/LiquidityPools.svelte";
  import WelcomeBox from "$lib/components/home/WelcomeBox.svelte";
  import FastSwapsBox from "$lib/components/home/FastSwapsBox.svelte";
  import RoutingBox from "$lib/components/home/RoutingBox.svelte";
  import Footer from "$lib/components/home/Footer.svelte";
  import { settingsStore } from "$lib/stores/settingsStore";
  import {
    ChevronDown,
  } from "lucide-svelte";
  import { fetchPoolTotals, fetchPools } from "$lib/api/pools";
  import { onMount } from "svelte";
  import { leaderboardStore } from "$lib/stores/leaderboardStore";

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
    $settingsStore.ticker_enabled ? 'h-[calc(100vh-132px)]' : 'h-[calc(100vh-90px)]'
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

<section class="relative {sectionHeight} flex flex-col">
  <!-- Swap Section with Explore Button -->
  <div class="flex-1 w-full flex flex-col">
    <div
      class="flex-1 w-full flex flex-col items-center p-2 md:p-0 md:mt-12 transition-all duration-200"
    >
      <Swap />
    </div>
    <!-- Explore Button -->
    <div class="w-full bg-gradient-to-t from-kong-bg-primary via-kong-bg-primary/80 to-transparent">
      <button onclick={scrollToExplore} class="w-full hover:bg-kong-bg-primary/20 transition-all duration-300 group">
        <span class="text-kong-text-secondary pb-2 text-sm flex flex-col items-center justify-center opacity-80 group-hover:opacity-100">
          Explore KongSwap
          <ChevronDown class="w-5 h-5 transition-transform group-hover:translate-y-0.5 stroke-kong-text-secondary text-kong-text-secondary" />
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
      <FastSwapsBox />

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
