<script lang="ts">
  import { goto } from "$app/navigation";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import { app } from "$lib/state/app.state.svelte";

  // Types
  interface Token {
    address: string;
    symbol?: string;
    logo_url?: string;
    metrics?: {
      volume_24h?: number | string | null;
      tvl?: number | string | null;
      price_change_24h?: number | string | null;
      price?: number | string | null;
    }
  }

  interface BubblePosition {
    x: number;
    y: number;
  }

  interface BubbleStyle {
    size: number;
    logoSize: number;
    symbolSize: number;
    priceSize: number;
    color: string;
    colorKey: string;
  }
  let isMobile = $derived(app.isMobile);

  // State
  let tokens = $state<Token[]>([]);
  let positions = $state<BubblePosition[]>([]);
  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let containerElement = $state<HTMLElement>();
  let loading = $state(true);
  let error = $state<string | null>(null);
  let hoveredToken = $state<string | null>(null);
  let isPaused = $state(false);
  let isResizing = $state(false);
  let resizeTimeout = $state<number | null>(null);

  // Utilities
  const formatCurrency = (value: number | string | null | undefined): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!num || isNaN(num)) return '$0';
    
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    if (num < 0.0001) return `$${num.toFixed(8)}`;
    if (num < 0.01) return `$${num.toFixed(6)}`;
    if (num < 1) return `$${num.toFixed(4)}`;
    return `$${num.toFixed(2)}`;
  };

  const getChangePercent = (change: number | string | null | undefined): number => {
    const num = typeof change === 'string' ? parseFloat(change) : change;
    return num || 0;
  };

  // Calculate bubble sizes with dramatic scaling for visual impact
  const calculateBubbleSizes = (tokens: Token[]): Map<string, number> => {
    if (!containerWidth || !containerHeight || !tokens.length) return new Map();
    
    const largestChange = tokens.reduce((max, token) => Math.max(max, Math.abs(getChangePercent(token.metrics?.price_change_24h))), 0);
    const changes = tokens.map(token => Math.abs(getChangePercent(token.metrics?.price_change_24h)));
    const usableArea = containerWidth * containerHeight * (isMobile ? 0.6 : 0.75);
    const avgArea = usableArea / tokens.length;
    const baseDiameter = Math.sqrt(avgArea / Math.PI) * 2;
    
    // 7:1 diameter ratio with larger max size for dramatic effect
    let maxDiameter = Math.min(baseDiameter * 3, Math.sqrt(usableArea * 0.3 / Math.PI) * 2);
    const minDiameter = Math.max(12, maxDiameter / 5.5);

    //adjust maxDiameter based on the largest change, starts at 70% and scales to 100%
    maxDiameter = maxDiameter * (0.7 + 0.3 * Math.min(1, largestChange / 200))
    
    // Power scaling for more dramatic visual differences (square root of square root = 4th root)
    // This makes -16% significantly more visible than -6%
    const sizeMap = new Map<string, number>();
    tokens.forEach((token, i) => {
      const change = Math.max(0.1, Math.min(largestChange, changes[i]));
      const normalizedChange = change / largestChange; // 0 to 1
      const scaleFactor = Math.pow(normalizedChange, 1.2); // Power scaling for dramatic effect
      const diameter = minDiameter + (maxDiameter - minDiameter) * scaleFactor;
      sizeMap.set(token.address, diameter);
    });
    
    // Global scaling to fit viewport
    const totalArea = Array.from(sizeMap.values()).reduce((sum, d) => sum + Math.PI * (d/2)**2, 0);
    const scale = totalArea > usableArea ? Math.sqrt(usableArea / totalArea) * 0.85 : 0.9;
    
    sizeMap.forEach((diameter, address) => {
      sizeMap.set(address, Math.max(10, diameter * scale));
    });
    
    return sizeMap;
  };

  // Memoized bubble sizes - only recalculate when dependencies change
  const bubbleSizes = $derived(calculateBubbleSizes(tokens));

  // Single calculation function for all bubble properties
  const calculateBubbleStyle = (token: Token, bubbleSizes: Map<string, number>): BubbleStyle => {
    const changePercent = getChangePercent(token.metrics?.price_change_24h);
    const size = bubbleSizes.get(token.address) || 80;
    
    // Calculate sizes to ensure content fits with proper padding (20% padding total)
    const availableHeight = size * 0.8; // 80% of bubble height available for content
    const verticalPadding = size * 0.1; // 10% padding top and bottom
    
    // Distribute vertical space: logo (40%), symbol (30%), price (30%)
    const logoSize = size * 0.3;
    const symbolSize = size * 0.12;
    const priceSize = size * 0.12;
    
    // Simplified color calculation
    const absChange = Math.abs(changePercent);
    const intensity = Math.min(3, Math.floor(absChange / 5)); // 0-3 scale
    const colorKey = absChange < 0.05 ? 'neutral' : changePercent > 0 ? 'positive' : 'negative';
    const color = absChange < 0.05 ? 'neutral' : `${colorKey}-${intensity}`;
    
    return { size, logoSize, symbolSize, priceSize, color, colorKey };
  };

  // Adaptive circle packing algorithm that scales with bubble count
  const initializePositions = () => {
    if (!containerElement || !tokens.length || !containerWidth || !containerHeight || !bubbleSizes.size) return;
    
    const newPositions: BubblePosition[] = new Array(tokens.length);
    const margin = 30;
    const availableWidth = containerWidth - 2 * margin;
    const availableHeight = containerHeight - 2 * margin;
    const totalArea = availableWidth * availableHeight;
    
    // Create sorted bubble list (largest first for better packing)
    const sortedBubbles = tokens.map((token, index) => ({
      token,
      index,
      size: bubbleSizes.get(token.address) || 80,
      radius: (bubbleSizes.get(token.address) || 80) / 2,
      x: 0,
      y: 0,
      placed: false
    })).sort((a, b) => b.size - a.size);

    // Calculate total bubble area and adaptive parameters
    const totalBubbleArea = sortedBubbles.reduce((sum, b) => sum + Math.PI * b.radius * b.radius, 0);
    const densityRatio = totalBubbleArea / totalArea;
    
    // Adaptive parameters based on bubble count and density - optimized for smaller bubbles
    const avgBubbleRadius = Math.sqrt(totalBubbleArea / (Math.PI * tokens.length));
    const spiralStep = Math.max(avgBubbleRadius * 0.6, 8); // Smaller steps for better packing with small bubbles
    const maxSpiralAttempts = Math.min(12000, tokens.length * 150 + 3000); // More attempts since bubbles are smaller
    const searchRadius = Math.min(availableWidth, availableHeight) * 0.9; // Larger search area for smaller bubbles
    
    // console.log(`Packing parameters:
    //   - Density ratio: ${(densityRatio * 100).toFixed(1)}%
    //   - Avg bubble radius: ${avgBubbleRadius.toFixed(1)}px
    //   - Spiral step: ${spiralStep.toFixed(1)}px
    //   - Max attempts: ${maxSpiralAttempts}`)

    // Placed bubbles for collision detection
    const placedBubbles: Array<{x: number, y: number, radius: number}> = [];

    // Collision and bounds checking utilities - adjusted for smaller bubbles
    const minSpacing = 4; // Reduced spacing for smaller bubbles
    const isColliding = (x: number, y: number, radius: number): boolean => 
      placedBubbles.some(placed => {
        const dx = x - placed.x, dy = y - placed.y;
        return Math.sqrt(dx * dx + dy * dy) < radius + placed.radius + minSpacing;
      });

    const isWithinBounds = (x: number, y: number, radius: number): boolean => 
      x - radius >= margin && x + radius <= containerWidth - margin &&
      y - radius >= margin && y + radius <= containerHeight - margin;

    // Multi-stage position finding
    const findValidPosition = (targetRadius: number, bubbleIndex: number): {x: number, y: number} | null => {
      const centerX = containerWidth / 2;
      const centerY = containerHeight / 2;
      
      // Stage 1: Spiral search from center
      for (let attempt = 0; attempt < maxSpiralAttempts; attempt++) {
        const angle = attempt * 0.618034; // Golden angle for optimal distribution
        const radius = Math.sqrt(attempt) * spiralStep;
        
        // Stop spiral if we've exceeded reasonable search area
        if (radius > searchRadius) break;
        
        // Multiple candidate positions per spiral step
        for (let variant = 0; variant < 3; variant++) {
          const randomOffset = spiralStep * 0.3 * variant;
          const offsetAngle = (Math.random() - 0.5) * 0.5;
          
          const x = centerX + Math.cos(angle + offsetAngle) * (radius + randomOffset);
          const y = centerY + Math.sin(angle + offsetAngle) * (radius + randomOffset);
          
          if (isWithinBounds(x, y, targetRadius) && !isColliding(x, y, targetRadius)) {
            return { x, y };
          }
        }
      }
      
      // Stage 2: Grid search with adaptive step size
      const adaptiveGridStep = Math.max(targetRadius * 1.2, spiralStep);
      const gridCols = Math.floor(availableWidth / adaptiveGridStep);
      const gridRows = Math.floor(availableHeight / adaptiveGridStep);
      
      // Random grid traversal to avoid clustering
      const gridPositions: {x: number, y: number}[] = [];
      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          gridPositions.push({
            x: margin + col * adaptiveGridStep + adaptiveGridStep / 2,
            y: margin + row * adaptiveGridStep + adaptiveGridStep / 2
          });
        }
      }
      
      // Shuffle grid positions for better distribution
      for (let i = gridPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gridPositions[i], gridPositions[j]] = [gridPositions[j], gridPositions[i]];
      }
      
      for (const gridPos of gridPositions) {
        // Small random offset within grid cell
        const offsetX = (Math.random() - 0.5) * adaptiveGridStep * 0.4;
        const offsetY = (Math.random() - 0.5) * adaptiveGridStep * 0.4;
        
        const x = gridPos.x + offsetX;
        const y = gridPos.y + offsetY;
        
        if (isWithinBounds(x, y, targetRadius) && !isColliding(x, y, targetRadius)) {
          return { x, y };
        }
      }
      
      return null;
    };

    // Place bubbles with progressive fallback strategies
    let unplacedCount = 0;
    const unplacedBubbles: typeof sortedBubbles = [];
    
    // First pass: try to place all bubbles optimally
    for (let i = 0; i < sortedBubbles.length; i++) {
      const bubble = sortedBubbles[i];
      const position = findValidPosition(bubble.radius, i);
      
      if (position) {
        placedBubbles.push({
          x: position.x,
          y: position.y,
          radius: bubble.radius
        });
        newPositions[bubble.index] = { x: position.x, y: position.y };
      } else {
        unplacedBubbles.push(bubble);
        unplacedCount++;
      }
    }
    
    // Fallback strategy: distribute unplaced bubbles using multiple techniques
    if (unplacedBubbles.length > 0) {
      // console.log(`Applying fallback for ${unplacedBubbles.length} unplaced bubbles`);
      
      for (let i = 0; i < unplacedBubbles.length; i++) {
        const bubble = unplacedBubbles[i];
        let placed = false;
        
        // Strategy 1: Try smaller radius first (reduce bubble size)
        const reducedRadius = bubble.radius * 0.8;
        const reducedPosition = findValidPosition(reducedRadius, bubble.index);
        if (reducedPosition) {
          newPositions[bubble.index] = reducedPosition;
          placedBubbles.push({ ...reducedPosition, radius: reducedRadius });
          placed = true;
        }
        
        // Strategy 2: Grid-based placement in less crowded areas
        if (!placed) {
          const gridSize = avgBubbleRadius * 3;
          const cols = Math.floor(availableWidth / gridSize);
          const rows = Math.floor(availableHeight / gridSize);
          
          // Find the least crowded grid cell
          let bestCell = null;
          let minNearbyBubbles = Infinity;
          
          for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
              const cellX = margin + (col + 0.5) * gridSize;
              const cellY = margin + (row + 0.5) * gridSize;
              
              // Count nearby bubbles
              const nearbyCount = placedBubbles.filter(placed => {
                const dx = cellX - placed.x;
                const dy = cellY - placed.y;
                return Math.sqrt(dx * dx + dy * dy) < gridSize * 2;
              }).length;
              
              if (nearbyCount < minNearbyBubbles && 
                  isWithinBounds(cellX, cellY, bubble.radius) &&
                  !isColliding(cellX, cellY, bubble.radius)) {
                minNearbyBubbles = nearbyCount;
                bestCell = { x: cellX, y: cellY };
              }
            }
          }
          
          if (bestCell) {
            newPositions[bubble.index] = bestCell;
            placedBubbles.push({ ...bestCell, radius: bubble.radius });
            placed = true;
          }
        }
        
        // Strategy 3: Force placement at viewport edges as last resort
        if (!placed) {
          const edgePositions = [
            // Top edge
            { x: margin + (i % 5) * (availableWidth / 5), y: margin + bubble.radius },
            // Bottom edge  
            { x: margin + (i % 5) * (availableWidth / 5), y: containerHeight - margin - bubble.radius },
            // Left edge
            { x: margin + bubble.radius, y: margin + (i % 5) * (availableHeight / 5) },
            // Right edge
            { x: containerWidth - margin - bubble.radius, y: margin + (i % 5) * (availableHeight / 5) }
          ];
          
          const edgePos = edgePositions[i % edgePositions.length];
          newPositions[bubble.index] = edgePos;
        }
      }
    }

    // if (unplacedCount > 0) {
    //   console.log(`Placed ${tokens.length - unplacedCount}/${tokens.length} bubbles optimally, ${unplacedCount} using fallback`);
    // }

    // Light relaxation pass only if density is reasonable
    if (densityRatio < 0.7 && placedBubbles.length > 1) {
      relaxBubblePositions(newPositions, sortedBubbles, 2);
    }
    
    positions = newPositions;
  };

  // Relaxation algorithm to improve bubble spacing
  const relaxBubblePositions = (
    positions: BubblePosition[], 
    bubbles: Array<{token: Token, index: number, size: number, radius: number}>,
    iterations: number
  ) => {
    const margin = 30;
    const minSpacing = 4; // Consistent with collision detection
    
    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < bubbles.length; i++) {
        if (!positions[bubbles[i].index]) continue;
        
        const currentPos = positions[bubbles[i].index];
        const currentRadius = bubbles[i].radius;
        let forceX = 0;
        let forceY = 0;
        
        // Calculate repulsion forces from other bubbles
        for (let j = 0; j < bubbles.length; j++) {
          if (i === j || !positions[bubbles[j].index]) continue;
          
          const otherPos = positions[bubbles[j].index];
          const otherRadius = bubbles[j].radius;
          
          const dx = currentPos.x - otherPos.x;
          const dy = currentPos.y - otherPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = currentRadius + otherRadius + minSpacing; // Use same spacing as collision detection
          
          if (distance < minDistance && distance > 0) {
            const overlap = minDistance - distance;
            const force = overlap * 0.08; // Gentler force for smaller bubbles
            
            forceX += (dx / distance) * force;
            forceY += (dy / distance) * force;
          }
        }
        
        // Apply forces with bounds checking
        const newX = Math.max(
          margin + currentRadius,
          Math.min(
            containerWidth - margin - currentRadius,
            currentPos.x + forceX
          )
        );
        
        const newY = Math.max(
          margin + currentRadius,
          Math.min(
            containerHeight - margin - currentRadius,
            currentPos.y + forceY
          )
        );
        
        positions[bubbles[i].index] = { x: newX, y: newY };
      }
    }
  };

  // Data loading
  const loadTokens = async () => {
    loading = true;
    try {
      const response = await fetchTokens();
      tokens = response.tokens
        .filter(token => 
          Number(token.metrics?.volume_24h) > 0 && 
          Number(token.metrics?.tvl) > 100
        )
        // .slice(0, MAX_TOKENS);
      error = null;
    } catch (e) {
      console.error("Error loading tokens:", e);
      error = "Failed to load token data";
    } finally {
      loading = false;
    }
  };

  // Setup effect - runs once on mount
  $effect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault();
        isPaused = !isPaused;
      } else if (event.key === 'r' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        loadTokens();
      }
    };

    const handleVisibility = () => isPaused = document.hidden;

    loadTokens(); // Initial load
    
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("keydown", handleKeydown);
    
    const interval = setInterval(loadTokens, 30000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("keydown", handleKeydown);
      clearInterval(interval);
    };
  });

  // 2. Container size effect with debounced resize
  $effect(() => {
    if (!containerElement) return;
    
    const handleResize = () => {
      // Clear existing timeout
      if (resizeTimeout) window.clearTimeout(resizeTimeout);
      
      // Show loading during resize
      isResizing = true;
      
      // Debounce resize calculation
      resizeTimeout = window.setTimeout(() => {
        const rect = containerElement!.getBoundingClientRect();
        containerWidth = rect.width;
        containerHeight = rect.height;
        isResizing = false;
        resizeTimeout = null;
      }, 2000);
    };

    // Initial size without debounce
    const rect = containerElement.getBoundingClientRect();
    containerWidth = rect.width;
    containerHeight = rect.height;
    
    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerElement);

    return () => {
      if (resizeTimeout) window.clearTimeout(resizeTimeout);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  });

  // 3. Position initialization effect - only runs when bubbleSizes change
  $effect(() => {
    if (containerElement && tokens.length && containerWidth && containerHeight && bubbleSizes.size) {
      initializePositions();
    }
  });

  // 4. Animation control via CSS
  $effect(() => {
    if (containerElement) {
      if (isPaused) {
        containerElement.style.setProperty('--animation-play-state', 'paused');
      } else {
        containerElement.style.setProperty('--animation-play-state', 'running');
      }
    }
  });
</script>

<svelte:head>
  <title>Market Bubbles - KongSwap</title>
</svelte:head>

<div class="bubbles-container" bind:this={containerElement}>
  <!-- <div class="controls">
    <div class="control-hint">Space: ⏸️ Pause/Resume</div>
    <div class="control-hint">Ctrl+R: 🔄 Refresh</div>
  </div> -->
  
  {#if loading && !tokens.length}
    <div class="loading">
      <div class="loading-spinner">
        {#each Array(4) as _, i}
          <div class="spinner-ring" style="animation-delay: {-0.45 + i * 0.15}s;"></div>
        {/each}
      </div>
      <div class="loading-text">Loading tokens...</div>
    </div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if isResizing}
    <div class="loading">
      <div class="loading-spinner">
        {#each Array(4) as _, i}
          <div class="spinner-ring" style="animation-delay: {-0.45 + i * 0.15}s;"></div>
        {/each}
      </div>
      <div class="loading-text">Updating bubbles...</div>
    </div>
  {:else}
    {#each tokens as token, i (token.address)}
      {@const style = calculateBubbleStyle(token, bubbleSizes)}
      {@const pos = positions[i]}
      {@const changePercent = getChangePercent(token.metrics?.price_change_24h)}
      {@const isHovered = hoveredToken === token.address}
      
      {#if pos}
        <div
          class="bubble {style.colorKey} {(isHovered) ? 'hovered' : ''}"
          style="
            width: {style.size}px;
            height: {style.size}px;
            left: {pos.x - style.size/2}px;
            top: {pos.y - style.size/2}px;
            --sway-delay: {i * 0.3}s;
          "
          onclick={() => goto(`/stats/${token.address}`)}
          onmouseenter={() => hoveredToken = token.address}
          onmouseleave={() => hoveredToken = null}
        >
          <div class="bubble-content">
            {#if token.logo_url}
              <img
                src={token.logo_url}
                alt={token.symbol}
                class="token-logo"
                style="width: {style.logoSize}px; height: {style.logoSize}px; margin-bottom: {style.logoSize * 0.1}px;"
                loading="lazy"
              />
            {/if}
            <div class="token-symbol" style="font-size: {style.symbolSize}px; line-height: 1; margin-bottom: {style.symbolSize * 0.2}px;">
              {token.symbol}
            </div>
            <div class="price-change" style="font-size: {style.priceSize}px; line-height: 1;">
              {changePercent.toFixed(2)}%
            </div>
          </div>
        </div>
      {/if}
    {/each}
  {/if}
  
  <!-- Fixed tooltip outside of bubble loop -->
  {#if hoveredToken && !isMobile}
    {@const hoveredTokenData = tokens.find(t => t.address === hoveredToken)}
    {#if hoveredTokenData}
      {@const changePercent = getChangePercent(hoveredTokenData.metrics?.price_change_24h)}
      <div class="tooltip" >
        <div class="flex justify-between items-center mb-2">
          <div class="text-lg font-extrabold text-kong-text-primary">{hoveredTokenData.symbol}</div>
          {#if hoveredTokenData.metrics?.price}
            <div class="text-base font-bold text-kong-text-primary">{formatCurrency(hoveredTokenData.metrics?.price)}</div>
          {/if}
        </div>
        
        {#if hoveredTokenData.metrics?.price_change_24h}
          <div class="text-sm font-semibold px-2 py-1 rounded-lg text-center mb-2 {changePercent >= 0 ? 'bg-kong-success/10 text-kong-success' : 'bg-kong-error/10 text-kong-error'}">
            {changePercent >= 0 ? '↗' : '↘'} {Math.abs(changePercent).toFixed(2)}% (24h)
          </div>
        {/if}

        <div class="h-px bg-kong-border my-3"></div>
        
        <div class="mb-2">
          {#each [
            { key: 'volume_24h', label: 'Volume (24h)', value: hoveredTokenData.metrics?.volume_24h },
            { key: 'tvl', label: 'TVL', value: hoveredTokenData.metrics?.tvl }
          ] as metric}
            {#if metric.value}
              <div class="flex justify-between items-center mb-2 last:mb-0">
                <span class="text-xs text-kong-text-muted font-medium">{metric.label}:</span>
                <span class="text-sm font-bold text-kong-text-primary">{formatCurrency(metric.value)}</span>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .bubbles-container {
    position: relative;
    display: flex;
    width: 100%;
    height: calc(100dvh - var(--navbar-height));
    overflow: hidden;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .bubble {
    position: absolute;
    border-radius: 50%;
    cursor: pointer;
    z-index: 1;
    
    /* 3D Bubble Effects */
    background: radial-gradient(ellipse at 30% 30%, 
      rgba(255, 255, 255, 0.3) 0%, 
      transparent 50%
    );
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    
    /* Gentle sway animation */
    animation: gentleSway 4s ease-in-out infinite;
    animation-delay: var(--sway-delay, 0s);
    animation-play-state: var(--animation-play-state, running);
    transform-origin: center center;
  }

  @keyframes gentleSway {
    0%, 100% { 
      transform: translate(0px, 0px) rotate(0deg) scale(1);
    }
    25% { 
      transform: translate(2px, -3px) rotate(0.5deg) scale(1.01);
    }
    50% { 
      transform: translate(-1px, 2px) rotate(-0.3deg) scale(0.99);
    }
    75% { 
      transform: translate(3px, 1px) rotate(0.8deg) scale(1.02);
    }
  }

  .bubble::before {
    content: '';
    position: absolute;
    top: 15%;
    left: 25%;
    width: 25%;
    height: 25%;
    background: radial-gradient(ellipse, rgba(255, 255, 255, 0.6), transparent 70%);
    border-radius: 50%;
    filter: blur(1px);
  }

  .bubble.positive, .bubble[class*="positive-"] {
    --bubble-color: 16, 185, 129;
    background-color: rgba(var(--bubble-color), var(--bubble-alpha, 0.3));
    box-shadow: 
      0 8px 32px rgba(var(--bubble-color), calc(var(--bubble-alpha, 0.3) + 0.1)),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
    border: 2px solid rgba(var(--bubble-color), calc(var(--bubble-alpha, 0.3) + 0.2));
  }

  .bubble.positive-1 { --bubble-alpha: 0.5; }
  .bubble.positive-2 { --bubble-alpha: 0.7; }
  .bubble.positive-3 { --bubble-alpha: 0.9; }

  .bubble.negative, .bubble[class*="negative-"] {
    --bubble-color: 220, 38, 38;
    background-color: rgba(var(--bubble-color), var(--bubble-alpha, 0.3));
    box-shadow: 
      0 8px 32px rgba(var(--bubble-color), calc(var(--bubble-alpha, 0.3) + 0.1)),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
    border: 2px solid rgba(var(--bubble-color), calc(var(--bubble-alpha, 0.3) + 0.2));
  }

  .bubble.negative-1 { --bubble-alpha: 0.5; }
  .bubble.negative-2 { --bubble-alpha: 0.7; }
  .bubble.negative-3 { --bubble-alpha: 0.9; }

  .bubble.neutral {
    background-color: rgba(107, 114, 128, 0.3);
    box-shadow: 
      0 8px 32px rgba(107, 114, 128, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
    border: 2px solid rgba(107, 114, 128, 0.5);
  }

  .bubble.hovered {
    z-index: 100;
    transform: scale(1.15) !important;
    animation-play-state: paused !important;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .bubble:not(.hovered) {
    transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  .bubble-content {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: rgb(var(--text-primary));
    text-align: center;
    padding: 10%;
    box-sizing: border-box;
    z-index: 2;
    overflow: hidden;
  }

  .token-logo {
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
  }

  .token-symbol {
    font-weight: 700;
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    flex-shrink: 0;
  }

  .price-change {
    font-weight: 600;
    opacity: 0.9;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tooltip {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgb(var(--bg-secondary) / 0.98);
    border: 2px solid rgb(var(--ui-border) / 0.8);
    border-radius: 16px;
    padding: 16px;
    backdrop-filter: blur(20px);
    box-shadow: 
      0 20px 50px rgb(var(--bg-primary) / 0.3),
      0 0 0 1px rgb(var(--ui-border-light) / 0.5);
    z-index: 1000;
    min-width: 220px;
    max-width: 280px;
    animation: tooltipIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    pointer-events: none;
  }

  @keyframes tooltipIn {
    from { 
      opacity: 0; 
      transform: translateX(20px) scale(0.8); 
    }
    to { 
      opacity: 1; 
      transform: translateX(0) scale(1); 
    }
  }



  .controls {
    position: absolute;
    bottom: 20px;
    left: 20px;
    z-index: 1000;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .controls:hover {
    opacity: 1;
  }

  .control-hint {
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    margin-bottom: 4px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    width: 100%;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: rgb(var(--text-primary));
  }

  .loading-spinner {
    position: relative;
    width: 60px;
    height: 60px;
  }

  .spinner-ring {
    position: absolute;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    border: 3px solid transparent;
    border-radius: 50%;
    animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    border-top-color: rgb(var(--brand-primary));
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
    100% {
      transform: rotate(360deg);
      opacity: 1;
    }
  }

  .loading-text {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    font-size: 1.1rem;
    font-weight: 500;
    opacity: 0.8;
    text-align: center;
  }

  .error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 1.2rem;
    color: rgb(var(--semantic-error));
  }

  @media (max-width: 768px) {
    .bubble:hover { transform: none; }
    .bubble:active { transform: scale(1.05); }
    .controls { display: none; }
    
    .tooltip {
      bottom: 10px;
      right: 10px;
      left: 10px;
      min-width: auto;
      max-width: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bubble { transition: none; }
    .tooltip { animation: none; }
  }
</style>
