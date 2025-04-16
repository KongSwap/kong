<script lang="ts">
  import { onMount } from 'svelte';
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { TrendingUp, Zap, Globe, BarChart3 } from "lucide-svelte";
  import { getPredictionMarketStats } from '$lib/api/predictionMarket';
  
  // Import the StatCard component
  import StatCard from './StatCard.svelte';
  import FeatureList from './FeatureList.svelte';
  import IphoneFrame from './IphoneFrame.svelte';
  
  // Section visibility prop using $props
  let { isVisible = false } = $props<{ isVisible?: boolean }>();
  
  // Component state using $state
  let mounted = $state(false);
  
  // Stats for prediction markets - Initialize with loading state using $state
  let totalMarkets = $state<number | null>(null);
  let activeMarkets = $state<number | null>(null);
  let totalBets = $state<number | null>(null);
  let isLoadingStats = $state(false);
  let errorLoadingStats = $state<string | null>(null);
  
  // Feature bullets data
  const features = [
    {
      title: "Get Rewarded",
      description: "Forecast future events and earn rewards with Kong's decentralized prediction markets."
    },
    {
      title: "Zero Fees",
      description: "No platform fees! Trade without paying platform commissions."
    },
    {
      title: "Multiple Resolution Methods",
      description: "Markets can be resolved by the community, a trusted third party, or Oracle."
    }
  ];
  
  // Tweened values for animations - remain the same, no $state needed for the store itself
  let tweenedMarkets = tweened(0, { duration: 1500, easing: cubicOut });
  let tweenedActiveMarkets = tweened(0, { duration: 1500, easing: cubicOut });
  let tweenedTotalBets = tweened(0, { duration: 1500, easing: cubicOut });
  
  // Animation state using $state
  let animationClass = $state('');
  let sectionRef = $state<HTMLElement | undefined>(undefined); // For bind:this
  let hasTriggeredAnimation = $state(false);
  
  // Effect to trigger animation based on visibility
  $effect(() => {
    // Log visibility change for animation trigger
    // console.log(`PredictionMarketsSection Animation Effect: isVisible=${isVisible}, hasTriggeredAnimation=${hasTriggeredAnimation}, mounted=${mounted}`);
    if (isVisible && !hasTriggeredAnimation && mounted) {
      triggerAnimation();
    }
  });
  
  function triggerAnimation() {
    hasTriggeredAnimation = true;
    requestAnimationFrame(() => {
      // Modify $state directly
      animationClass = 'translate-y-0 opacity-100';
    });
  }
  
  // Fetch stats function (modifies $state variables)
  async function fetchStats() {
    if (!mounted) {
      return; // Don't fetch if component is unmounted
    }
    
    isLoadingStats = true;
    errorLoadingStats = null;
    try {
      const stats = await getPredictionMarketStats();
      
      if (!mounted) {
        console.log("PredictionMarketsSection fetchStats: Unmounted during API call. Aborting update.");
        // Note: 'finally' will still run and manage isLoadingStats if mounted state is checked there too
        return; 
      }
      
      totalMarkets = Number(stats.total_markets);
      activeMarkets = Number(stats.total_active_markets);
      totalBets = Number(stats.total_bets);
      // Start tweened animations after fetching data
      tweenedMarkets.set(totalMarkets);
      tweenedActiveMarkets.set(activeMarkets);
      tweenedTotalBets.set(totalBets);
    } catch (error) {
      console.error("PredictionMarketsSection: Error fetching stats:", error);
      errorLoadingStats = "Failed to load stats.";
      // Set default values on error
      totalMarkets = 50; // Example default
      activeMarkets = 10; // Example default
      totalBets = 2500; // Example default
      console.log("PredictionMarketsSection: Setting default stats due to error.");
      // Update tweened values even on error with defaults
      tweenedMarkets.set(totalMarkets);
      tweenedActiveMarkets.set(activeMarkets);
      tweenedTotalBets.set(totalBets);
    } finally {
      if (mounted) {
        isLoadingStats = false;
      } else {
         console.log("PredictionMarketsSection fetchStats Finally: Component unmounted, not setting isLoadingStats.");
      }
    }
  }
  
  // onMount lifecycle hook
  onMount(() => {
    mounted = true;
    console.log("PredictionMarketsSection: Mounted.");
    
    // Fetch logic is now solely handled by the $effect below
    
    return () => {
      console.log("PredictionMarketsSection: Unmounting.");
      mounted = false;
    };
  });
  
  // Effect to fetch data when visibility changes OR on initial mount if visible
  $effect(() => {
    // Condition: Visible, mounted, haven't loaded stats yet (totalMarkets is null), and not currently loading.
    if (isVisible && mounted && totalMarkets === null && !isLoadingStats) {
      fetchStats();
    }
  });
</script>

<section 
  id="prediction-markets"
  bind:this={sectionRef} 
  class="min-h-screen py-16 pb-24 sm:pb-16 px-2 sm:px-4 md:pt-0 w-full flex items-center justify-center bg-[#0D111F] relative overflow-hidden"
>
  <!-- Animated background grid - reduced complexity for mobile -->
  <div class="absolute inset-0 grid grid-cols-[repeat(8,1fr)] md:grid-cols-[repeat(16,1fr)] grid-rows-[repeat(8,1fr)] md:grid-rows-[repeat(16,1fr)] opacity-10">
    {#each Array(64) as _}
      <div class="border-[0.5px] border-white/5"></div>
    {/each}
  </div>
  
  <!-- Market Data Visualization Background - Only render when visible -->
  <div class="absolute inset-0 overflow-hidden pointer-events-none opacity-30 md:opacity-100">
    <!-- Market trend lines - Simplified for performance -->
    <svg class="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 1000 1000" preserveAspectRatio="none">
      <!-- Subtle grid lines - reduced for performance -->
      {#each Array(3) as _, i}
        <line 
          x1="0" 
          y1={i * 300} 
          x2="1000" 
          y2={i * 300} 
          stroke="rgba(135, 206, 235, 0.1)" 
          stroke-width="1"
        />
        <line 
          x1={i * 300} 
          y1="0" 
          x2={i * 300} 
          y2="1000" 
          stroke="rgba(135, 206, 235, 0.1)" 
          stroke-width="1"
        />
      {/each}
      
      <!-- Market chart lines with reduced animation complexity -->
      <path 
        class="chart-path chart-path-1" 
        d="M0,700 Q250,600 350,650 T500,500 T650,550 T800,400 T1000,450" 
        fill="none" 
        stroke="rgba(173, 216, 230, 0.3)" 
        stroke-width="3"
      />
      
      <path 
        class="chart-path chart-path-2" 
        d="M0,800 Q200,750 300,800 T450,600 T600,650 T750,500 T1000,550" 
        fill="none" 
        stroke="rgba(135, 206, 250, 0.3)" 
        stroke-width="3"
      />
      
      <!-- Candle chart elements - reduced for performance -->
      {#each Array(5) as _, i}
        <rect 
          class="candle" 
          x={i * 200 + 20} 
          y={300 + Math.sin(i * 0.5) * 100} 
          width="12" 
          height={80 + Math.cos(i * 0.7) * 40} 
          fill={i % 2 === 0 ? "rgba(0, 255, 0, 0.15)" : "rgba(255, 0, 0, 0.15)"} 
        />
      {/each}
    </svg>
    
    <!-- Floating data points - reduced for performance -->
    <div class="absolute inset-0">
      <!-- Data nodes -->
      {#each Array(8) as _, i}
        <div 
          class="absolute h-2 w-2 rounded-full bg-blue-400/20 data-node"
          style="top: {10 + (i * 10)}%; 
                left: {15 + (i * 10)}%; 
                animation: data-pulse 4s ease-in-out infinite; 
                animation-delay: {i * 0.5}s;"
        ></div>
      {/each}
    </div>
    
    <!-- Combined CRT effects for better performance -->
    <div class="crt-effects"></div>
  </div>
  
  <div class="container max-w-7xl mx-auto px-3 md:px-8 flex flex-col md:flex-row items-center justify-between gap-12 md:gap-8">
    <!-- Text content with enhanced design -->
    <div class="flex-1 text-left mb-10 md:mb-0 z-10 transform translate-y-12 opacity-0 transition-all duration-700 ease-out {animationClass}">
      <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm text-blue-300 text-xs md:text-sm font-medium mb-4 w-fit border border-blue-500/20 mx-auto md:mx-0">
        <Globe size={14} class="text-blue-300" />
        <span>Global Market Predictions</span>
      </div>
      
      <h2 class="text-2xl md:text-3xl lg:text-5xl font-bold mb-4 md:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-[#ADD8E6] to-[#87CEEB] leading-tight">
        Decentralized <br class="hidden md:block" />Prediction Markets
      </h2>
      
      <p class="text-base md:text-lg lg:text-xl text-gray-300 mb-6 md:mb-8 max-w-lg">
        Forecast future events and earn rewards with Kong's decentralized prediction markets.
        Trade outcomes with confidence on a secure, transparent platform.
      </p>
      
      <!-- Stats cards with improved styling for mobile -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-6 md:mb-8">
        {#if isLoadingStats}
          <!-- Loading skeletons -->
          {#each Array(3) as _}
            <div class="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-white/10">
              <div class="flex items-center">
                <div class="animate-pulse bg-gray-700/50 h-8 w-8 rounded-md sm:rounded-lg mr-2 sm:mr-3"></div>
                <div class="flex-1 min-w-0">
                  <div class="animate-pulse bg-gray-600/50 h-5 w-12 rounded-md mb-1"></div>
                  <div class="animate-pulse bg-gray-500/50 h-3 w-20 rounded-md"></div>
                </div>
              </div>
            </div>
          {/each}
        {:else if errorLoadingStats}
          <!-- Error display -->
          <div class="col-span-2 sm:col-span-3 text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-500/30">
            {errorLoadingStats}
          </div>
        {:else}
          <!-- Use StatCard component -->
          <StatCard 
            icon={BarChart3}
            value={$tweenedMarkets.toFixed(0)}
            label="Total Markets"
            iconBgClass="bg-blue-500/20"
            iconColorClass="text-blue-300"
            gradientClass="bg-[linear-gradient(90deg,#ADD8E6,#87CEEB)]"
          />

          <StatCard 
            icon={TrendingUp}
            value={$tweenedActiveMarkets.toFixed(0)}
            label="Active Markets"
            iconBgClass="bg-cyan-500/20"
            iconColorClass="text-cyan-300"
            gradientClass="bg-[linear-gradient(90deg,#ADD8E6,#87CEEB)]"
          />

          <div class="col-span-2 sm:col-span-1">
            <StatCard 
              icon={Zap}
              value={$tweenedTotalBets.toFixed(0)}
              label="Total Predictions"
              iconBgClass="bg-teal-500/20"
              iconColorClass="text-teal-300"
              gradientClass="bg-[linear-gradient(90deg,#ADD8E6,#87CEEB)]"
            />
          </div>
        {/if}
      </div>
      
      <!-- Use FeatureList component -->
      <FeatureList 
        {features} 
        defaultIconBgGradientClass="from-blue-600 to-cyan-600"
      />
    </div>

    <!-- iPhone with screenshot - Optimized for mobile -->
    <div class="flex-1 flex justify-center items-center relative z-10 order-2 md:order-1 transform translate-y-12 opacity-0 transition-all duration-1000 delay-300 ease-out {animationClass}">
      <!-- Use the IphoneFrame component -->
      <IphoneFrame 
        screenshotSrc="/images/pmscreen.jpg"
        gradientOverlay="from-blue-500/10 to-cyan-500/10"
        reflectionColor="from-blue-500/20"
      />
    </div>
  </div>
  
  <!-- Enhanced background effects with gradient that matches hero section -->
  <!-- Optimized geometric prediction market pattern - CSS-based where possible instead of heavy SVG -->
  <div class="absolute inset-0 z-0 opacity-20 pointer-events-none">
    <!-- Simplified probability curves and contour lines -->
    <svg class="absolute inset-0 w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
      <!-- Probability curve patterns - reduced count -->
      <path 
        class="probability-curve" 
        d="M0,800 C250,800 250,200 500,200 S750,800 1000,800" 
        fill="none" 
        stroke="rgba(0, 164, 255, 0.3)" 
        stroke-width="2"
        stroke-dasharray="6,3"
      />
      <path 
        class="probability-curve" 
        d="M0,600 C250,600 250,400 500,400 S750,600 1000,600" 
        fill="none" 
        stroke="rgba(0, 164, 255, 0.3)" 
        stroke-width="2"
        stroke-dasharray="6,3"
      />
      
      <!-- Topographic contour lines - reduced count -->
      {#each Array(4) as _, i}
        <path 
          class="contour-line"
          d="M0,{100 + i * 200} Q{250 + Math.sin(i) * 50},{150 + i * 200} {500 + Math.cos(i) * 30},{100 + i * 200} T1000,{150 + i * 200}"
          fill="none" 
          stroke="rgba(135, 206, 235, 0.15)" 
          stroke-width="1"
          stroke-dasharray="1,2"
        />
      {/each}
      
      <!-- Graph nodes - reduced count -->
      {#each Array(8) as _, i}
        <circle 
          class="graph-node"
          cx={100 + (i * 120) % 900} 
          cy={100 + Math.floor((i * 120) / 900) * 250} 
          r="4"
          fill="rgba(173, 216, 230, 0.3)"
        />
      {/each}
      
      <!-- Binary outcome indicators - reduced count -->
      {#each Array(3) as _, i}
        <g class="binary-outcome">
          <circle 
            cx={200 + (i * 300) % 700} 
            cy={300 + Math.floor((i * 300) / 700) * 200} 
            r="15"
            fill={i % 2 === 0 ? "rgba(0, 200, 83, 0.15)" : "rgba(255, 75, 75, 0.15)"}
          />
          <text 
            x={200 + (i * 300) % 700} 
            y={300 + Math.floor((i * 300) / 700) * 200 + 5} 
            text-anchor="middle" 
            font-size="12" 
            fill={i % 2 === 0 ? "rgba(0, 200, 83, 0.6)" : "rgba(255, 75, 75, 0.6)"}
            font-family="monospace"
          >{i % 2 === 0 ? "YES" : "NO"}</text>
        </g>
      {/each}
      
      <!-- Market percentage bars - reduced count -->
      {#each Array(3) as _, i}
        <g class="percentage-bar">
          <rect 
            x={800 - (i * 50)} 
            y={400 + (i * 120)}
            width={90 - i * 30}
            height="20"
            fill="rgba(135, 206, 250, 0.3)"
            rx="2"
            ry="2"
          />
          <text 
            x={800 - (i * 50) + (90 - i * 30) / 2} 
            y={415 + (i * 120)} 
            text-anchor="middle" 
            font-size="8" 
            fill="rgba(255, 255, 255, 0.8)"
            font-family="monospace"
          >{50 - i * 15}%</text>
        </g>
      {/each}
    </svg>
  </div>
  
  <!-- Hexagonal grid pattern - CSS-based for better performance -->
  <div class="absolute inset-0 z-0 opacity-10 pointer-events-none hexagon-grid"></div>
  
  <!-- CSS-based floating percentage labels - reduced count -->
  <div class="absolute inset-0 z-0 opacity-60 pointer-events-none">
    {#each Array(4) as _, i}
      <div 
        class="absolute percentage-label"
        style="top: {15 + (i * 20)}%; left: {10 + (i * 20)}%;"
      >
        <span class="text-[8px] sm:text-[10px] text-blue-300/40 font-mono">{30 + Math.floor(Math.random() * 70)}%</span>
      </div>
    {/each}
  </div>
  
  <!-- CSS-based binary decision nodes - reduced count -->
  <div class="absolute inset-0 z-0 opacity-30 pointer-events-none">
    {#each Array(3) as _, i}
      <div 
        class="absolute w-3 h-3 sm:w-4 sm:h-4 rounded-sm decision-node"
        style="top: {30 + (i * 25)}%; right: {10 + (i * 20)}%; 
               border: 1px solid rgba(135, 206, 250, 0.3);"
      ></div>
    {/each}
  </div>
  
  <!-- Subtle gradient overlay -->
  <div class="absolute inset-0 bg-gradient-to-br from-[#0D111F] via-transparent to-[#1A237E]/10 opacity-80"></div>
</section> 

<style>
  /* Combined CRT effects for better performance */
  .crt-effects {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
    background: 
      linear-gradient(to bottom, transparent 50%, rgba(135, 206, 235, 0.1) 50%),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.1'/%3E%3C/svg%3E");
    background-size: 100% 4px, 150px;
    opacity: 0.15;
    animation: flicker 4s infinite;
  }
  
  @keyframes flicker {
    0%, 100% { opacity: 0.15; }
    97.5% { opacity: 0.15; }
    98% { opacity: 0.2; }
    98.5% { opacity: 0.15; }
  }
  
  /* Chart line animations - simplified and hardware accelerated */
  .chart-path {
    opacity: 0.2;
    animation: chart-fade 15s ease-in-out infinite;
    will-change: opacity;
  }
  
  .chart-path-1 {
    animation-delay: 0s;
  }
  
  .chart-path-2 {
    animation-delay: 7.5s;
  }
  
  @keyframes chart-fade {
    0%, 45%, 100% { opacity: 0.1; }
    15%, 30% { opacity: 0.3; }
  }
  
  /* Candle animation - simplified */
  .candle {
    opacity: 0.1;
    animation: candle-pulse 8s ease-in-out infinite;
    will-change: opacity;
  }
  
  @keyframes candle-pulse {
    0%, 100% { opacity: 0.1; }
    50% { opacity: 0.2; }
  }
  
  /* Data node animation - simplified */
  @keyframes data-pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 0.2;
    }
    50% {
      transform: scale(1.3);
      opacity: 0.4;
    }
  }
  
  /* Probability Curve animations - simplified */
  .probability-curve {
    opacity: 0.1;
    animation: curve-pulse 16s ease-in-out infinite;
    will-change: opacity;
  }
  
  .probability-curve:nth-child(2) {
    animation-delay: 8s;
  }
  
  @keyframes curve-pulse {
    0%, 100% { opacity: 0.1; }
    50% { opacity: 0.3; }
  }
  
  /* Contour line animations - simplified */
  .contour-line {
    opacity: 0.05;
    animation: contour-fade 20s ease-in-out infinite;
    will-change: opacity;
  }
  
  @keyframes contour-fade {
    0%, 100% { opacity: 0.05; }
    50% { opacity: 0.2; }
  }
  
  /* Graph node animations - simplified */
  .graph-node {
    animation: node-pulse 8s ease-in-out infinite;
    will-change: opacity;
  }
  
  @keyframes node-pulse {
    0%, 100% {
      opacity: 0.2;
      r: 3;
    }
    50% {
      opacity: 0.4;
      r: 4;
    }
  }
  
  /* Hexagonal grid background - CSS-based for better performance */
  .hexagon-grid {
    background-color: transparent;
    background-image: 
      linear-gradient(to right, rgba(173, 216, 230, 0.1) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(173, 216, 230, 0.1) 1px, transparent 1px);
    background-size: 40px 40px;
    will-change: background-position;
    animation: grid-shift 60s linear infinite;
  }
  
  @keyframes grid-shift {
    0% { background-position: 0 0; }
    100% { background-position: 40px 40px; }
  }
  
  /* Binary outcome animations - simplified */
  .binary-outcome {
    opacity: 0.5;
    animation: outcome-pulse 16s ease-in-out infinite;
    will-change: opacity;
  }
  
  @keyframes outcome-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.8; }
  }
  
  /* Percentage bar animation - simplified */
  .percentage-bar {
    opacity: 0.5;
    animation: bar-grow 10s ease-in-out infinite;
    will-change: opacity;
  }
  
  @keyframes bar-grow {
    0%, 100% { transform: scaleX(1); opacity: 0.5; }
    50% { transform: scaleX(1.1); opacity: 0.7; }
  }
  
  /* Floating percentage labels - simplified */
  .percentage-label {
    animation: float-label 20s ease-in-out infinite;
    will-change: transform, opacity;
  }
  
  @keyframes float-label {
    0%, 100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    50% {
      transform: translateY(-10px);
      opacity: 0.6;
    }
  }
  
  /* Decision node animation - simplified */
  .decision-node {
    animation: node-blink 16s ease-in-out infinite;
    will-change: background-color;
  }
  
  @keyframes node-blink {
    0%, 100% { background-color: rgba(135, 206, 250, 0); }
    50% { background-color: rgba(135, 206, 250, 0.3); }
  }
</style> 