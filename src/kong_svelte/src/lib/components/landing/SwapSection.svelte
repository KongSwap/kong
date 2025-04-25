<script lang="ts">
  import { onMount, getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { DollarSign, BarChart3, RefreshCw, Zap } from "lucide-svelte";
  import {
    FORMAT_NUMBER_KEY,
    FORMAT_COUNT_KEY,
    // Import new tweened keys
    TWEENED_TVL_KEY,
    TWEENED_VOLUME_KEY,
    TWEENED_SWAPS_KEY
  } from "$lib/constants/contextKeys"; // Import shared keys
  
  // Import the new components
  import StatCard from './StatCard.svelte';
  import IphoneFrame from './IphoneFrame.svelte';
  import FeatureList from './FeatureList.svelte';
  
  // === Define Context Keys (Match LandingWrapper) ===
  type FormatNumberFn = (num: number, precision?: number) => string;
  type FormatCountFn = (num: number) => string;
  
  // === Get Context ===
  // Get individual tweened stores using their specific keys
  const tweenedTVL = getContext<Writable<number>>(TWEENED_TVL_KEY);
  const tweenedVolume = getContext<Writable<number>>(TWEENED_VOLUME_KEY);
  const tweenedSwapCount = getContext<Writable<number>>(TWEENED_SWAPS_KEY); // Use specific key
  // Get formatters
  const formatNumber = getContext<FormatNumberFn>(FORMAT_NUMBER_KEY);
  const formatCount = getContext<FormatCountFn>(FORMAT_COUNT_KEY);
  
  // === Props (Only non-shared props) ===
  let { 
    isVisible = false,
  } = $props<{ 
    isVisible?: boolean;
  }>();
  
  // Feature bullets data
  const features = [
    {
      title: "Intelligent Routing",
      description: "Swap any token with any other token! Kong's intelligent routing gives you the best rates across the entire market."
    },
    {
      title: "Multi-Chain",
      description: "KONG is the most advanced DeFi meta-protocol in the world! Swap any token with any other token across multiple chains!"
    },
    {
      title: `DAO Governed`,
      description: "KONG is fully on-chain. Protocol updates are voted on and deployed by the DAO, ensuring the highest level of transparency and security."
    }
  ];
  
  // Animation state using $state
  let animationClass = $state('');
  let hasTriggeredAnimation = $state(false);
  
  // Watch for visibility changes using $effect
  $effect(() => {
    if (isVisible && !hasTriggeredAnimation) {
      triggerAnimation();
    }
  });
  
  function triggerAnimation() {
    hasTriggeredAnimation = true;
    requestAnimationFrame(() => {
      animationClass = 'translate-y-0 opacity-100';
    });
  }
  
  // Lightning variables using $state
  let lightningActive = $state(false);
  let lightningInterval = $state<ReturnType<typeof setInterval> | undefined>(undefined);
  let lightningCount = $state(0);
  let sectionRef = $state<HTMLElement | undefined>(undefined);
  let hasTriggeredInitialLightning = $state(false);
  
  // Check for small screens using $state
  let isSmallScreen = $state(false);
  
  // Function to trigger a lightning strike (modifies $state)
  function triggerLightning(delay = 0) {
    setTimeout(() => {
      lightningActive = true;
      lightningCount++;
      
      setTimeout(() => {
        lightningActive = false;
      }, 200 + Math.random() * 300);
    }, delay);
  }
  
  // Resize handler for responsive adjustments (modifies $state)
  function handleResize() {
    isSmallScreen = window.innerWidth < 640;
  }
  
  // Add animation class after component mounts for entrance effect
  onMount(() => {
    // Check screen size initially
    if (typeof window !== 'undefined') {
      isSmallScreen = window.innerWidth < 640;
      window.addEventListener('resize', handleResize);
    }
    
    // Setup random ongoing lightning flashes (modifies $state)
    const intervalId = setInterval(() => {
      if (Math.random() > 0.7) {
        triggerLightning();
      }
    }, 3000 + Math.random() * 5000);
    lightningInterval = intervalId;
    
    return () => {
      if (intervalId) clearInterval(intervalId);
      lightningInterval = undefined; // Clear state on cleanup
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  });
  
  // Effect to trigger initial lightning strikes based on visibility
  $effect(() => {
    if (isVisible && !hasTriggeredInitialLightning) {
      hasTriggeredInitialLightning = true;
      
      // First strike after a short delay
      triggerLightning(200);
      
      // A second strike shortly after
      triggerLightning(800);
      
      // Maybe a third one for dramatic effect
      if (Math.random() > 0.5) {
        triggerLightning(1400);
      }
    }
  });
</script>

<section 
  id="swap" 
  bind:this={sectionRef}
  class="min-h-screen w-full flex items-center justify-center py-16 md:pb-24 md:pt-0 sm:pb-16 px-2 sm:px-4 bg-[#0D111F] relative overflow-hidden"
>
  <!-- Add connecting elements coming from top of section -->
  <div class="absolute top-0 left-0 right-0 h-20 sm:h-32 overflow-hidden pointer-events-none z-10">
    {#each Array(isSmallScreen ? 6 : 12) as _, i}
      <div class="absolute h-1 w-1 rounded-full bg-[#00A4FF]/40" 
           style="top: {i * 2.5}%; left: {5 + (i * 8)}%; animation: connect-float-down {3 + Math.random() * 3}s ease-in-out infinite; animation-delay: {Math.random() * 2}s;"></div>
    {/each}
    {#each Array(isSmallScreen ? 6 : 12) as _, i}
      <div class="absolute h-1 w-1 rounded-full bg-purple-400/40" 
           style="top: {i * 2.5}%; right: {5 + (i * 8)}%; animation: connect-float-down {3 + Math.random() * 3}s ease-in-out infinite; animation-delay: {Math.random() * 2}s;"></div>
    {/each}
    
    <!-- Digital circuit lines connecting sections -->
    <svg class="absolute top-0 left-0 w-full h-20 sm:h-32 opacity-30" viewBox="0 0 1000 128" preserveAspectRatio="none">
      <!-- Left side circuit lines -->
      <path d="M0,0 C100,40 150,80 250,100 S400,110 500,64" fill="none" stroke="#00A4FF" stroke-width="1" stroke-dasharray="4,4" />
      <path d="M150,0 C200,50 250,70 350,90 S450,100 550,70" fill="none" stroke="#9E7CF4" stroke-width="1" stroke-dasharray="4,4" />
      <path d="M300,0 C350,30 400,40 450,60 S500,80 600,75" fill="none" stroke="#00A4FF" stroke-width="1" stroke-dasharray="4,4" />
      
      <!-- Right side circuit lines -->
      <path d="M1000,0 C900,40 850,80 750,100 S600,110 500,64" fill="none" stroke="#00A4FF" stroke-width="1" stroke-dasharray="4,4" />
      <path d="M850,0 C800,50 750,70 650,90 S550,100 450,70" fill="none" stroke="#9E7CF4" stroke-width="1" stroke-dasharray="4,4" />
      <path d="M700,0 C650,30 600,40 550,60 S500,80 400,75" fill="none" stroke="#00A4FF" stroke-width="1" stroke-dasharray="4,4" />
      
      <!-- Circuit nodes -->
      {#each Array(isSmallScreen ? 4 : 8) as _, i}
        <circle cx={100 + i * 120} cy={40 + Math.sin(i) * 30} r="2" fill="#00A4FF" />
      {/each}
      
      {#each Array(isSmallScreen ? 3 : 7) as _, i}
        <circle cx={160 + i * 120} cy={60 + Math.cos(i) * 20} r="2" fill="#9E7CF4" />
      {/each}
    </svg>
    
    <!-- Section transition gradient from hero with improved blending -->
    <div class="absolute top-0 left-0 right-0 h-20 sm:h-40 bg-gradient-to-b from-[#0A1020] via-[#0A1020]/80 to-transparent"></div>
  </div>
  
  <!-- Animated background grid - fewer cells on mobile -->
  <div class="absolute inset-0 grid grid-cols-[repeat(10,1fr)] sm:grid-cols-[repeat(20,1fr)] grid-rows-[repeat(10,1fr)] sm:grid-rows-[repeat(20,1fr)] opacity-10">
    {#each Array(isSmallScreen ? 100 : 400) as _, i}
      <div class="border-[0.5px] border-white/5"></div>
    {/each}
  </div>
  
  <!-- Price ticker tape animation - hidden on very small screens -->
  <div class="ticker-tape-container hidden xs:block">
    <div class="ticker-tape">
      <!-- First set of ticker items -->
      <span class="ticker-item green">BTC <span class="ticker-price">+2.4%</span></span>
      <span class="ticker-item red">ETH <span class="ticker-price">-0.8%</span></span>
      <span class="ticker-item green">ICP <span class="ticker-price">+5.2%</span></span>
      <span class="ticker-item green">SNS1 <span class="ticker-price">+1.7%</span></span>
      <span class="ticker-item red">KING <span class="ticker-price">-0.3%</span></span>
      <span class="ticker-item green">CKBTC <span class="ticker-price">+0.5%</span></span>
      <span class="ticker-item green">CHAT <span class="ticker-price">+12.1%</span></span>
      <span class="ticker-item red">MOD <span class="ticker-price">-2.1%</span></span>
      <span class="ticker-item green">BOOM <span class="ticker-price">+8.3%</span></span>
      <!-- Second set of the same items to create seamless loop -->
      <span class="ticker-item green">BTC <span class="ticker-price">+2.4%</span></span>
      <span class="ticker-item red">ETH <span class="ticker-price">-0.8%</span></span>
      <span class="ticker-item green">ICP <span class="ticker-price">+5.2%</span></span>
      <span class="ticker-item green">SNS1 <span class="ticker-price">+1.7%</span></span>
      <span class="ticker-item red">KING <span class="ticker-price">-0.3%</span></span>
      <span class="ticker-item green">CKBTC <span class="ticker-price">+0.5%</span></span>
      <span class="ticker-item green">CHAT <span class="ticker-price">+12.1%</span></span>
      <span class="ticker-item red">MOD <span class="ticker-price">-2.1%</span></span>
      <span class="ticker-item green">BOOM <span class="ticker-price">+8.3%</span></span>
    </div>
  </div>
  
  <!-- Add candlestick chart animation here with higher visibility - simplified on mobile -->
  <div class="absolute inset-0 overflow-hidden pointer-events-none">
    <svg class="absolute bottom-0 left-0 w-full h-[40%] sm:h-[50%] opacity-20 sm:opacity-30" viewBox="0 0 1000 400" preserveAspectRatio="none">
      <!-- Price Line -->
      <path 
        class="candlestick-price-line" 
        d="M0,200 Q100,180 200,220 T400,180 T600,250 T800,150 T1000,170" 
        fill="none" 
        stroke="rgba(147, 112, 219, 0.8)" 
        stroke-width="2"
      />
      
      <!-- Candle chart elements - fewer on mobile -->
      {#each Array(isSmallScreen ? 10 : 20) as _, i}
        <rect 
          class="candlestick-candle" 
          x={i * (isSmallScreen ? 100 : 50) + 5} 
          y={150 + Math.sin(i * 0.7) * 70} 
          width={isSmallScreen ? 20 : 12} 
          height={60 + Math.cos(i * 0.9) * 30} 
          fill={Math.random() > 0.5 ? "rgba(124, 58, 237, 0.6)" : "rgba(220, 38, 38, 0.6)"} 
        />
        <line 
          class="candlestick-wick"
          x1={i * (isSmallScreen ? 100 : 50) + (isSmallScreen ? 15 : 11)} 
          y1={120 + Math.sin(i * 0.7) * 60} 
          x2={i * (isSmallScreen ? 100 : 50) + (isSmallScreen ? 15 : 11)} 
          y2={230 + Math.cos(i * 0.9) * 40} 
          stroke={Math.random() > 0.5 ? "rgba(124, 58, 237, 0.7)" : "rgba(220, 38, 38, 0.7)"}
          stroke-width="1"
        />
      {/each}
    </svg>
  </div>
  
  <!-- Lightning effects -->
  {#if lightningActive}
    <div class="lightning-flash absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-400/5 to-transparent z-0"></div>
    
    <!-- Lightning bolts - different positions for each lightning event -->
    <svg class="absolute top-0 left-{10 + (lightningCount % 5) * 20}% h-[30vh] w-[15vw] z-0 lightning-bolt" viewBox="0 0 100 200" preserveAspectRatio="none">
      <path class="lightning-path" d="M50,0 L30,60 L55,60 L20,140 L30,90 L10,90 L50,0" />
    </svg>
    
    <svg class="absolute top-[20vh] right-{15 + ((lightningCount + 2) % 4) * 15}% h-[45vh] w-[10vw] z-0 lightning-bolt" viewBox="0 0 100 200" preserveAspectRatio="none">
      <path class="lightning-path" d="M60,0 L40,80 L70,80 L30,200" />
    </svg>
  {/if}
  
  <!-- CRT Effects -->
  <div class="crt-scanlines absolute inset-0 z-1 pointer-events-none"></div>
  <div class="crt-noise absolute inset-0 z-1 pointer-events-none"></div>
  <div class="crt-flicker absolute inset-0 z-1 pointer-events-none"></div>
  
  <div class="container max-w-7xl mx-auto px-3 md:px-8 flex flex-col md:flex-row items-center justify-between gap-12 md:gap-8">
    <!-- iPhone with screenshot (on left for swap section) -->
    <div class="flex-1 flex justify-center items-center relative z-10 order-2 md:order-1 transform translate-y-12 opacity-0 transition-all duration-1000 ease-out {animationClass}">
      <!-- Use the IphoneFrame component -->
      <IphoneFrame 
        screenshotSrc="/images/swapscreen.jpg" 
        gradientOverlay="from-purple-500/10 to-indigo-500/10"
        reflectionColor="from-purple-500/20"
      />
    </div>

    <!-- Text content with enhanced design -->
    <div class="flex-1 text-left mb-10 md:mb-0 z-10 order-1 md:order-2 transform translate-y-12 opacity-0 transition-all duration-1000 delay-300 ease-out {animationClass}">
      <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 backdrop-blur-sm text-purple-300 text-xs md:text-sm font-medium mb-4 w-fit border border-purple-500/30 mx-auto md:mx-0">
        <Zap size={14} class="text-purple-300" />
        <span>Powered by Kong Protocol</span>
      </div>
      
      <h2 class="text-2xl md:text-3xl lg:text-5xl font-bold mb-4 md:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-[#7B68EE] to-[#9370DB] leading-tight">
        Lightning-Fast <br class="hidden md:block" />Token Swaps
      </h2>
      
      <p class="text-base md:text-lg lg:text-xl text-gray-300 mb-6 md:mb-8 max-w-lg">
        Trade tokens with exceptional speed and minimal slippage. Kong's intelligent routing gives you the best rates across the entire market.
      </p>
      
      <!-- Swap stats cards using StatCard component -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-6 md:mb-8">
        <StatCard
          icon={DollarSign}
          value={formatNumber($tweenedTVL)}
          label="TVL"
          iconBgClass="bg-indigo-500/20"
          iconColorClass="text-indigo-300"
          gradientClass="bg-[linear-gradient(90deg,#7B68EE,#9370DB)]"
        />
        
        <StatCard
          icon={BarChart3}
          value={formatNumber($tweenedVolume, 0)}
          label="24h Volume"
          iconBgClass="bg-purple-500/20"
          iconColorClass="text-purple-300"
          gradientClass="bg-[linear-gradient(90deg,#7B68EE,#9370DB)]"
        />
        
        <div class="col-span-2 sm:col-span-1"> 
          <StatCard
            icon={RefreshCw}
            value={formatCount($tweenedSwapCount)}
            label="Total Swaps"
            iconBgClass="bg-blue-500/20"
            iconColorClass="text-blue-300"
            gradientClass="bg-[linear-gradient(90deg,#7B68EE,#9370DB)]"
          />
        </div>
      </div>
      
      <!-- Use FeatureList component -->
      <FeatureList 
        {features} 
        defaultIconBgGradientClass="from-indigo-600 to-purple-600"
      />
    </div>
  </div>
  
  <!-- Enhanced background effects with gradient that matches hero section -->
  <div class="absolute top-1/4 -right-24 w-64 sm:w-96 h-64 sm:h-96 bg-purple-500 rounded-full filter blur-[100px] sm:blur-[150px] opacity-20 animate-pulse"></div>
  <div class="absolute bottom-1/4 -left-24 w-64 sm:w-96 h-64 sm:h-96 bg-indigo-500 rounded-full filter blur-[100px] sm:blur-[150px] opacity-20 animate-pulse animation-delay-1000"></div>
  
  <!-- Add more distinctive swap-specific elements -->
  <div class="absolute top-1/3 left-1/3 w-32 h-32 rounded-full border border-purple-300/20 animate-[spin_30s_linear_infinite]"></div>
  <div class="absolute bottom-1/3 right-1/3 w-48 h-48 rounded-full border border-indigo-400/15 animate-[spin_20s_linear_infinite_reverse]"></div>
  
  <!-- Lightning paths in background -->
  <svg class="absolute inset-0 w-full h-full opacity-10 pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="none">
    <path 
      class="lightning-path-bg" 
      d="M300,0 L270,300 L350,320 L200,1000" 
      stroke="rgba(147, 112, 219, 0.3)" 
      stroke-width="2" 
      fill="none"
    />
    <path 
      class="lightning-path-bg" 
      d="M700,0 L730,400 L650,420 L800,1000" 
      stroke="rgba(147, 112, 219, 0.3)" 
      stroke-width="2" 
      fill="none"
    />
  </svg>
  
  <!-- Additional color gradient to match hero -->
  <div class="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-[#0A1020]/50 to-transparent"></div>
  
  <!-- Floating particles - fewer on mobile -->
  {#each Array(isSmallScreen ? 8 : 15) as _, i}
    <div class="absolute h-1 w-1 rounded-full bg-purple-400/40" 
         style="top: {Math.random() * 100}%; left: {Math.random() * 100}%; animation: float {5 + Math.random() * 10}s ease-in-out infinite; animation-delay: {Math.random() * 5}s;"></div>
  {/each}
</section>

<style>
  /* Animation for floating particles */
  @keyframes float {
    0% { transform: translateY(0) translateX(0); opacity: 0; }
    50% { opacity: 0.5; }
    100% { transform: translateY(-100px) translateX(20px); opacity: 0; }
  }
  
  /* Animation delay utility */
  .animation-delay-1000 {
    animation-delay: 1000ms;
  }
  
  /* CRT text effect styling from HeroSection for consistency */
  .panel-value {
    font-weight: 700;
    background: linear-gradient(90deg, #7B68EE, #9370DB);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    text-shadow: 0 0 5px rgba(123, 104, 238, 0.3);
    transition: text-shadow 0.3s ease;
  }
  
  .crt-value {
    background: linear-gradient(90deg, #7B68EE, #9370DB);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    position: relative;
    text-shadow: 
      0 0 2px rgba(255, 255, 255, 0.7),
      0 0 5px rgba(123, 104, 238, 0.5),
      0 0 8px rgba(123, 104, 238, 0.3);
    font-family: "BlenderPro", "Rajdhani", monospace;
    letter-spacing: 1px;
    animation: crt-value-flicker 8s infinite;
    font-weight: 700;
    line-height: 1.1;
    display: block;
  }
  
  @keyframes crt-value-flicker {
    0%, 98%, 100% {
      text-shadow: 
        0 0 2px rgba(255, 255, 255, 0.7),
        0 0 5px rgba(123, 104, 238, 0.5),
        0 0 8px rgba(123, 104, 238, 0.3);
    }
    98.5% {
      text-shadow: 
        0 0 2px rgba(255, 255, 255, 0.7),
        0 0 5px rgba(123, 104, 238, 0.7),
        0 0 10px rgba(123, 104, 238, 0.5);
    }
    99% {
      text-shadow: 
        0 0 2px rgba(255, 255, 255, 0.7),
        0 0 5px rgba(123, 104, 238, 0.5),
        0 0 8px rgba(123, 104, 238, 0.3);
    }
  }
  
  /* Lightning effects */
  .lightning-flash {
    opacity: 0;
    animation: flash 0.5s ease-out;
  }
  
  .lightning-bolt {
    opacity: 0;
    animation: lightning-appear 0.8s ease-out;
    filter: drop-shadow(0 0 10px rgba(147, 112, 219, 0.8));
  }
  
  .lightning-path {
    fill: none;
    stroke: #9370DB;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 200;
    stroke-dashoffset: 200;
    animation: lightning-draw 0.5s linear forwards;
  }
  
  @keyframes flash {
    0% { opacity: 0; }
    20% { opacity: 1; }
    50% { opacity: 0.6; }
    80% { opacity: 0.2; }
    100% { opacity: 0; }
  }
  
  @keyframes lightning-appear {
    0% { opacity: 0; }
    10% { opacity: 1; }
    30% { opacity: 0.7; }
    60% { opacity: 0.3; }
    100% { opacity: 0; }
  }
  
  @keyframes lightning-draw {
    to {
      stroke-dashoffset: 0;
    }
  }
  
  /* CRT scanlines effect */
  .crt-scanlines {
    background: linear-gradient(
      to bottom,
      transparent 50%,
      rgba(147, 112, 219, 0.1) 50%
    );
    background-size: 100% 4px;
    opacity: 0.15;
  }
  
  /* CRT noise effect */
  .crt-noise {
    position: relative;
  }
  
  .crt-noise::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.1'/%3E%3C/svg%3E");
    background-size: 150px;
    opacity: 0.08;
    animation: noise-animation 0.5s infinite;
  }
  
  @keyframes noise-animation {
    0% { opacity: 0.07; }
    50% { opacity: 0.08; }
    100% { opacity: 0.07; }
  }
  
  /* CRT screen flicker */
  .crt-flicker {
    opacity: 0;
    animation: screen-flicker 10s infinite;
  }
  
  @keyframes screen-flicker {
    0%, 100% { opacity: 0; }
    35% { opacity: 0; }
    35.5% { opacity: 0.02; }
    36% { opacity: 0; }
    85% { opacity: 0; }
    85.5% { opacity: 0.04; }
    86% { opacity: 0; }
    86.5% { opacity: 0.02; }
    87% { opacity: 0; }
  }
  
  /* Ticker tape animation */
  .ticker-tape-container {
    position: absolute;
    bottom: 10%;
    left: 0;
    right: 0;
    width: 100%;
    height: 30px;
    overflow: hidden;
    opacity: 0.3;
  }
  
  .ticker-tape {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    width: max-content;
    animation: tickerMove 30s linear infinite;
    will-change: transform;
  }
  
  @keyframes tickerMove {
    0% {
      transform: translate3d(0, 0, 0);
    }
    100% {
      transform: translate3d(-50%, 0, 0);
    }
  }
  
  .ticker-item {
    display: inline-flex;
    align-items: center;
    padding: 0 20px;
    font-family: "BlenderPro", "Rajdhani", monospace;
    font-weight: 600;
  }
  
  .ticker-price {
    margin-left: 6px;
  }
  
  .green {
    color: rgba(0, 255, 128, 0.8);
  }
  
  .red {
    color: rgba(255, 64, 64, 0.8);
  }
  
  /* Animation for connecting particles from previous section */
  @keyframes connect-float-down {
    0% { transform: translateY(-30px); opacity: 0; }
    50% { transform: translateY(30px); opacity: 0.7; }
    100% { transform: translateY(60px); opacity: 0; }
  }
  
  /* Circuit line animation */
  svg path {
    stroke-dasharray: 500;
    stroke-dashoffset: 500;
    animation: circuit-line-draw 10s linear infinite;
  }
  
  svg path:nth-child(2) {
    animation-delay: 0.5s;
  }
  
  svg path:nth-child(3) {
    animation-delay: 1s;
  }
  
  svg path:nth-child(4) {
    animation-delay: 1.5s;
  }
  
  svg path:nth-child(5) {
    animation-delay: 2s;
  }
  
  svg path:nth-child(6) {
    animation-delay: 2.5s;
  }
  
  svg circle {
    opacity: 0;
    animation: circuit-node-pulse 4s ease-in-out infinite;
  }
  
  @keyframes circuit-line-draw {
    0% {
      stroke-dashoffset: 500;
      opacity: 0;
    }
    20% {
      opacity: 0.7;
    }
    40%, 60% {
      opacity: 1;
    }
    80% {
      opacity: 0.7;
    }
    100% {
      stroke-dashoffset: -500;
      opacity: 0;
    }
  }
  
  @keyframes circuit-node-pulse {
    0%, 100% {
      opacity: 0;
      r: 1;
    }
    50% {
      opacity: 1;
      r: 2;
    }
  }
  
  /* Candlestick chart animations */
  .candlestick-price-line {
    stroke-dasharray: 1000;
    stroke-dashoffset: 1000;
    animation: candlestick-line-draw 15s linear infinite;
  }
  
  .candlestick-candle {
    animation: candlestick-pulse 4s ease-in-out infinite;
  }
  
  .candlestick-wick {
    animation: candlestick-pulse 4s ease-in-out infinite;
  }
  
  @keyframes candlestick-pulse {
    0%, 100% {
      opacity: 0.6;
    }
    50% {
      opacity: 0.9;
    }
  }
  
  @keyframes candlestick-line-draw {
    0% {
      stroke-dashoffset: 1000;
    }
    50% {
      stroke-dashoffset: 0;
    }
    100% {
      stroke-dashoffset: -1000;
    }
  }
  
  /* Add xs breakpoint for extra small screens */
  @media (min-width: 400px) {
    .xs\:block {
      display: block;
    }
    
    .xs\:w-\[260px\] {
      width: 260px;
    }
    
    .xs\:h-\[520px\] {
      height: 520px;
    }
  }
  
  /* Lightning background path animation */
  .lightning-path-bg {
    stroke-dasharray: 1500;
    stroke-dashoffset: 1500;
    animation: lightning-draw-bg 8s ease-in-out infinite;
    opacity: 0.1;
  }
  
  @keyframes lightning-draw-bg {
    0%, 100% {
      stroke-dashoffset: 1500;
      opacity: 0.1;
    }
    45%, 55% {
      stroke-dashoffset: 0;
      opacity: 0.3;
    }
    99% {
      stroke-dashoffset: -1500;
      opacity: 0.1;
    }
  }
</style> 