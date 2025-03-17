<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
   import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  
  let tokens = [];
  let bubblePositions: Array<{ x: number; y: number; vx: number; vy: number }> =
    [];
  let containerWidth = 0;
  let containerHeight = 0;
  let containerElement: HTMLElement;
  let animationFrameId: number;
  let isInitialized = false;
  let isMobile = false;
  let maxTokens = 100;
  let cleanup: () => void;
  let loading = true;
  let error: string | null = null;

  // Watch for both container and tokens being ready
  $: if (containerElement && tokens.length > 0 && !isInitialized) {
    handleResize();
    updatePositions();
  }

  async function loadTokens() {
    try {
      loading = true;
      error = null;
      const response = await fetchTokens();
      const filteredTokens = response.tokens
        .filter(
          (token) =>
            Number(token.metrics?.volume_24h) > 0 &&
            Number(token.metrics?.tvl) > 100,
        )
        .slice(0, maxTokens);

      // Initialize on first load or when navigating to the page
      if (!tokens.length || bubblePositions.length === 0) {
        tokens = filteredTokens;
        if (containerElement) {
          initializePositions();
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
          updatePositions();
        }
      } else {
        // Update token data without resetting positions
        tokens = filteredTokens.map((newToken) => {
          const existingToken = tokens.find(t => t.address === newToken.address);
          return existingToken ? { ...existingToken, ...newToken } : newToken;
        });
        
        // Ensure animation is running
        if (!animationFrameId && isInitialized) {
          updatePositions();
        }
      }
    } catch (e) {
      console.error('Error loading tokens:', e);
      error = 'Failed to load token data';
    } finally {
      loading = false;
    }
  }

  function calcBubbleSize(changePercent: number | string | null | undefined) {
    const numericValue =
      typeof changePercent === "string"
        ? parseFloat(changePercent)
        : changePercent;
    const absVal = Math.abs(numericValue || 0);
    // Make bubbles smaller on mobile
    const baseSize = isMobile ? 70 : 100;
    return baseSize + absVal * (isMobile ? 2 : 3);
  }

  function getBubbleColor(changePercent: number | string | null | undefined) {
    const numericValue =
      typeof changePercent === "string"
        ? parseFloat(changePercent)
        : changePercent;
    if (!numericValue) return "rgb(var(--text-secondary) / 0.8)";
    return numericValue >= 0
      ? "rgb(var(--accent-green) / 0.8)"
      : "rgb(var(--accent-red) / 0.8)";
  }

  function initializePositions() {
    if (!containerElement || tokens.length === 0) return;

    const rect = containerElement.getBoundingClientRect();
    containerWidth = rect.width;
    containerHeight = rect.height;

    // Always reinitialize all positions when called
    const numTokens = tokens.length;
    const cols = Math.ceil(Math.sqrt(numTokens * 1.5));
    const rows = Math.ceil(numTokens / cols);

    const maxBubbleSize = Math.max(
      ...tokens.map((token) =>
        calcBubbleSize(token?.metrics?.price_change_24h),
      ),
    );

    const cellWidth = Math.max(maxBubbleSize * 1.2, containerWidth / cols);

    const margin = maxBubbleSize / 2;
    const usableWidth = containerWidth - margin * 2;
    const usableHeight = containerHeight - margin * 2;

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
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      };
    });

    isInitialized = true;
  }

  function updatePositions() {
    if (!bubblePositions.length || !tokens.length) return;
    
    const damping = 0.95; // Increased damping for smoother motion
    const repulsionStrength = 1.8; // Reduced repulsion strength
    const minDistance = 35; // Slightly increased minimum distance
    const boundaryStrength = 0.3; // Reduced boundary force
    const maxSpeed = 8; // Reduced max speed for smoother motion
    const velocitySmoothing = 0.7; // New parameter for velocity smoothing

    for (let i = 0; i < bubblePositions.length; i++) {
      const pos = bubblePositions[i];
      const size1 = calcBubbleSize(tokens[i].metrics?.price_change_24h);
      const radius = size1 / 2;

      // Store original velocity for smoothing
      const originalVx = pos.vx;
      const originalVy = pos.vy;

      // Reset velocity accumulation
      pos.vx = 0;
      pos.vy = 0;

      // Apply repulsion forces from other bubbles
      for (let j = 0; j < bubblePositions.length; j++) {
        if (i === j) continue;

        const pos2 = bubblePositions[j];
        const size2 = calcBubbleSize(tokens[j].metrics?.price_change_24h);
        const dx = pos2.x - pos.x;
        const dy = pos2.y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDist = (size1 + size2) / 2 + minDistance;

        if (distance < minDist && distance > 0) {
          // Smoother force scaling
          const overlap = Math.min(1, (minDist - distance) / minDist);
          const force = repulsionStrength * overlap;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          pos.vx -= fx;
          pos.vy -= fy;
        }
      }

      // Apply velocity smoothing
      pos.vx =
        pos.vx * (1 - velocitySmoothing) + originalVx * velocitySmoothing;
      pos.vy =
        pos.vy * (1 - velocitySmoothing) + originalVy * velocitySmoothing;

      // Smooth boundary handling
      const boundaryMargin = radius + 10;
      const boundaryForce = 0.9;

      if (pos.x < boundaryMargin) {
        pos.vx += boundaryForce * (boundaryMargin - pos.x);
      }
      if (pos.x > containerWidth - boundaryMargin) {
        pos.vx -= boundaryForce * (pos.x - (containerWidth - boundaryMargin));
      }
      if (pos.y < boundaryMargin) {
        pos.vy += boundaryForce * (boundaryMargin - pos.y);
      }
      if (pos.y > containerHeight - boundaryMargin) {
        pos.vy -= boundaryForce * (pos.y - (containerHeight - boundaryMargin));
      }

      // Apply damping
      pos.vx *= damping;
      pos.vy *= damping;

      // Limit speed
      const speed = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy);
      if (speed > maxSpeed) {
        pos.vx = (pos.vx / speed) * maxSpeed;
        pos.vy = (pos.vy / speed) * maxSpeed;
      }

      // Update position
      pos.x += pos.vx;
      pos.y += pos.vy;
    }

    // More lenient movement threshold
    const totalMovement = bubblePositions.reduce(
      (sum, pos) => sum + Math.abs(pos.vx) + Math.abs(pos.vy),
      0,
    );
    if (totalMovement > 0.008) {
      bubblePositions = [...bubblePositions];
      animationFrameId = requestAnimationFrame(updatePositions);
    }
  }

  function calcLogoSize(bubbleSize: number) {
    // Slightly larger logos on mobile for better visibility
    const scaleFactor = isMobile ? 0.4 : 0.35;
    return Math.max(20, bubbleSize * scaleFactor);
  }

  function calcFontSize(bubbleSize: number) {
    // Adjust font sizes for mobile and scale with bubble size more aggressively
    const mobileScale = isMobile ? 0.85 : 1;
    // More aggressive scaling for smaller bubbles
    const sizeScale = Math.pow(bubbleSize / 100, 0.8); // Non-linear scaling
    const symbolSize = Math.max(
      0.45,
      Math.min(1.1, bubbleSize * 0.06 * mobileScale * sizeScale),
    );
    const priceSize = Math.max(
      0.35,
      Math.min(0.9, bubbleSize * 0.045 * mobileScale * sizeScale),
    );
    return { symbolSize, priceSize };
  }

  // Add a style for long symbols
  function getSymbolStyle(symbol: string, fontSize: number) {
    // More aggressive reduction for long symbols
    if (symbol && symbol.length > 4) {
      const reductionFactor = Math.min(0.7, 0.9 - (symbol.length - 4) * 0.05); // Scales down more for longer symbols
      return `font-size: ${fontSize * reductionFactor}rem; letter-spacing: -0.5px;`;
    }
    return `font-size: ${fontSize}rem;`;
  }

  function handleResize() {
    if (typeof window !== "undefined") {
      isMobile = window.innerWidth < 768;
      maxTokens = isMobile ? 20 : 100;
      if (containerElement) {
        const rect = containerElement.getBoundingClientRect();
        containerWidth = rect.width;
        containerHeight = rect.height;
        
        // Only initialize positions if they haven't been initialized yet
        if (!isInitialized || bubblePositions.length === 0) {
          initializePositions();
        }
      }
    }
  }

  onMount(() => {
    handleResize();
    window.addEventListener("resize", handleResize);

    if (containerElement) {
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerElement);

      cleanup = () => {
        window.removeEventListener("resize", handleResize);
        resizeObserver.disconnect();
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        bubblePositions = [];
      };

      loadTokens();
      // Refresh data every 30 seconds
      const interval = setInterval(loadTokens, 30000);

      return () => {
        clearInterval(interval);
        cleanup();
      };
    }
  });

  // Add onDestroy to ensure cleanup runs
  onDestroy(() => {
    if (cleanup) cleanup();
  });
</script>

<svelte:head>
  <title>Market Bubbles - KongSwap</title>
</svelte:head>

<div class="bubbles-container" bind:this={containerElement}>
  {#if loading && !tokens.length}
    <div class="loading">Loading tokens...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    {#each tokens as token, i}
      {@const bubbleSize = calcBubbleSize(token?.metrics?.price_change_24h)}
      {@const logoSize = calcLogoSize(bubbleSize)}
      {@const fontSize = calcFontSize(bubbleSize)}
      {@const bubbleColor = getBubbleColor(token?.metrics?.price_change_24h)}
      {@const hoverColor = bubbleColor.includes('accent-green')
        ? "rgb(var(--accent-green-hover) / 0.8)"
        : bubbleColor.includes('accent-red')
          ? "rgb(var(--accent-red-hover) / 0.8)"
          : "rgb(var(--text-primary) / 0.8)"}
      <div
        class="bubble-hitbox"
        on:click={() => {
          goto(`/stats/${token.address}`);
        }}
        style="
          width: {bubbleSize}px;
          height: {bubbleSize}px;
          transform: translate(
            {(bubblePositions[i]?.x || 0) - bubbleSize / 2}px,
            {(bubblePositions[i]?.y || 0) - bubbleSize / 2}px
          );
        "
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
    /* Add touch handling for mobile */
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
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
    /* Add hardware acceleration */
    will-change: transform;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    /* Remove transition for smoother animation */
    pointer-events: none; /* Add to parent instead */
  }

  .bubble-hitbox {
    position: absolute;
    cursor: pointer;
    transform-origin: center center;
    will-change: transform;
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
  }

  .loading, .error {
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
</style>
