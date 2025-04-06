<script lang="ts">
  import { onMount } from 'svelte';
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { TrendingUp, Zap, Globe, BarChart3, LucideCheck } from "lucide-svelte";
  import { getPredictionMarketStats } from '$lib/api/predictionMarket';
  
  // Section visibility state
  export let isVisible = false;
  
  // Component state
  let mounted = false;
  
  // Stats for prediction markets - Initialize with loading state
  let totalMarkets: number | null = null;
  let activeMarkets: number | null = null;
  let totalBets: number | null = null;
  let isLoadingStats = true;
  let errorLoadingStats: string | null = null;
  
  // Tweened values for animations - only create when needed
  let tweenedMarkets = tweened(0, { duration: 1500, easing: cubicOut });
  let tweenedActiveMarkets = tweened(0, { duration: 1500, easing: cubicOut });
  let tweenedTotalBets = tweened(0, { duration: 1500, easing: cubicOut });
  
  // Animation classes
  let animationClass = '';
  let sectionRef;
  let hasTriggeredAnimation = false;
  
  // Watch for visibility changes
  $: if (isVisible && !hasTriggeredAnimation && mounted) {
    triggerAnimation();
  }
  
  function triggerAnimation() {
    hasTriggeredAnimation = true;
    requestAnimationFrame(() => {
      animationClass = 'translate-y-0 opacity-100';
    });
  }
  
  async function fetchStats() {
    if (!mounted) return; // Don't fetch if component is unmounted
    
    isLoadingStats = true;
    errorLoadingStats = null;
    try {
      const stats = await getPredictionMarketStats();
      if (!mounted) return; // Exit if unmounted during API call
      
      totalMarkets = Number(stats.total_markets);
      activeMarkets = Number(stats.total_active_markets);
      totalBets = Number(stats.total_bets);

      // Start tweened animations after fetching data
      tweenedMarkets.set(totalMarkets);
      tweenedActiveMarkets.set(activeMarkets);
      tweenedTotalBets.set(totalBets);

    } catch (error) {
      console.error("Error fetching prediction market stats:", error);
      errorLoadingStats = "Failed to load stats.";
      // Set default values on error
      totalMarkets = 50;
      activeMarkets = 10;
      totalBets = 2500;
      tweenedMarkets.set(totalMarkets);
      tweenedActiveMarkets.set(activeMarkets);
      tweenedTotalBets.set(totalBets);
    } finally {
      if (mounted) isLoadingStats = false;
    }
  }
  
  // Add animation class after component mounts for entrance effect
  onMount(() => {
    mounted = true;
    
    // Only fetch stats if component is visible
    if (isVisible) {
      fetchStats();
    }
    
    return () => {
      mounted = false;
    };
  });
  
  // Watch for visibility to fetch data when needed
  $: if (isVisible && mounted && !totalMarkets) {
    fetchStats();
  }
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
        <div class="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-white/10 hover:border-blue-500/30 transition-all">
          <div class="flex items-center">
            <div class="flex-shrink-0 mr-2 sm:mr-3 bg-blue-500/20 p-1.5 sm:p-2 rounded-md sm:rounded-lg">
              <BarChart3 size={14} class="text-blue-300" />
            </div>
            <div class="flex-1 min-w-0">
              {#if isLoadingStats}
                <div class="animate-pulse bg-gray-600/50 h-5 w-12 rounded-md mb-1"></div>
                <div class="animate-pulse bg-gray-500/50 h-3 w-20 rounded-md"></div>
              {:else if errorLoadingStats}
                <div class="text-red-400 text-xs">Error</div>
              {:else}
                <div class="bg-[linear-gradient(90deg,#ADD8E6,#87CEEB)] bg-clip-text text-transparent text-base sm:text-lg md:text-xl truncate font-['BlenderPro',_'Rajdhani',_monospace] tracking-wider font-bold leading-none sm:leading-tight">{$tweenedMarkets.toFixed(0)}</div>
                <div class="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Total Markets</div>
              {/if}
            </div>
          </div>
        </div>
        
        <div class="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-white/10 hover:border-blue-500/30 transition-all">
          <div class="flex items-center">
            <div class="flex-shrink-0 mr-2 sm:mr-3 bg-cyan-500/20 p-1.5 sm:p-2 rounded-md sm:rounded-lg">
              <TrendingUp size={14} class="text-cyan-300" />
            </div>
            <div class="flex-1 min-w-0">
              {#if isLoadingStats}
                <div class="animate-pulse bg-gray-600/50 h-5 w-10 rounded-md mb-1"></div>
                <div class="animate-pulse bg-gray-500/50 h-3 w-24 rounded-md"></div>
              {:else if errorLoadingStats}
                <div class="text-red-400 text-xs">Error</div>
              {:else}
                <div class="bg-[linear-gradient(90deg,#ADD8E6,#87CEEB)] bg-clip-text text-transparent text-base sm:text-lg md:text-xl truncate font-['BlenderPro',_'Rajdhani',_monospace] tracking-wider font-bold leading-none sm:leading-tight">{$tweenedActiveMarkets.toFixed(0)}</div>
                <div class="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Active Markets</div>
              {/if}
            </div>
          </div>
        </div>
        
        <div class="col-span-2 sm:col-span-1 bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-4 border border-white/10 hover:border-blue-500/30 transition-all">
          <div class="flex items-center">
            <div class="flex-shrink-0 mr-2 sm:mr-3 bg-teal-500/20 p-1.5 sm:p-2 rounded-md sm:rounded-lg">
              <Zap size={14} class="text-teal-300" />
            </div>
            <div class="flex-1 min-w-0">
              {#if isLoadingStats}
                <div class="animate-pulse bg-gray-600/50 h-5 w-14 rounded-md mb-1"></div>
                <div class="animate-pulse bg-gray-500/50 h-3 w-28 rounded-md"></div>
              {:else if errorLoadingStats}
                <div class="text-red-400 text-xs">Error</div>
              {:else}
                <div class="bg-[linear-gradient(90deg,#ADD8E6,#87CEEB)] bg-clip-text text-transparent text-base sm:text-lg md:text-xl truncate font-['BlenderPro',_'Rajdhani',_monospace] tracking-wider font-bold leading-none sm:leading-tight">{$tweenedTotalBets.toFixed(0)}</div>
                <div class="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Total Predictions</div>
              {/if}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Feature bullets with enhanced styling -->
      <div class="space-y-5 md:space-y-6">
        <div class="flex items-start">
          <div class="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center mr-3 mt-1">
            <LucideCheck size={10} class="text-white" />
          </div>
          <div>
            <h3 class="text-base md:text-lg font-semibold text-white mb-1">Zero Fees</h3>
            <p class="text-sm md:text-base text-gray-300">Trade without paying platform commissions</p>
          </div>
        </div>
        
        <div class="flex items-start">
          <div class="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center mr-3 mt-1">
            <LucideCheck size={10} class="text-white" />
          </div>
          <div>
            <h3 class="text-base md:text-lg font-semibold text-white mb-1">Real-time Resolution</h3>
            <p class="text-sm md:text-base text-gray-300">Markets settle instantly with verified data</p>
          </div>
        </div>
      </div>
    </div>

    <!-- iPhone with screenshot - Optimized for mobile -->
    <div class="flex-1 flex justify-center items-center relative z-10 transform translate-y-12 opacity-0 transition-all duration-700 delay-300 ease-out {animationClass}">
      <div class="relative w-[220px] sm:w-[260px] md:w-[320px] transition-all duration-300 hover:scale-[1.02]">
        <!-- iPhone frame with improved realism -->
        <div class="relative w-full h-[450px] sm:h-[520px] md:h-[650px] bg-gradient-to-b from-gray-700 to-gray-900 rounded-[35px] md:rounded-[40px] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[6px] border-gray-800">
          <!-- Volume buttons -->
          <div class="absolute -left-[2px] top-[80px] md:top-[100px] w-[2px] h-8 md:h-12 bg-gray-900 rounded-l-lg shadow-inner"></div>
          <div class="absolute -left-[2px] top-[120px] md:top-[150px] w-[2px] h-10 md:h-16 bg-gray-900 rounded-l-lg shadow-inner"></div>
          
          <!-- Power button -->
          <div class="absolute -right-[2px] top-[100px] md:top-[120px] w-[2px] h-10 md:h-14 bg-gray-900 rounded-r-lg shadow-inner"></div>
          
          <!-- Subtle inner shadow on frame -->
          <div class="absolute inset-3 rounded-[28px] md:rounded-[32px] shadow-inner opacity-30"></div>
          
          <!-- Notch with more detail -->
          <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/3 h-5 md:h-7 bg-gray-900 rounded-b-2xl overflow-hidden flex justify-center">
            <div class="w-1.5 md:w-2 h-1.5 md:h-2 bg-gray-700 rounded-full my-1 mx-0.5 md:mx-1"></div>
            <div class="w-4 md:w-6 h-1.5 md:h-2 bg-gray-700 rounded-full my-1 mx-0.5 md:mx-1"></div>
            <div class="w-1.5 md:w-2 h-1.5 md:h-2 bg-gray-700 rounded-full my-1 mx-0.5 md:mx-1"></div>
          </div>
          
          <!-- Screenshot with image preloading hint -->
          <div class="h-full w-full rounded-[28px] md:rounded-[32px] overflow-hidden relative">
            <div class="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-cyan-500/10 z-10 pointer-events-none"></div>
            <img src="/images/pmscreen.png" alt="Prediction Markets Screenshot" class="w-full h-full object-cover relative z-0" loading="lazy" />
          </div>
          
          <!-- Home indicator -->
          <div class="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-16 md:w-28 h-1 bg-gray-300 rounded-full"></div>
        </div>
        
        <!-- Device reflection - optimized -->
        <div class="absolute bottom-[-15px] md:bottom-[-20px] left-[10%] right-[10%] h-[15px] md:h-[20px] bg-gradient-to-b from-blue-500/20 to-transparent blur-sm rounded-[50%]"></div>
      </div>
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