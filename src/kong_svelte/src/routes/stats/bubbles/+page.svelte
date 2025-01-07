<script lang="ts">
  import { liveTokens } from "$lib/services/tokens/tokenStore";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { derived } from "svelte/store";
  import { KONG_CANISTER_ID, CKUSDT_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { goto } from "$app/navigation";
  import * as d3 from 'd3';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  const MOBILE_BREAKPOINT = 768;
  const UPDATE_INTERVAL = 100;
  const SIMULATION_CONSTANTS = {
    ALPHA_DECAY: 0.005,
    VELOCITY_DECAY: 0.3,
    CHARGE_STRENGTH: -35,
    COLLISION_STRENGTH: 0.7,
    CENTER_STRENGTH: 0.03,
    FLOAT_STRENGTH: 0.015
  } as const;

  const RADIUS_MULTIPLIERS = {
    IMAGE: { width: 0.8, x: -0.4, y: -0.7 },
    SYMBOL: { y: 0.35, fontSize: 0.25 },
    PRICE: { y: 0.65, fontSize: 0.2 }
  } as const;

  const TOKEN_LIMITS = {
    MOBILE: 20,
    DESKTOP: 50
  } as const;

  let isMobile = false;

  function getFontSize(baseSize: number, isMobile: boolean, maxMobile: number, maxDesktop: number): string {
    return `${Math.min(baseSize, isMobile ? maxMobile : maxDesktop)}px`;
  }

  // Replace the sortedTokens derived store with a memoized version
  const sortedTokens = derived(liveTokens, ($liveTokens, set) => {
    const cached = new Map<string, number>();
    const limit = isMobile ? TOKEN_LIMITS.MOBILE : TOKEN_LIMITS.DESKTOP;
    
    const sorted = [...$liveTokens]
      .filter(token => {
        const volume = Number(token.metrics?.volume_24h || 0);
        const tvl = Number(token.metrics?.tvl || 0);
        cached.set(token.canister_id, Math.sqrt(volume) + (Math.sqrt(tvl) * 0.1));
        
        return token.canister_id !== KONG_CANISTER_ID && 
               token.canister_id !== CKUSDT_CANISTER_ID &&
               token.metrics?.price_change_24h !== undefined &&
               (volume > 0 || tvl > 0);
      })
      .sort((a, b) => {
        const metricA = cached.get(a.canister_id) || 0;
        const metricB = cached.get(b.canister_id) || 0;
        return metricB - metricA;
      })
      .slice(0, limit);

    set(sorted);
  }, []);

  // Replace getCombinedMetric with a memoized version
  const metricCache = new Map<string, number>();
  function getCombinedMetric(token: FE.Token): number {
    if (metricCache.has(token.canister_id)) {
      return metricCache.get(token.canister_id)!;
    }
    
    const metric = Math.sqrt(Number(token.metrics?.volume_24h || 0)) + 
                  (Math.sqrt(Number(token.metrics?.tvl || 0)) * 0.1);
    metricCache.set(token.canister_id, metric);
    return metric;
  }

  // Add this function to optimize radius calculations
  const radiusCache = new Map<string, number>();
  function getRadius(token: FE.Token, radiusScale: d3.ScaleSqrt<number, number>) {
    const key = `${token.canister_id}-${radiusScale.domain().join('-')}`;
    if (!radiusCache.has(key)) {
      radiusCache.set(key, radiusScale(getCombinedMetric(token)));
    }
    return radiusCache.get(key)!;
  }

  let container: HTMLDivElement;
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  let isInitialized = false;
  
  function initializeSvg() {
    console.log("Initializing SVG");
    if (!container.querySelector('svg')) {
      svg = d3.select(container)
        .append("svg");
    } else {
      svg = d3.select(container).select("svg");
    }
  }

  let renderTimeout: number;
  function debouncedRender(tokens: FE.Token[]) {
    console.log("Debounced render called");
    clearTimeout(renderTimeout);
    renderTimeout = window.setTimeout(() => renderBubbles(tokens), 100);
  }

  const colorCache = new Map<number, string>();

  function getColorForPriceChange(priceChange: number): string {
    const roundedChange = Math.round(priceChange * 100) / 100;
    if (colorCache.has(roundedChange)) {
      return colorCache.get(roundedChange)!;
    }

    let color: string;
    if (priceChange > 0) {
      if (priceChange > 20) color = "#16c784";
      else if (priceChange > 10) color = "#19b77e";
      else if (priceChange > 5) color = "#1ca678";
      else color = "#1f9672";
    } else {
      if (priceChange < -20) color = "#ea3943";
      else if (priceChange < -10) color = "#df363f";
      else if (priceChange < -5) color = "#d4333b";
      else color = "#c83037";
    }
    
    colorCache.set(roundedChange, color);
    return color;
  }

  let currentSimulation: d3.Simulation<FE.Token, undefined> | null = null;

  function renderBubbles(tokens: FE.Token[]) {
    if (!tokens?.length || !container) return;

    if (currentSimulation) {
      currentSimulation.stop();
    }

    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const isMobile = width < MOBILE_BREAKPOINT;
    
    // Clear caches on new render
    radiusCache.clear();
    
    svg.attr("width", width)
       .attr("height", height);

    // Calculate scales
    const maxMetric = d3.max(tokens, getCombinedMetric) || 1;
    const radiusScale = d3.scaleSqrt()
      .domain([0, maxMetric])
      .range(isMobile ? [15, Math.min(130, width / 5)] : [50, Math.min(150, width / 5)]);

    currentSimulation = d3.forceSimulation(tokens)
      .force("x", d3.forceX(width / 2).strength(SIMULATION_CONSTANTS.CENTER_STRENGTH))
      .force("y", d3.forceY(height / 2).strength(SIMULATION_CONSTANTS.CENTER_STRENGTH))
      .force("collide", d3.forceCollide().radius(d => getRadius(d, radiusScale) + 5).strength(1))
      .force("charge", d3.forceManyBody().strength(SIMULATION_CONSTANTS.CHARGE_STRENGTH))
      .force("float", d3.forceRadial(
        d => 40 + Math.random() * 60,
        width / 2, 
        height / 2
      ).strength(SIMULATION_CONSTANTS.FLOAT_STRENGTH))
      .force("wobble", function(alpha) {
        tokens.forEach(d => {
          // More organic movement using multiple sine waves
          const time = Date.now() * 0.001;
          const uniqueOffset = (d.canister_id.charCodeAt(0) || 0) * 0.1;
          d.vx = (d.vx || 0) + (Math.sin(time + uniqueOffset) * 0.3 + Math.sin(time * 1.5) * 0.1) * alpha;
          d.vy = (d.vy || 0) + (Math.cos(time + uniqueOffset) * 0.3 + Math.cos(time * 1.5) * 0.1) * alpha;
        });
      })
      .alphaDecay(SIMULATION_CONSTANTS.ALPHA_DECAY)
      .velocityDecay(SIMULATION_CONSTANTS.VELOCITY_DECAY);

    // Create or update bubble groups
    const bubbles = svg.selectAll("g.bubble")
      .data(tokens, (d: any) => d.canister_id)
      .join(
        enter => {
          const g = enter.append("g")
            .attr("class", "bubble")
            .attr("cursor", "pointer")
            .attr("transform", d => `translate(${width/2},${height/2})`);

          // Add circles
          g.append("circle")
            .attr("r", d => getRadius(d, radiusScale))
            .attr("fill", d => getColorForPriceChange(Number(d.metrics?.price_change_24h || 0)))
            .attr("fill-opacity", 0.6)
            .attr("stroke", "white")
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 0.3);

          // Add content group
          const content = g.append("g").attr("class", "content");

          // Add logo
          content.append("image")
            .attr("xlink:href", d => d.logo_url)
            .attr("width", d => getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.IMAGE.width)
            .attr("height", d => getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.IMAGE.width)
            .attr("x", d => getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.IMAGE.x)
            .attr("y", d => getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.IMAGE.y)
            .attr("clip-path", "circle(50%)")
            .attr("preserveAspectRatio", "xMidYMid slice");

          // Add symbol text
          content.append("text")
            .attr("class", "symbol")
            .text(d => d.symbol)
            .attr("text-anchor", "middle")
            .attr("y", d => getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.SYMBOL.y)
            .attr("fill", "white")
            .attr("font-size", d => getFontSize(
              getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.SYMBOL.fontSize,
              isMobile,
              16,
              24
            ))
            .style("pointer-events", "none");

          // Add price change text
          content.append("text")
            .attr("class", "price-change")
            .text(d => `${formatToNonZeroDecimal(Number(d.metrics?.price_change_24h || 0))}%`)
            .attr("text-anchor", "middle")
            .attr("y", d => getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.PRICE.y)
            .attr("fill", "white")
            .attr("font-size", d => getFontSize(
              getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.PRICE.fontSize,
              isMobile,
              14,
              18
            ))
            .attr("opacity", 0.8)
            .style("pointer-events", "none");

          return g;
        },
        update => {
          // Update existing elements
          update.select("circle")
            .attr("r", d => getRadius(d, radiusScale))
            .attr("fill", d => getColorForPriceChange(Number(d.metrics?.price_change_24h || 0)));

          const content = update.select("g.content");
          
          content.select("image")
            .attr("width", d => getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.IMAGE.width)
            .attr("height", d => getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.IMAGE.width)
            .attr("x", d => getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.IMAGE.x)
            .attr("y", d => getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.IMAGE.y)
            .attr("clip-path", "circle(50%)")
            .attr("preserveAspectRatio", "xMidYMid slice");

          content.select("text.symbol")
            .attr("y", d => getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.SYMBOL.y)
            .attr("font-size", d => getFontSize(
              getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.SYMBOL.fontSize,
              isMobile,
              16,
              24
            ));

          content.select("text.price-change")
            .text(d => `${formatToNonZeroDecimal(Number(d.metrics?.price_change_24h || 0))}%`)
            .attr("y", d => getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.PRICE.y)
            .attr("font-size", d => getFontSize(
              getRadius(d, radiusScale) * RADIUS_MULTIPLIERS.PRICE.fontSize,
              isMobile,
              14,
              18
            ));

          return update;
        }
      )
      .on("click", (event, d) => goto(`/stats/${d.canister_id}`));

    // Add hover effects
    bubbles.select("circle")
      .on("mouseover", function() {
        d3.select(this)
          .attr("stroke-width", 2)
          .attr("stroke-opacity", 0.8)
          .attr("fill-opacity", 0.8);
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("stroke-width", 1)
          .attr("stroke-opacity", 0.3)
          .attr("fill-opacity", 0.6);
      });

    // Update positions on simulation tick
    currentSimulation.on("tick", () => {
      bubbles.attr("transform", d => {
        const radius = getRadius(d, radiusScale);
        const x = Math.max(radius, Math.min(width - radius, d.x || 0));
        const y = Math.max(radius, Math.min(height - radius, d.y || 0));
        return `translate(${x},${y})`;
      });
    });
  }

  $: if ($sortedTokens && container) {
    const newTokenCount = $sortedTokens.length;
    const shouldRender = !isInitialized || 
                        newTokenCount !== previousTokenCount || 
                        !currentSimulation;
    
    if (shouldRender) {
      if (!isInitialized) {
        isInitialized = true;
        initializeSvg();
      }
      debouncedRender($sortedTokens);
      previousTokenCount = newTokenCount;
    }
  }

  let previousTokenCount = 0;

  let resizeObserver: ResizeObserver;
  onMount(() => {
    resizeObserver = new ResizeObserver(() => {
      if (container && $sortedTokens && isInitialized) {
        debouncedRender($sortedTokens);
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(renderTimeout);
      if (currentSimulation) {
        currentSimulation.stop();
      }
      colorCache.clear();
      metricCache.clear();
      radiusCache.clear();
    };
  });

  $: if (browser) {
    const checkMobile = () => {
      isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    onDestroy(() => {
      window.removeEventListener('resize', checkMobile);
    });
  }
</script>

<section class="flex flex-col w-full max-h-[calc(100vh-1rem)]">
  <div class="flex w-full mx-auto gap-4 max-w-full">
      <div bind:this={container} class="bubble-container w-full h-[calc(100vh-9rem)] overflow-hidden">
      </div>
  </div>
</section>

<style lang="postcss">
  section {
    height: calc(100vh - 6rem);
  }

  .bubble-container {
    position: relative;
    overflow: hidden; /* Ensure no overflow */
  }
</style> 