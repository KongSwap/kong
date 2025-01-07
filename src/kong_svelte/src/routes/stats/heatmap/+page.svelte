<script lang="ts">
  import { liveTokens } from "$lib/services/tokens/tokenStore";
  import Panel from "$lib/components/common/Panel.svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { formatUsdValue } from "$lib/utils/tokenFormatters";
  import { derived } from "svelte/store";
  import { KONG_CANISTER_ID, CKUSDT_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { goto } from "$app/navigation";
  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  // Calculate combined metric (volume + TVL) for sorting and sizing
  function getCombinedMetric(token: FE.Token): number {
    const volume = Number(token.metrics?.volume_24h || 0);
    const tvl = Number(token.metrics?.tvl || 0);
    // Use square root to reduce the impact of very large values
    // Still weight volume more heavily since it's a daily metric
    return Math.sqrt(volume) + (Math.sqrt(tvl) * 0.1);
  }

  // Derive sorted tokens by combined volume and TVL
  const sortedTokens = derived(liveTokens, ($liveTokens) => {
    return [...$liveTokens]
      .filter(token => 
        token.canister_id !== KONG_CANISTER_ID && 
        token.canister_id !== CKUSDT_CANISTER_ID &&
        token.metrics?.price_change_24h !== undefined &&
        (Number(token.metrics?.volume_24h) > 0 || Number(token.metrics?.tvl) > 0)
      )
      .sort((a, b) => getCombinedMetric(b) - getCombinedMetric(a));
  });

  // Memoize the color function
  const colorCache = new Map<number, string>();
  function getColorForPriceChange(priceChange: number): string {
    if (colorCache.has(priceChange)) {
      return colorCache.get(priceChange)!;
    }
    let color: string;
    if (priceChange > 0) {
      if (priceChange > 20) color = "#16c784";
      else if (priceChange > 10) color = "#19b77e";
      else if (priceChange > 5) color = "#1ca678";
      else color = "#1f9672";
    } else if (priceChange < 0) {
      if (priceChange < -20) color = "#ea3943";
      else if (priceChange < -10) color = "#df363f";
      else if (priceChange < -5) color = "#d4333b";
      else color = "#c83037";
    } else {
      color = "#374151";
    }
    colorCache.set(priceChange, color);
    return color;
  }

  function getBoxSize(token: FE.Token): string {
    const totalMetric = $sortedTokens.reduce((sum, t) => sum + getCombinedMetric(t), 0);
    const percentage = (getCombinedMetric(token) / totalMetric) * 100;
    
    // Adjusted thresholds for more balanced sizes
    if (percentage > 12) return "col-span-4 row-span-5";
    if (percentage > 8) return "col-span-3 row-span-4";
    if (percentage > 4) return "col-span-2 row-span-3";
    return "col-span-1 row-span-2";
  }

  function shouldShowDetails(token: FE.Token): boolean {
    const totalMetric = $sortedTokens.reduce((sum, t) => sum + getCombinedMetric(t), 0);
    return (getCombinedMetric(token) / totalMetric) * 100 > 0.5;
  }

  let container: HTMLDivElement;
  
  $: if (container && $sortedTokens) {
    renderTreemap($sortedTokens);
  }

  // Create static elements once
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  
  function initializeSvg() {
    if (!container.querySelector('svg')) {
      svg = d3.select(container)
        .append("svg");
    } else {
      svg = d3.select(container).select("svg");
    }
  }

  // Debounce the renderTreemap function
  let renderTimeout: number;
  function debouncedRender(tokens: FE.Token[]) {
    clearTimeout(renderTimeout);
    renderTimeout = window.setTimeout(() => renderTreemap(tokens), 100);
  }

  // Use ResizeObserver instead of watching container
  let resizeObserver: ResizeObserver;
  onMount(() => {
    initializeSvg();
    resizeObserver = new ResizeObserver(() => {
      if (container && $sortedTokens) {
        debouncedRender($sortedTokens);
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(renderTimeout);
    };
  });

  // Add interface for hierarchy data
  interface TreemapData {
    name: string;
    value?: number;
    token?: FE.Token;
  }

  function renderTreemap(tokens: FE.Token[]) {
    if (!tokens?.length || !container) return;

    const width = container.offsetWidth;
    const height = container.offsetHeight;

    svg.attr("width", width)
       .attr("height", height);

    // Memoize hierarchy computation with proper typing
    const root = d3.hierarchy<TreemapData>({
      name: "root",
      children: tokens.map(token => ({
        name: token.symbol,
        value: getCombinedMetric(token),
        token
      }))
    })
    .sum(d => d.value || 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemap = d3.treemap<TreemapData>()
      .size([width, height])
      .padding(1)
      .round(true);

    treemap(root);

    // Use more efficient data join with type safety
    const cell = svg.selectAll<SVGGElement, d3.HierarchyRectangularNode<TreemapData>>("g")
      .data(
        root.leaves(), 
        d => d.data?.token?.canister_id || d.data.name
      );

    // Remove old elements
    cell.exit().remove();

    // Create new elements
    const cellEnter = cell.enter()
      .append("g");

    // Add all static elements with safety checks
    cellEnter.call(g => {
      g.append("rect")
        .on("mouseover", function() { 
          d3.select(this)
            .style("opacity", 0.85)
            .style("filter", "brightness(1.3)")
            .style("stroke", "rgb(var(--text-primary))")
            .style("stroke-width", "1px"); 
        })
        .on("mouseout", function() { 
          d3.select(this)
            .style("opacity", 1)
            .style("filter", "none")
            .style("stroke", "none")
            .style("stroke-width", "0px"); 
        })
        .on("click", (event, d) => {
          const canisterId = d?.data?.token?.canister_id;
          if (canisterId) {
            goto(`/stats/${canisterId}`);
          }
        })
        .style("cursor", "pointer")
        .style("transition", "all 150ms ease-in-out");

      g.append("circle");
      g.append("image");
      g.append("text").attr("class", "token-name");
      g.append("text").attr("class", "token-price");
      g.append("text").attr("class", "token-change");
      g.append("text").attr("class", "token-volume");
      g.append("text").attr("class", "token-tvl");
    });

    // Update with safety checks
    const cellMerge = cellEnter.merge(cell)
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

    cellMerge.select("rect")
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .attr("fill", d => getColorForPriceChange(Number(d.data?.token?.metrics?.price_change_24h || 0)));

    cellMerge.select("circle")
      .attr("cx", 16)
      .attr("cy", 18)
      .attr("r", 12)
      .attr("fill", "#333333")
      .style("opacity", d => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        return width < 60 || height < 60 ? 0 : 1;
      });

    cellMerge.select("image")
      .attr("x", 4)
      .attr("y", 6)
      .attr("width", 24)
      .attr("height", 24)
      .attr("href", d => d.data.token.logo_url)
      .attr("preserveAspectRatio", "xMidYMid slice")
      .attr("clip-path", "circle(12px at 12px 12px)")
      .style("opacity", d => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        return width < 60 || height < 60 ? 0 : 1;
      });

    cellMerge.select("text.token-name")
      .attr("x", d => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        return width < 60 || height < 60 ? 4 : 32;
      })
      .attr("y", 20)
      .attr("class", "text-sm font-medium fill-white token-name")
      .attr("dominant-baseline", "middle")
      .text(d => d.data.name);

    cellMerge.select("text.token-price")
      .attr("x", 4)
      .attr("y", 46)
      .attr("class", "text-xs fill-white opacity-90 token-price")
      .text(d => formatUsdValue(Number(d.data.token.metrics?.price || 0)));

    cellMerge.select("text.token-change")
      .attr("x", 4)
      .attr("y", 60)
      .attr("class", "text-xs fill-white opacity-90 token-change")
      .text(d => {
        const change = Number(d.data.token.metrics?.price_change_24h || 0);
        return `${change > 0 ? '+' : ''}${formatToNonZeroDecimal(change)}%`;
      });

    cellMerge.select("text.token-volume")
      .attr("x", 4)
      .attr("y", 76)
      .attr("class", "text-xs fill-white opacity-75 token-volume")
      .text(d => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        if (width < 80 || height < 80) return '';
        return `Vol: ${formatUsdValue(Number(d.data.token.metrics?.volume_24h || 0))}`;
      });

    cellMerge.select("text.token-tvl")
      .attr("x", 4)
      .attr("y", 92)
      .attr("class", "text-xs fill-white opacity-75 token-tvl")
      .text(d => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        if (width < 80 || height < 100) return '';
        return `TVL: ${formatUsdValue(Number(d.data.token.metrics?.tvl || 0))}`;
      });
  }

  let previousTokenString: string;
</script>
<section class="flex flex-col w-full max-h-[calc(100vh-1rem)]">
  <div class="flex w-full mx-auto gap-4 max-w-full">
    <Panel variant="transparent" type="main" className="flex-1 !p-0 !rounded-b-none">

      <div bind:this={container} class="w-full h-[calc(100vh-9rem)]">
      </div>
    </Panel>
  </div>
</section>

<style>
  section {
    @apply h-[calc(100vh-6rem)];
  }
</style> 