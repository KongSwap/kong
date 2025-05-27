<script lang="ts">
  import { goto } from "$app/navigation";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";

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
    vx: number;
    vy: number;
    targetX?: number;
    targetY?: number;
    element?: HTMLElement; // Cache DOM element reference
  }

  // State
  let tokens = $state<Token[]>([]);
  let bubblePositions = $state<Array<BubblePosition>>([]);
  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let containerElement = $state<HTMLElement | undefined>(undefined);
  let animationFrameId = $state<number | undefined>(undefined);
  let isInitialized = $state(false);
  let isMobile = $state(false);
  let maxTokens = $state(100);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let hoveredToken = $state<string | null>(null);
  let lastUpdateTime = $state(0);
  let isAnimationPaused = $state(false);

  // Optimized constants for best performance
  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const MAX_TOKENS_MOBILE = 15;
  const MAX_TOKENS_DESKTOP = 50;

  // Helper Functions
  function formatCurrency(value: number | string | null | undefined): string {
    if (value == null) return '$0';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '$0';
    
    // Format based on magnitude
    if (numValue >= 1e9) return `$${(numValue / 1e9).toFixed(2)}B`;
    if (numValue >= 1e6) return `$${(numValue / 1e6).toFixed(2)}M`;
    if (numValue >= 1e3) return `$${(numValue / 1e3).toFixed(2)}K`;
    
    // Use more precision for smaller values - always use decimal notation
    if (numValue < 0.0001) {
      // For extremely small values, use 8 decimal places
      return `$${numValue.toFixed(8)}`;
    }
    if (numValue < 0.01) {
      // Use 6 decimal places for very small values
      return `$${numValue.toFixed(6)}`;
    }
    if (numValue < 1) {
      // Use 4 decimal places for values between 0.01 and 1
      return `$${numValue.toFixed(4)}`;
    }
    
    // Standard 2 decimal places for values >= 1
    return `$${numValue.toFixed(2)}`;
  }

  // Optimized bubble size calculation with smaller cache
  const bubbleSizeCache = new Map<string, { size: number, timestamp: number }>();
  const CACHE_TTL = 3000; // 3 seconds cache for better performance

  function calcBubbleSize(token: Token): number {
    const cacheKey = `${token.address}_${token.metrics?.price_change_24h}_${containerWidth}_${containerHeight}_${tokens.length}`;
    const cached = bubbleSizeCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.size;
    }

    // Get price change data
    const changePercent = token?.metrics?.price_change_24h;
    const numericValue = typeof changePercent === "string"
      ? parseFloat(changePercent)
      : changePercent;
    
    // Calculate size based on price change percentage (absolute value)
    const absVal = Math.abs(numericValue || 0);
    
    // Dynamic base size based on container dimensions and token count
    if (containerWidth && containerHeight && tokens.length) {
      // Calculate available area and desired coverage
      const screenArea = containerWidth * containerHeight;
      const tokenCount = tokens.length;
      
      // Target a specific density optimized for performance
      const desiredCoverage = 0.35;
      
      // Calculate ideal average bubble size for desired coverage
      const idealArea = (screenArea * desiredCoverage) / (tokenCount * (Math.PI / 4));
      const idealDiameter = Math.sqrt(idealArea);
      
      // Calculate minimum size based on screen dimensions
      const screenSize = Math.sqrt(screenArea);
      const minBaseSizeByScreen = screenSize * (isMobile ? 0.12 : 0.1);
      
      // Set bounds for minimum size - optimized for performance
      const absoluteMinSize = isMobile ? 100 : 80;
      const minBaseSize = Math.max(absoluteMinSize, minBaseSizeByScreen);
      
      // Limit how large bubbles can get - performance optimized
      const maxBaseDiameter = Math.min(180, screenSize * 0.12);
      const baseSize = Math.min(maxBaseDiameter, Math.max(minBaseSize, idealDiameter * 0.65));
      
      // Use the calculated base size plus variation for price change
      const size = baseSize + absVal * (isMobile ? 2 : 3);
      
      // Cache the result
      bubbleSizeCache.set(cacheKey, { size, timestamp: Date.now() });
      return size;
    }
    
    // Fallback to fixed size if container dimensions not available yet
    const baseSize = isMobile ? 60 : 80;
    const size = baseSize + absVal * (isMobile ? 1.5 : 2);
    
    bubbleSizeCache.set(cacheKey, { size, timestamp: Date.now() });
    return size;
  }

  function getBubbleColor(changePercent: number | string | null | undefined): string {
    const numericValue =
      typeof changePercent === "string"
        ? parseFloat(changePercent)
        : changePercent;
    
    // Handle missing values
    if (numericValue == null || isNaN(numericValue)) return 'rgb(var(--text-secondary) / 0.8)';
    
    // Special case for zero or very small changes (absolute value less than 0.05%)
    if (Math.abs(numericValue) < 0.05) return 'rgb(var(--bg-dark) / 0.8)';
    
    // Otherwise use green for positive, red for negative
    return numericValue > 0 ? 'rgb(var(--accent-green) / 0.8)' : 'rgb(var(--accent-red) / 0.8)';
  }

  function getColorKey(changePercent: number | string | null | undefined): string {
    const numericValue =
      typeof changePercent === "string"
        ? parseFloat(changePercent)
        : changePercent;
        
    // Handle missing values
    if (numericValue == null || isNaN(numericValue)) return 'neutral';
    
    // Special case for zero or very small changes
    if (Math.abs(numericValue) < 0.05) return 'zero';
    
    // Otherwise use positive/negative keys
    return numericValue > 0 ? 'positive' : 'negative';
  }

  function calcLogoSize(bubbleSize: number) {
    // Scale logo size based on bubble size
    const screenSize = containerWidth && containerHeight ? Math.sqrt(containerWidth * containerHeight) : 0;
    // Adjust scale factor based on screen size - larger screens get smaller relative logos
    const scaleFactor = isMobile ? 0.4 : Math.max(0.25, Math.min(0.35, 0.35 - (screenSize - 1000) / 20000));
    return Math.max(20, bubbleSize * scaleFactor);
  }

  function calcFontSize(bubbleSize: number) {
    // Adjust font scaling based on screen size
    const screenSize = containerWidth && containerHeight ? Math.sqrt(containerWidth * containerHeight) : 0;
    const screenFactor = screenSize > 0 ? Math.min(1.2, Math.max(1, 1 + (screenSize - 1000) / 10000)) : 1;
    const mobileScale = isMobile ? 0.85 : 1;
    const sizeScale = Math.pow(bubbleSize / 100, 0.8) * screenFactor;
    
    // Slightly smaller relative font sizes on very large screens
    const symbolSize = Math.max(
      0.45,
      Math.min(1.3, bubbleSize * 0.06 * mobileScale * sizeScale),
    );
    const priceSize = Math.max(
      0.35,
      Math.min(1.1, bubbleSize * 0.045 * mobileScale * sizeScale),
    );
    return { symbolSize, priceSize };
  }

  function getSymbolStyle(symbol: string | undefined, fontSize: number) {
    if (symbol && symbol.length > 4) {
      // Adjust reduction more gradually for larger screens
      const reductionBase = containerWidth > 1200 ? 0.8 : 0.9;
      const reductionFactor = Math.min(0.7, reductionBase - (symbol.length - 4) * 0.05);
      return `font-size: ${fontSize * reductionFactor}rem; letter-spacing: -0.5px;`;
    }
    return `font-size: ${fontSize}rem;`;
  }

  // Highly optimized repulsion calculation
  function calculateRepulsionForces(bubblePositions: BubblePosition[], tokens: Token[], i: number, bubbleSize: number, minDistance: number, repulsionStrength: number): [number, number] {
    let forceX = 0;
    let forceY = 0;
    
    const pos = bubblePositions[i];
    const checkDistance = Math.min(150, bubbleSize * 2.5); // Reduced interaction range
    const checkDistanceSq = checkDistance * checkDistance;
    
    // Only check every 2nd bubble for mobile performance
    const step = isMobile ? 2 : 1;
    
    for (let j = 0; j < bubblePositions.length; j += step) {
      if (i === j || !tokens[j]?.metrics || !bubblePositions[j]) continue;

      const pos2 = bubblePositions[j];
      
      // Fast early distance check using squared distance
      const dx = pos2.x - pos.x;
      const dy = pos2.y - pos.y;
      const distanceSq = dx * dx + dy * dy;
      
      if (distanceSq > checkDistanceSq) continue;

      const size2 = calcBubbleSize(tokens[j]);
      const distance = Math.sqrt(distanceSq);
      const minDist = (bubbleSize + size2) / 2 + minDistance;

      if (distance < minDist && distance > 0.1) {
        const overlap = Math.min(1, (minDist - distance) / minDist);
        const force = repulsionStrength * overlap;
        const invDistance = 1 / distance;
        forceX -= dx * invDistance * force;
        forceY -= dy * invDistance * force;
      }
    }
    
    return [forceX, forceY];
  }

  // Core Logic Functions (adapted for runes)
  function initializePositions() {
    // Guard against running before container/tokens/dimensions are ready
    if (!containerElement || tokens.length === 0 || containerWidth === 0 || containerHeight === 0) {
        console.warn("Skipping initializePositions: prerequisites not met.", { hasContainer: !!containerElement, tokenCount: tokens.length, width: containerWidth, height: containerHeight });
        return;
    }

    const width = containerWidth;
    const height = containerHeight;
    const numTokens = tokens.length;
    
    // Adjust grid layout based on container aspect ratio
    const aspectRatio = width / height;
    const colToRowRatio = Math.sqrt(numTokens * aspectRatio);
    const cols = Math.ceil(Math.sqrt(numTokens * colToRowRatio));
    const rows = Math.ceil(numTokens / cols);

    const maxBubbleSize = Math.max(
      0,
      ...tokens.map((token) => calcBubbleSize(token))
    );

    const cellWidth = Math.max(maxBubbleSize * 1.2, width / cols);
    const cellHeight = Math.max(maxBubbleSize * 1.2, height / rows);
    const margin = maxBubbleSize / 2;
    const usableWidth = width - margin * 2;
    const usableHeight = height - margin * 2;

    // Assign directly to $state variable
    bubblePositions = tokens.map((_, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const randomAngle = Math.random() * Math.PI * 2;
      const randomRadius = Math.random() * cellWidth * 0.3;
      const offsetX = Math.cos(randomAngle) * randomRadius;
      const offsetY = Math.sin(randomAngle) * randomRadius;
      const baseX = margin + (usableWidth * (col + 0.5)) / cols;
      const baseY = margin + (usableHeight * (row + 0.5)) / rows;

      return {
        x: baseX + offsetX,
        y: baseY + offsetY,
        targetX: baseX + offsetX, // Initialize target to current position
        targetY: baseY + offsetY, // Initialize target to current position
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      };
    });

    isInitialized = true;
  }

  function updatePositions() {
    if (!bubblePositions.length || !tokens.length || bubblePositions.length !== tokens.length || isAnimationPaused) return;

    const currentTime = performance.now();
    
    // Skip frame if we're running too fast
    if (currentTime - lastUpdateTime < FRAME_TIME) {
      animationFrameId = requestAnimationFrame(updatePositions);
      return;
    }

    lastUpdateTime = currentTime;

    // Optimized constants for best performance
    const damping = 0.92;
    const repulsionStrength = 1.8;
    const maxSpeed = 4;
    const velocitySmoothing = 0.65;
    const baseFloatStrength = 0.03;
    
    // Scale minimum distance between bubbles based on screen size
    const screenSize = containerWidth && containerHeight ? Math.sqrt(containerWidth * containerHeight) : 0;
    const minDistance = screenSize > 0 
      ? Math.max(15, Math.min(35, 25 * (screenSize / 1200)))
      : 20;
    
    const floatStrength = screenSize > 0 
      ? baseFloatStrength * Math.max(0.8, Math.min(1.1, screenSize / 1200))
      : baseFloatStrength;
    
    const time = Date.now() / 1000;

    // Pre-calculate common values
    const boundaryForce = 0.6;

    for (let i = 0; i < bubblePositions.length; i++) {
      const pos = bubblePositions[i];
      if (!tokens[i]?.metrics) continue;
      
      const bubbleSize = calcBubbleSize(tokens[i]);
      const radius = bubbleSize / 2;
      const boundaryMargin = radius + 8;

      let forceX = 0;
      let forceY = 0;

      // Optimized floating motion
      const phase = i * 0.15;
      forceX += Math.sin(time * 0.4 + phase) * floatStrength;
      forceY += Math.cos(time * 0.25 + phase * 1.3) * floatStrength;

      // Target position transition
      if (pos.targetX !== undefined && pos.targetY !== undefined) {
        const dx = pos.targetX - pos.x;
        const dy = pos.targetY - pos.y;
        const distSq = dx * dx + dy * dy;
        
        if (distSq > 1.0) {
          const dist = Math.sqrt(distSq);
          const transitionSpeed = Math.min(0.06, 0.4 / dist);
          forceX += dx * transitionSpeed;
          forceY += dy * transitionSpeed;
        } else {
          pos.x = pos.targetX;
          pos.y = pos.targetY;
          pos.targetX = undefined;
          pos.targetY = undefined;
        }
      }

      // Use optimized repulsion calculation
      const [repulsionX, repulsionY] = calculateRepulsionForces(bubblePositions, tokens, i, bubbleSize, minDistance, repulsionStrength);
      forceX += repulsionX;
      forceY += repulsionY;

      // Boundary forces - optimized
      if (pos.x < boundaryMargin) {
        forceX += boundaryForce * (boundaryMargin - pos.x);
      } else if (pos.x > containerWidth - boundaryMargin) {
        forceX -= boundaryForce * (pos.x - (containerWidth - boundaryMargin));
      }
      
      if (pos.y < boundaryMargin) {
        forceY += boundaryForce * (boundaryMargin - pos.y);
      } else if (pos.y > containerHeight - boundaryMargin) {
        forceY -= boundaryForce * (pos.y - (containerHeight - boundaryMargin));
      }

      // Apply forces to velocity with smoothing
      pos.vx = pos.vx * velocitySmoothing + forceX * (1 - velocitySmoothing);
      pos.vy = pos.vy * velocitySmoothing + forceY * (1 - velocitySmoothing);

      // Apply damping
      pos.vx *= damping;
      pos.vy *= damping;

      // Limit speed
      const speedSq = pos.vx * pos.vx + pos.vy * pos.vy;
      if (speedSq > maxSpeed * maxSpeed) {
        const speed = Math.sqrt(speedSq);
        const factor = maxSpeed / speed;
        pos.vx *= factor;
        pos.vy *= factor;
      }

      // Update position
      pos.x += pos.vx;
      pos.y += pos.vy;

      // Direct DOM update for better performance
      if (pos.element) {
        pos.element.style.transform = `translate(${pos.x - radius}px, ${pos.y - radius}px)`;
      }
    }

    // Continue animation
    animationFrameId = requestAnimationFrame(updatePositions);
  }

  // Debounced loading for better performance
  let loadTokensTimeout: number | undefined;
  
  async function loadTokens() {
    loading = true;

    try {
      const response = await fetchTokens();
      const fetchedTokens = response.tokens
        .filter(
          (token) =>
            Number(token.metrics?.volume_24h) > 0 &&
            Number(token.metrics?.tvl) > 100,
        )
        .slice(0, maxTokens);

      // Check if the actual set of token addresses has changed
      const oldAddresses = new Set(tokens.map(t => t.address));
      const newAddresses = new Set(fetchedTokens.map((t: Token) => t.address));
      const setsAreEqual = oldAddresses.size === newAddresses.size && [...oldAddresses].every(addr => newAddresses.has(addr));

      if (!setsAreEqual || tokens.length === 0) {
        // If token set changed or it's the initial load, replace tokens and reset initialization
        tokens = fetchedTokens;
        isInitialized = false;
        // Clear potentially mismatched positions and cache
        bubblePositions = [];
        bubbleSizeCache.clear();
        error = null;
      } else {
        // Simply update token data, but preserve current positions
        tokens = tokens.map(oldToken => {
          const updatedTokenData = fetchedTokens.find(t => t.address === oldToken.address);
          return updatedTokenData ? { ...oldToken, metrics: updatedTokenData.metrics } : oldToken;
        });
        // Clear cache on data update to recalculate sizes
        bubbleSizeCache.clear();
        error = null;
      }

    } catch (e) {
      console.error("Error loading tokens:", e);
      error = "Failed to load token data";
    } finally {
      loading = false;
    }
  }

  // Pause/resume animation based on visibility
  function handleVisibilityChange() {
    if (typeof document !== 'undefined') {
      isAnimationPaused = document.hidden;
    }
  }

  // Keyboard shortcuts for accessibility
  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case ' ':
        // Space to pause/resume animation
        event.preventDefault();
        isAnimationPaused = !isAnimationPaused;
        break;
      case 'r':
        // R to refresh data
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          loadTokens();
        }
        break;
    }
  }


  // Effect for setup, teardown, and managing resize/intervals
  $effect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        const mobile = window.innerWidth < 768;
        if (isMobile !== mobile) isMobile = mobile;
        const newMaxTokens = mobile ? MAX_TOKENS_MOBILE : MAX_TOKENS_DESKTOP;
        if (maxTokens !== newMaxTokens) maxTokens = newMaxTokens;
      }
      if (containerElement) {
        const rect = containerElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            if (containerWidth !== rect.width) containerWidth = rect.width;
            if (containerHeight !== rect.height) containerHeight = rect.height;
        } else if (containerWidth !== 0 || containerHeight !== 0) {
            containerWidth = 0;
            containerHeight = 0;
        }
      }
    };

    handleResize(); // Initial call
    loadTokens(); // Initial load

    // Add event listeners
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("keydown", handleKeydown);
    
    // Optimized refresh interval
    const interval = setInterval(loadTokens, 30000);

    let resizeObserver: ResizeObserver | undefined;
    if (containerElement) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerElement);
    }

    // Cleanup function
    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("keydown", handleKeydown);
      resizeObserver?.disconnect();
      clearInterval(interval);
      if (loadTokensTimeout) clearTimeout(loadTokensTimeout);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = undefined;
      }
    };
  });

  // Effect for initializing positions and starting animation when conditions are met
  $effect(() => {
    // Check if we are ready to initialize *and* haven't initialized yet
    if (containerElement && tokens.length > 0 && containerWidth > 0 && containerHeight > 0 && !isInitialized) {
      initializePositions(); // This sets isInitialized = true

      // Start the animation loop *after* initialization
      if (animationFrameId) cancelAnimationFrame(animationFrameId); // Clear previous frame just in case
      animationFrameId = requestAnimationFrame(updatePositions);
    } else if (isInitialized && tokens.length > 0 && !animationFrameId && containerWidth > 0 && containerHeight > 0) {
        // If initialized, have tokens, but animation isn't running (e.g., after stopping), restart it.
        animationFrameId = requestAnimationFrame(updatePositions);
    } else if ((tokens.length === 0 || containerWidth === 0 || containerHeight === 0) && animationFrameId) {
        // If conditions to run animation are no longer met, stop it.
          cancelAnimationFrame(animationFrameId);
        animationFrameId = undefined;
    }
  });

  // Clean up cache periodically
  $effect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of bubbleSizeCache.entries()) {
        if (now - value.timestamp > CACHE_TTL * 2) {
          bubbleSizeCache.delete(key);
        }
      }
    }, CACHE_TTL);

    return () => clearInterval(cleanupInterval);
  });

  // Action to cache bubble element references
  function cacheBubbleElement(element: HTMLElement, params: { position: BubblePosition, index: number }) {
    if (params.position) {
      params.position.element = element;
    }
    
    return {
      destroy() {
        if (params.position) {
          params.position.element = undefined;
        }
      }
    };
  }
</script>

<svelte:head>
  <title>Market Bubbles - KongSwap</title>
</svelte:head>

<div class="bubbles-container" bind:this={containerElement}>
  <div class="controls-help">
    <div class="control-hint">Space: ⏸️ Pause/Resume</div>
    <div class="control-hint">Ctrl+R: 🔄 Refresh</div>
  </div>
  
  {#if loading && !tokens.length}
    <div class="loading">Loading tokens...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    {#each tokens as token, i}
      {@const bubbleSize = calcBubbleSize(token)}
      {@const logoSize = calcLogoSize(bubbleSize)}
      {@const fontSize = calcFontSize(bubbleSize)}
      {@const bubbleColor = getBubbleColor(token?.metrics?.price_change_24h)}
      {@const colorKey = getColorKey(token?.metrics?.price_change_24h)}
      {@const hoverColor = colorKey === "positive"
        ? "rgb(var(--accent-green-hover) / 0.8)"
        : colorKey === "negative"
          ? "rgb(var(--accent-red-hover) / 0.8)"
          : colorKey === "zero"
            ? "rgb(var(--bg-light) / 0.8)"
            : "rgb(var(--text-primary) / 0.8)"}
      {@const isHovered = hoveredToken === token.address}
      <div
        class="bubble-hitbox {isHovered ? 'bubble-hovered' : ''}"
        on:click={() => {
          goto(`/stats/${token.address}`);
        }}
        on:mouseenter={() => hoveredToken = token.address}
        on:mouseleave={() => hoveredToken = null}
        style="
          width: {bubbleSize}px;
          height: {bubbleSize}px;
          transform: translate(
            {(bubblePositions[i]?.x || 0) - bubbleSize / 2}px,
            {(bubblePositions[i]?.y || 0) - bubbleSize / 2}px
          );
        "
        use:cacheBubbleElement={{ position: bubblePositions[i], index: i }}
      >
        <div
          class="bubble"
          style="
            width: 100%;
            height: 100%;
            background-color: {bubbleColor};
            --hover-color: {hoverColor};
          "
        >
          <div class="token-label">
            {#if token?.logo_url}
              <img
                src={token.logo_url}
                alt={token.symbol}
                class="token-logo"
                loading="lazy"
                style="width: {logoSize}px; height: {logoSize}px;"
              />
            {/if}
            <span
              class="token-symbol"
              style={getSymbolStyle(token?.symbol, fontSize.symbolSize)}
              >{token?.symbol}</span
            >
            {#if token?.metrics?.price_change_24h != null}
              <span
                class="price-change"
                style="font-size: {fontSize.priceSize}rem;"
              >
                {typeof token.metrics.price_change_24h === "number"
                  ? token.metrics.price_change_24h.toFixed(2)
                  : parseFloat(token.metrics.price_change_24h).toFixed(2)}%
              </span>
            {/if}
          </div>
        </div>
        
        {#if isHovered}
        <div class="bubble-tooltip">
          <div class="tooltip-content">
            <div class="tooltip-row">
              <span class="tooltip-label">Volume:</span>
              <span class="tooltip-value">{formatCurrency(token?.metrics?.volume_24h)}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">TVL:</span>
              <span class="tooltip-value">{formatCurrency(token?.metrics?.tvl)}</span>
            </div>
            {#if token?.metrics?.price}
            <div class="tooltip-row">
              <span class="tooltip-label">Price:</span>
              <span class="tooltip-value">{formatCurrency(token?.metrics?.price)}</span>
            </div>
            {/if}
          </div>
        </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style scoped>
  .bubbles-container {
    position: relative;
    width: 100%;
    height: 85vh;
    overflow: hidden;
    /* Optimized for maximum performance */
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
    contain: layout style paint;
    /* Additional performance optimizations */
    -webkit-perspective: 1000px;
    perspective: 1000px;
    -webkit-transform-style: preserve-3d;
    transform-style: preserve-3d;
  }

  .bubble {
    position: absolute;
    border-radius: 50%;
    color: #fff;
    font-size: 0.9rem;
    text-align: center;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transform-origin: center center;
    /* Optimized for performance */
    will-change: transform;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    transform: translateZ(0);
    pointer-events: none; /* Hitbox handles pointer events */
    transition: transform 0.15s cubic-bezier(0.2, 0, 0.38, 0.9);
    /* Better font rendering */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    /* Improve paint performance */
    contain: layout style paint;
  }

  .bubble-hitbox {
    position: absolute;
    cursor: pointer;
    transform-origin: center center;
    will-change: transform;
    transition: transform 0.12s cubic-bezier(0.2, 0, 0.38, 0.9);
    z-index: 1; /* Base z-index for all bubbles */
    /* Performance optimizations */
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    transform: translateZ(0);
    contain: layout style;
  }

  /* Add new style for hovered bubbles */
  .bubble-hovered {
    z-index: 100 !important; /* Higher z-index when hovered */
  }

  .bubble-hitbox:hover .bubble {
    transform: scale(1.1);
    background-color: var(--hover-color) !important;
  }

  .token-label {
    max-width: 90%;
    /* Adjust padding for mobile */
    padding: clamp(0.15rem, 2vw, 0.25rem);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    will-change: transform;
    -webkit-font-smoothing: antialiased;
  }

  .token-logo {
    border-radius: 50%;
    margin-bottom: clamp(0.15em, 1.5vw, 0.25em);
    object-fit: contain;
  }

  .token-symbol {
    font-weight: bold;
    margin-bottom: clamp(0.1em, 1vw, 0.15em);
    line-height: 1;
    /* Prevent text wrapping */
    white-space: nowrap;
  }

  .price-change {
    opacity: 0.9;
    line-height: 1;
  }

  .bubble-tooltip {
    position: absolute;
    top: 105%;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgb(var(--bg-dark) / 0.95); /* More opaque background */
    border: 1px solid rgb(var(--border) / 0.8);
    border-radius: 8px;
    padding: calc(0.5rem + 0.2vw) calc(0.75rem + 0.3vw); /* Responsive padding */
    z-index: 1000;
    width: max-content;
    min-width: clamp(160px, 12vw, 220px); /* Responsive min-width */
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4); /* Stronger shadow */
    color: rgb(var(--text-primary));
    font-size: clamp(0.85rem, 0.75rem + 0.3vw, 1rem); /* Responsive font size */
    pointer-events: none;
    opacity: 0;
    animation: fadeIn 0.2s forwards;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translate(-50%, -10px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  .tooltip-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tooltip-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }

  .tooltip-label {
    color: rgb(var(--text-secondary));
    font-weight: 500;
  }

  .tooltip-value {
    color: rgb(var(--text-primary));
    font-weight: 600;
  }

  /* Add mobile-specific styles */
  @media (max-width: 768px) {
    .bubbles-container {
      height: 80vh; /* Slightly shorter on mobile */
    }

    .bubble-hitbox:hover .bubble {
      transform: none; /* Disable hover effect on mobile */
    }

    .bubble:active {
      transform: scale(1.05); /* Use active state instead of hover */
      background-color: var(--hover-color) !important;
    }
    
    .bubble-tooltip {
      display: none; /* Hide tooltips on mobile */
    }
    
    .controls-help {
      display: none; /* Hide keyboard controls on mobile */
    }
  }

  .loading,
  .error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 1.2rem;
    color: var(--text-color);
  }

  .error {
    color: var(--error-color);
  }


  .controls-help {
    position: absolute;
    bottom: 10px;
    left: 10px;
    z-index: 1000;
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }

  .controls-help:hover {
    opacity: 1;
  }

  .control-hint {
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    margin-bottom: 2px;
    backdrop-filter: blur(2px);
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .bubble,
    .bubble-hitbox {
      transition: none;
    }
    
    .performance-indicator {
      animation: none;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .bubble {
      border: 2px solid;
    }
    
    .bubble-tooltip {
      border-width: 2px;
    }
  }
</style>
