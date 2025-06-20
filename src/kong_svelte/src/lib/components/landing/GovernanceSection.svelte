<script lang="ts">
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { fetchTokensByCanisterId } from "$lib/api/tokens/TokenApiClient";
  import { KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { Coins, Wallet, Clock, LucideCheck, Gavel } from "lucide-svelte";
  import TokenAnimation from "./TokenAnimation.svelte";
  import { browser } from "$app/environment";
  import { fly, fade } from "svelte/transition";
  import { expoOut } from "svelte/easing";

  // Import the StatCard component
  import StatCard from "./StatCard.svelte";
  // Import the FeatureList component
  import FeatureList from "./FeatureList.svelte";

  // Accept isVisible prop from parent
  export let isVisible = false;

  // --- Constants & Static Data ---
  const snsData = {
    status: "Launched",
    launchDate: "2024-11-01 16:45:00",
    swapTokenPrice: 0.00116335,
    totalSwapCommitment: 255936,
    icpTreasury: 210236.19630881,
    kongTreasury: 544958218.8396,
    tokenName: "KongSwap",
    tokenSymbol: "KONG",
    transactionFee: 0.0001,
    totalSupplyLaunch: 999999998,
  };

  const tokenDistribution = [
    { label: "Treasury", amount: 580000000, percentage: 58, color: "#00A4FF" },
    {
      label: "Developers",
      amount: 200000000,
      percentage: 20,
      color: "#9E7CF4",
    },
    {
      label: "Direct Participants",
      amount: 124737219,
      percentage: 12,
      color: "#FF00FF",
    },
    {
      label: "Community Fund",
      amount: 95262780,
      percentage: 10,
      color: "#05EC86",
    },
    { label: "Airdrop", amount: 0, percentage: 0, color: "#75CEF9" },
  ];

  // --- Component State ---
  let tokenChartContainer: HTMLDivElement;
  let glitchActive = false;
  let kongPrice = "0.00";
  let isLoadingPrice = true;
  let governanceVisible = false;
  let hasTriggeredAnimation = false;
  let observer: IntersectionObserver;
  let governanceSectionElement: HTMLElement;
  let chartCreated = false;
  let mounted = false;

  // React to visibility changes from parent
  $: if (isVisible && !hasTriggeredAnimation && mounted) {
    triggerAnimation();
  }

  function triggerAnimation() {
    hasTriggeredAnimation = true;
    // Use requestAnimationFrame for smoother transitions
    requestAnimationFrame(() => {
      governanceVisible = true;
    });
  }

  // --- Utility & Formatting Functions ---
  function formatNumber(num: number, maxDecimals: number = 2): string {
    if (isNaN(num)) return "0";

    const suffixes = [
      { value: 1e9, symbol: "B" },
      { value: 1e6, symbol: "M" },
      { value: 1e3, symbol: "K" },
      { value: 1, symbol: "" },
    ];

    const suffix = suffixes.find((s) => num >= s.value);
    if (!suffix) return "0";

    return (
      (num / suffix.value)
        .toFixed(maxDecimals)
        .replace(/\.0+$|(\.[0-9]*[1-9])0+$/, "$1") + suffix.symbol
    );
  }

  function formatCurrency(amount: number): string {
    if (isNaN(amount)) return "$0";
    return amount >= 1
      ? "$" + formatNumber(amount, 2)
      : "$" + amount.toFixed(4).replace(/\.?0+$/, "");
  }

  function formatPrice(price: string): string {
    const numPrice = parseFloat(price);
    return isNaN(numPrice) ? "$0.00" : formatCurrency(numPrice);
  }

  // --- API Fetching ---
  async function fetchKongPrice() {
    try {
      isLoadingPrice = true;
      const tokens = await fetchTokensByCanisterId([KONG_CANISTER_ID]);
      kongPrice =
        tokens.length > 0 ? tokens[0].metrics?.price || "0.00" : "0.00";
    } catch (error) {
      console.error("Failed to fetch KONG price:", error);
      kongPrice = "0.00";
    } finally {
      isLoadingPrice = false;
    }
  }

  // --- Feature Data ---
  const features = [
    {
      title: "Fully On-Chain",
      description:
        "The KONG DAO controls everything on-chain, frontend and backend! Protocol updates are voted on and deployed by the DAO.",
    },
    {
      title: "Governance Rights",
      description:
        "Stake KONG to vote on key protocol decisions and earn staking rewards.",
    },
    {
      title: "Treasury Management",
      description: `DAO-owned treasury of ~${formatNumber(snsData.icpTreasury)} ICP.`,
    },
  ];

  // --- D3 Chart Logic - Optimized for performance ---
  function createTokenDistributionChart() {
    if (
      !tokenChartContainer ||
      chartCreated ||
      !document.body.contains(tokenChartContainer)
    )
      return;
    chartCreated = true;

    d3.select(tokenChartContainer).select("svg").remove();
    const filteredTokenData = tokenDistribution.filter(
      (item) => item.percentage > 0,
    );

    const width = tokenChartContainer.clientWidth;
    const height = tokenChartContainer.clientHeight;
    const margin = 20;
    const radius = Math.min(width, height) / 2 - margin;

    const svg = d3
      .select(tokenChartContainer)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("overflow", "visible")
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    const pie = d3
      .pie<any>()
      .value((d) => d.percentage)
      .sort(null);

    const arcOuter = d3
      .arc()
      .innerRadius(radius * 0.6)
      .outerRadius(radius);
    const arcHover = d3
      .arc()
      .innerRadius(radius * 0.58)
      .outerRadius(radius * 1.03);
    const arcInner = d3
      .arc()
      .innerRadius(radius * 0.53)
      .outerRadius(radius * 0.56);

    // Only create defs once
    const defs = svg.append("defs");

    // Create gradients (one per color is still needed)
    filteredTokenData.forEach((d, i) => {
      const grad = defs
        .append("linearGradient")
        .attr("id", `grad-${i}`)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "100%");

      grad
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d.color)
        .attr("stop-opacity", 1);

      grad
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d3.rgb(d.color).darker(0.8))
        .attr("stop-opacity", 1);
    });

    // Create groups for elements
    const sliceGroup = svg.append("g").attr("class", "slice-group");
    const innerRingGroup = svg.append("g").attr("class", "inner-ring-group");

    // Draw the slices
    const slices = sliceGroup
      .selectAll("path")
      .data(pie(filteredTokenData))
      .enter()
      .append("path")
      .attr("d", arcOuter as any)
      .attr("fill", (d, i) => `url(#grad-${i})`)
      .attr("stroke", "#0A1020")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .style("filter", "drop-shadow(0 0 4px rgba(0,0,0,0.3))")
      .style("transform-origin", "center center");

    // Add inner ring
    innerRingGroup
      .selectAll("path")
      .data(pie(filteredTokenData))
      .enter()
      .append("path")
      .attr("d", arcInner as any)
      .attr("fill", "rgba(10, 16, 32, 0.7)")
      .attr("stroke", (d, i) => d.data.color)
      .attr("stroke-width", 1);

    // Add text elements for center display
    const centerText = svg
      .append("text")
      .attr("class", "center-text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("fill", "#FFFFFF")
      .attr("font-family", '"BlenderPro", "Rajdhani", sans-serif')
      .attr("font-weight", "bold")
      .attr("pointer-events", "none")
      .attr("font-size", radius > 100 ? "1rem" : "0.9rem")
      .text("INITIAL");

    const centerTextBottom = svg
      .append("text")
      .attr("class", "center-text-bottom")
      .attr("text-anchor", "middle")
      .attr("dy", "1em")
      .attr("fill", "#FFFFFF")
      .attr("font-family", '"BlenderPro", "Rajdhani", sans-serif')
      .attr("font-weight", "bold")
      .attr("pointer-events", "none")
      .attr("font-size", radius > 100 ? "1rem" : "0.9rem")
      .text("DISTRIBUTION");

    // Use event delegation for hover effects to reduce number of event listeners
    sliceGroup
      .on("mouseover", function (event) {
        const target = d3.select(event.target);
        // Only proceed if we've hovered over a slice path
        if (target.classed("slice-group") || !target.attr("d")) return;

        const dataIndex = target.datum() ? (target.datum() as any).index : null;
        if (dataIndex === null) return;

        const d = filteredTokenData[dataIndex];
        target.transition().duration(200).style("transform", "scale(1.05)");
        centerText.text(d.label).attr("fill", d.color);
        centerTextBottom.text(`${d.percentage}% (${formatNumber(d.amount)})`);
      })
      .on("mouseout", function (event) {
        const target = d3.select(event.target);
        if (target.classed("slice-group") || !target.attr("d")) return;

        target.transition().duration(200).style("transform", "scale(1)");
        centerText.text("INITIAL").attr("fill", "#FFFFFF");
        centerTextBottom.text("DISTRIBUTION");
      });

    // Simplify animation to just fade in
    sliceGroup
      .selectAll("path")
      .attr("opacity", 0)
      .transition()
      .duration(600)
      .attr("opacity", 1);

    innerRingGroup
      .selectAll("path")
      .attr("opacity", 0)
      .transition()
      .duration(600)
      .delay(300)
      .attr("opacity", 1);
  }

  // Debounce resize handler for better performance
  function debounce(fn: Function, ms: number) {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: any[]) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fn.apply(this, args);
      }, ms);
    };
  }

  const handleResize = debounce(() => {
    if (
      tokenChartContainer &&
      governanceVisible &&
      document.body.contains(tokenChartContainer)
    ) {
      chartCreated = false;
      createTokenDistributionChart();
    }
  }, 250);

  $: if (governanceVisible && tokenChartContainer && !chartCreated && mounted) {
    setTimeout(() => createTokenDistributionChart(), 300);
  }

  onMount(() => {
    mounted = true;

    // Reduce glitch effect frequency for performance
    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        // Only trigger glitch 30% of the time
        glitchActive = true;
        setTimeout(() => {
          glitchActive = false;
        }, 100);
      }
    }, 10000); // Reduced frequency (10s instead of 5s)

    fetchKongPrice();
    window.addEventListener("resize", handleResize);

    // Set visibility if parent already says we're visible on mount
    if (isVisible && !hasTriggeredAnimation) {
      setTimeout(() => triggerAnimation(), 100);
    }

    // Set up intersection observer with optimized options
    if (browser && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              governanceVisible = true;
              observer.disconnect(); // Immediately disconnect once triggered
            }
          });
        },
        {
          threshold: 0.15,
          rootMargin: "100px", // Pre-load when close to viewport
        },
      );

      if (governanceSectionElement) observer.observe(governanceSectionElement);
    } else {
      setTimeout(() => {
        governanceVisible = true;
      }, 500);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (observer) observer.disconnect();
      clearInterval(glitchInterval);
      mounted = false;
    };
  });
</script>

<section
  id="governance"
  bind:this={governanceSectionElement}
  class="min-h-screen py-16 md:pb-24 px-2 sm:px-4 md:pt-0 w-full flex items-center justify-center bg-[#0D111F] relative overflow-hidden"
>
  <!-- Animated background grid - reduced complexity -->
  <div
    class="absolute inset-0 grid grid-cols-[repeat(8,1fr)] md:grid-cols-[repeat(10,1fr)] grid-rows-[repeat(5,1fr)] md:grid-rows-[repeat(10,1fr)] opacity-10"
  >
    {#each Array(40) as _}
      <div class="border-[0.5px] border-white/5"></div>
    {/each}
  </div>

  <!-- Connection particles - reduced count -->
  <div
    class="absolute top-0 left-0 right-0 h-32 overflow-hidden pointer-events-none z-10"
  >
    {#each Array(2) as _, i}
      <div
        class="absolute h-1 w-1 rounded-full bg-[#00A4FF]/40"
        style="top: {i * 12}%; left: {15 +
          i *
            30}%; animation: connect-float-down 5s ease-in-out infinite; animation-delay: {i *
          1}s;"
      ></div>
    {/each}
    {#each Array(2) as _, i}
      <div
        class="absolute h-1 w-1 rounded-full bg-purple-400/40"
        style="top: {i * 12}%; right: {15 +
          i *
            30}%; animation: connect-float-down 5s ease-in-out infinite; animation-delay: {i *
          1}s;"
      ></div>
    {/each}
  </div>

  <!-- Bottom connection particles - reduced count -->
  <div
    class="absolute bottom-0 left-0 right-0 h-32 overflow-hidden pointer-events-none z-10"
  >
    {#each Array(2) as _, i}
      <div
        class="absolute h-1 w-1 rounded-full bg-[#00A4FF]/40"
        style="bottom: {i * 12}%; left: {15 +
          i *
            30}%; animation: connect-float 5s ease-in-out infinite; animation-delay: {i *
          1}s;"
      ></div>
    {/each}
    {#each Array(2) as _, i}
      <div
        class="absolute h-1 w-1 rounded-full bg-purple-400/40"
        style="bottom: {i * 12}%; right: {15 +
          i *
            30}%; animation: connect-float 5s ease-in-out infinite; animation-delay: {i *
          1}s;"
      ></div>
    {/each}
  </div>

  <!-- Token animation background - only load if visible and in browser -->
  {#if browser && isVisible}
    <TokenAnimation containerClass="z-[-1]" governanceVisible={isVisible} />
  {/if}

  <!-- CRT Effects - optimize with CSS variables instead of multiple divs -->
  <div class="crt-effects"></div>

  <!-- Main content container -->
  <div
    class="!max-w-7xl mx-auto px-3 md:px-8 flex flex-col md:flex-row items-center justify-between gap-12 md:gap-8"
  >
    <!-- Text content side -->
    {#if governanceVisible}
      <div
        class="flex-1 text-left mb-10 md:mb-0 z-10"
        in:fade={{ duration: 700 }}
      >
        <div
          class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm text-purple-300 text-xs md:text-sm font-medium mb-4 w-fit border border-purple-500/20 mx-auto md:mx-0"
          in:fly={{ y: 20, delay: 100, duration: 500, easing: expoOut }}
        >
          <Gavel size={14} class="text-purple-300" />
          <span>Decentralized Autonomous Organization</span>
        </div>

        <h2
          class="text-2xl md:text-3xl lg:text-5xl font-bold mb-4 md:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-[#9E7CF4] to-[#FF00FF] leading-tight"
          in:fly={{ y: 20, delay: 200, duration: 700, easing: expoOut }}
        >
          KONG <br class="hidden md:block" />GOVERNANCE
        </h2>

        <p
          class="text-base md:text-lg lg:text-xl text-gray-300 mb-6 md:mb-8 max-w-lg"
          in:fly={{ y: 20, delay: 300, duration: 700, easing: expoOut }}
        >
          KONG is the governance and utility token of the Kong Protocol,
          powering the entire ecosystem with staking rewards and governance
          rights.
        </p>

        <!-- Stats cards using StatCard component -->
        <div
          class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-6 md:mb-8"
          in:fly={{ y: 20, delay: 400, duration: 700, easing: expoOut }}
        >
          <div>
            <StatCard
              icon={Wallet}
              value={formatPrice(kongPrice)}
              label="Current Price"
              iconBgClass="bg-purple-500/20"
              iconColorClass="text-purple-300"
              gradientClass="bg-[linear-gradient(90deg,#9E7CF4,#FF00FF)]"
            />
          </div>

          <div>
            <StatCard
              icon={Coins}
              value="999M"
              label="Total Supply"
              iconBgClass="bg-pink-500/20"
              iconColorClass="text-pink-300"
              gradientClass="bg-[linear-gradient(90deg,#9E7CF4,#FF00FF)]"
            />
          </div>

          <div class="col-span-2 sm:col-span-1">
            <StatCard
              icon={Clock}
              value="14.5%"
              label="Staking APR"
              iconBgClass="bg-indigo-500/20"
              iconColorClass="text-indigo-300"
              gradientClass="bg-[linear-gradient(90deg,#9E7CF4,#FF00FF)]"
            />
          </div>
        </div>

        <!-- Feature bullets - Use FeatureList component -->
        <div class="mt-6 md:mt-8">
          <FeatureList
            {features}
            defaultIconBgGradientClass="from-purple-600 to-pink-600"
          />
        </div>
      </div>
    {/if}

    <!-- Chart visualization side - only load if visible -->
    {#if governanceVisible}
      <div
        class="w-full md:flex-1 flex justify-center items-center relative z-10"
        in:fade={{ delay: 300, duration: 700 }}
      >
        <div
          class="relative w-3/4 min-w-[320px] max-w-[320px] sm:max-w-[400px] md:max-w-[500px]"
        >
          <div
            class="relative rounded-xl overflow-hidden bg-white/5 border border-white/10 p-4 md:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-transform duration-700 ease-out"
            style="transform: {governanceVisible
              ? 'scale(1)'
              : 'scale(0.9)'}; opacity: {governanceVisible ? 1 : 0.8};"
          >
            <h3
              class="text-base md:text-lg font-bold mb-3 md:mb-4 text-center text-purple-300"
              in:fade={{ delay: 500, duration: 500 }}
            >
              Token Distribution
            </h3>

            <!-- D3 Chart container -->
            <div
              bind:this={tokenChartContainer}
              class="h-[250px] sm:h-[320px] md:h-[400px] w-full overflow-visible"
            ></div>

            <!-- Distribution legend - 2 columns -->
            <div
              class="grid grid-cols-2 gap-y-2 gap-x-3 md:gap-x-4 mt-3 md:mt-4"
              in:fade={{ delay: 700, duration: 700 }}
            >
              {#each tokenDistribution.filter((item) => item.percentage > 0) as item, i}
                <div
                  class="flex items-center opacity-0"
                  in:fade={{ delay: 800 + i * 100, duration: 500 }}
                  style="opacity: 1;"
                >
                  <div
                    class="w-2.5 md:w-3 h-2.5 md:h-3 rounded-full mr-1.5 md:mr-2 transition-transform duration-500 ease-out"
                    style="background-color: {item.color}; transform: {governanceVisible
                      ? 'scale(1)'
                      : 'scale(0)'}; transition-delay: {800 + i * 100}ms"
                  ></div>
                  <div
                    class="text-[10px] md:text-xs text-gray-300 whitespace-nowrap"
                  >
                    <span class="font-semibold">{item.label}</span>
                    ({item.percentage}%)
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Background effects - optimized version with fewer elements -->
  <div class="absolute inset-0 z-0 opacity-20 pointer-events-none">
    <!-- Blockchain pattern with reduced number of elements -->
    <svg
      class="absolute inset-0 w-full h-full"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
    >
      <!-- Connected block pattern - reduced count -->
      {#each Array(3) as _, i}
        <g class="blockchain-node" style="animation-delay: {i * 0.3}s">
          <rect
            x={100 + ((i * 250) % 800)}
            y={150 + Math.floor((i * 250) / 800) * 200}
            width="70"
            height="40"
            rx="3"
            fill="rgba(158, 124, 244, 0.1)"
            stroke="rgba(158, 124, 244, 0.3)"
            stroke-width="1"
          />
          <line
            x1={170 + ((i * 250) % 800)}
            y1={170 + Math.floor((i * 250) / 800) * 200}
            x2={220 + ((i * 250) % 800)}
            y2={170 + Math.floor((i * 250) / 800) * 200}
            stroke="rgba(158, 124, 244, 0.3)"
            stroke-width="1"
            stroke-dasharray="5,5"
          />
        </g>
      {/each}

      <!-- Price chart lines - simplified -->
      <path
        class="price-line"
        d="M0,800 Q200,750 300,650 T500,700 T700,600 T1000,550"
        fill="none"
        stroke="rgba(255, 0, 255, 0.2)"
        stroke-width="2"
        stroke-dasharray="1,2"
      />

      <!-- Market volume bars - reduced count -->
      {#each Array(4) as _, i}
        <rect
          class="volume-bar"
          x={50 + i * 240}
          y={850 - (30 + Math.sin(i * 0.7) * 30)}
          width="20"
          height={30 + Math.sin(i * 0.7) * 30}
          fill="rgba(158, 124, 244, 0.1)"
        />
      {/each}

      <!-- Financial indicators - reduced count -->
      {#each Array(2) as _, i}
        <g class="financial-indicator" style="animation-delay: {i * 0.5}s">
          <path
            d="M{800 - ((i * 300) % 700)},{400 +
              Math.floor((i * 300) / 700) * 150} l-15,-15 l15,-15 l15,15 z"
            fill="rgba(255, 0, 255, 0.1)"
            stroke="rgba(255, 0, 255, 0.2)"
            stroke-width="1"
          />
          <text
            x={800 - ((i * 300) % 700)}
            y={390 + Math.floor((i * 300) / 700) * 150}
            text-anchor="middle"
            font-size="10"
            fill="rgba(255, 255, 255, 0.3)"
            font-family="monospace"
            >{i % 2 === 0 ? "+" : "-"}{(i + 1).toFixed(1)}%</text
          >
        </g>
      {/each}
    </svg>
  </div>

  <!-- Gradient lines - using CSS for performance -->
  <div class="token-grid-overlay"></div>

  <!-- Subtle gradient overlay - combined into one element -->
  <div class="gradient-overlay"></div>
</section>

<style scoped>
  /* Combined CRT effects for better performance */
  .crt-effects {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      transparent 50%,
      rgba(158, 124, 244, 0.1) 50%
    );
    background-size: 100% 4px;
    opacity: 0.15;
  }

  /* Optimized background overlays */
  .token-grid-overlay {
    position: absolute;
    inset: 0;
    z-index: 0;
    opacity: 0.1;
    pointer-events: none;
    background-color: transparent;
    background-image:
      linear-gradient(to right, rgba(158, 124, 244, 0.1) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(158, 124, 244, 0.1) 1px, transparent 1px);
    background-size: 50px 50px;
    animation: grid-shift 30s linear infinite;
  }

  .gradient-overlay {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(
        to right,
        transparent,
        rgba(158, 124, 244, 0.1) 50%,
        transparent
      ),
      linear-gradient(
        to bottom,
        transparent,
        rgba(255, 0, 255, 0.1) 50%,
        transparent
      );
    opacity: 0.3;
    pointer-events: none;
  }

  /* Animations - simplified for performance */
  @keyframes noise-animation {
    0%,
    100% {
      opacity: 0.07;
    }
    50% {
      opacity: 0.08;
    }
  }

  /* Simplified sine-wave animations for better performance */
  @keyframes content-warp {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.001);
    }
  }

  @keyframes crt-token-pulse {
    0%,
    100% {
      text-shadow: 0 0 5px rgba(158, 124, 244, 0.5);
    }
    50% {
      text-shadow: 0 0 8px rgba(158, 124, 244, 0.7);
    }
  }

  /* Simplified particle animations */
  @keyframes connect-float {
    0% {
      transform: translateY(0);
      opacity: 0.2;
    }
    50% {
      transform: translateY(-30px);
      opacity: 0.7;
    }
    100% {
      transform: translateY(-60px);
      opacity: 0;
    }
  }

  @keyframes connect-float-down {
    0% {
      transform: translateY(0);
      opacity: 0.2;
    }
    50% {
      transform: translateY(30px);
      opacity: 0.7;
    }
    100% {
      transform: translateY(60px);
      opacity: 0;
    }
  }

  /* Blockchain node animation - simplified */
  .blockchain-node {
    animation: node-pulse 6s ease-in-out infinite;
  }

  @keyframes node-pulse {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  /* Price line animation - optimized */
  .price-line {
    stroke-dasharray: 1000;
    stroke-dashoffset: 1000;
    animation: line-draw 20s linear infinite;
  }

  @keyframes line-draw {
    0% {
      stroke-dashoffset: 1000;
    }
    100% {
      stroke-dashoffset: -1000;
    }
  }

  /* Volume bar animation - simplified */
  .volume-bar {
    opacity: 0.1;
  }

  /* Financial indicator animation - simplified */
  .financial-indicator {
    animation: indicator-pulse 7s ease-in-out infinite;
  }

  @keyframes indicator-pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.8;
    }
  }

  /* Token grid background - optimized animation */
  @keyframes grid-shift {
    0% {
      background-position: 0 0;
    }
    100% {
      background-position: 50px 50px;
    }
  }
</style>
