<script lang="ts">
  import { goto } from "$app/navigation";
  import { fetchTokens } from "$lib/api/tokens/TokenApiClient";
  import * as THREE from 'three';

  // Types
  interface Token {
    address: string;
    symbol?: string; // Optional based on usage
    logo_url?: string; // Optional based on usage
    metrics?: { // Define known metrics, use any/unknown for others if needed
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
    targetX?: number; // Target X for smooth transitions
    targetY?: number; // Target Y for smooth transitions
    mesh?: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>; // Link to the Three.js mesh
  }

  // State
  let tokens = $state<Token[]>([]); // Use defined Token type
  let bubblePositions = $state<Array<BubblePosition>>([]); // Physics state + mesh reference
  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let containerElement = $state<HTMLElement | undefined>(undefined);
  let animationFrameId = $state<number | undefined>(undefined);
  let isInitialized = $state(false);
  let isMobile = $state(false);
  let maxTokens = $state(100);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let hoveredToken = $state<string | null>(null); // Track currently hovered token address

  // Three.js specific state
  let scene = $state<THREE.Scene | null>(null);
  let camera = $state<THREE.OrthographicCamera | null>(null);
  let renderer = $state<THREE.WebGLRenderer | null>(null);
  let materials = $state<Record<string, THREE.MeshBasicMaterial>>({});
  const bubbleGeometry = new THREE.CircleGeometry(0.5, 16); // Base geometry (radius 0.5), scale mesh later

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

  function calcBubbleSize(token: Token): number {
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
      
      // Target a specific density - adjust these values to change how filled the screen appears
      const desiredCoverage = 0.4; // 40% of screen covered by bubbles
      
      // Calculate ideal average bubble size for desired coverage
      // We divide by pi/4 because circles only cover ~78.5% of their bounding square
      const idealArea = (screenArea * desiredCoverage) / (tokenCount * (Math.PI / 4));
      const idealDiameter = Math.sqrt(idealArea);
      
      // Calculate minimum size based on screen dimensions
      const screenSize = Math.sqrt(screenArea);
      const minBaseSizeByScreen = screenSize * (isMobile ? 0.12 : 0.1); // Increased from 0.06 to 0.12 for mobile
      
      // Set bounds for minimum size
      const absoluteMinSize = isMobile ? 120 : 100; // Increased from 100 to 120 for mobile
      const minBaseSize = Math.max(absoluteMinSize, minBaseSizeByScreen);
      
      // Limit how large bubbles can get on very large screens or with few tokens
      const maxBaseDiameter = Math.min(220, screenSize * 0.15); // Max 15% of screen dimension, capped at 220px
      const baseSize = Math.min(maxBaseDiameter, Math.max(minBaseSize, idealDiameter * 0.65));
      
      // Use the calculated base size plus variation for price change
      return baseSize + absVal * (isMobile ? 2 : 3);
    }
    
    // Fallback to fixed size if container dimensions not available yet
    const baseSize = isMobile ? 70 : 100;
    return baseSize + absVal * (isMobile ? 2 : 3);
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

  function ensureMaterials() {
    // Only create if they don't exist
    if (Object.keys(materials).length === 0) {
      // Get colors from CSS variables using theme values
      let positiveColor = 0x00ff00; // Default green fallback
      let negativeColor = 0xff0000; // Default red fallback
      let neutralColor = 0x808080; // Default gray fallback
      let zeroColor = 0x101010; // Default dark fallback

      try {
          if (typeof getComputedStyle !== 'undefined') {
            const style = getComputedStyle(document.documentElement);
            // Use theme color variables from tailwind config
            positiveColor = new THREE.Color(style.getPropertyValue('--accent-green').trim() || 
                                          'rgb(var(--accent-green))').getHex();
            negativeColor = new THREE.Color(style.getPropertyValue('--accent-red').trim() || 
                                          'rgb(var(--accent-red))').getHex();
            neutralColor = new THREE.Color(style.getPropertyValue('--text-secondary').trim() || 
                                         'rgb(var(--text-secondary))').getHex();
            zeroColor = new THREE.Color(style.getPropertyValue('--bg-dark').trim() || 
                                      'rgb(var(--bg-dark))').getHex();
          }
      } catch (e) {
          console.warn("Could not parse CSS variables for theme colors, using defaults.", e);
      }

      materials = {
        positive: new THREE.MeshBasicMaterial({ color: positiveColor, transparent: true, opacity: 0.8 }),
        negative: new THREE.MeshBasicMaterial({ color: negativeColor, transparent: true, opacity: 0.8 }),
        neutral: new THREE.MeshBasicMaterial({ color: neutralColor, transparent: true, opacity: 0.8 }),
        zero: new THREE.MeshBasicMaterial({ color: zeroColor, transparent: true, opacity: 0.8 })
      };
    }
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
    if (!bubblePositions.length || !tokens.length || bubblePositions.length !== tokens.length) return;

    const damping = 0.95;
    const repulsionStrength = 2.2; // Increased from 1.5 for stronger repulsion
    
    // Scale minimum distance between bubbles based on screen size
    const screenSize = containerWidth && containerHeight ? Math.sqrt(containerWidth * containerHeight) : 0;
    const minDistance = screenSize > 0 
      ? Math.max(20, Math.min(40, 30 * (screenSize / 1200))) // Increased from 15-30px to 20-40px
      : 25; // Default increased from 20
    
    const maxSpeed = 5; // Reduced from 8 for gentler movement
    const velocitySmoothing = 0.7;
    
    // Scale float strength with screen size - larger screens get slightly more movement
    const baseFloatStrength = 0.05;
    const floatStrength = screenSize > 0 
      ? baseFloatStrength * Math.max(0.8, Math.min(1.2, screenSize / 1200))
      : baseFloatStrength;
    
    const time = Date.now() / 1000; // Current time in seconds for oscillation

    for (let i = 0; i < bubblePositions.length; i++) {
      const pos = bubblePositions[i];
      // Ensure token exists at this index, defensively
      if (!tokens[i]?.metrics) continue;
      
      const bubbleSize = calcBubbleSize(tokens[i]);
      const radius = bubbleSize / 2;

      let forceX = 0; // Accumulate forces
      let forceY = 0;

      // Add gentle floating motion using sine waves with offset based on index
      // This creates a more natural, continuous bubble-like movement
      const phase = i * 0.2; // Different phase for each bubble
      forceX += Math.sin(time * 0.5 + phase) * floatStrength;
      forceY += Math.cos(time * 0.3 + phase * 1.5) * floatStrength;

      // Smooth transition to target position if it exists and not too close already
      if (pos.targetX !== undefined && pos.targetY !== undefined) {
        const dx = pos.targetX - pos.x;
        const dy = pos.targetY - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Only apply transition force if we're not very close to target
        if (dist > 1.0) {
          // Use a weaker pull for large distances to prevent sudden jumps
          const transitionSpeed = Math.min(0.08, 0.5 / dist);
          forceX += dx * transitionSpeed;
          forceY += dy * transitionSpeed;
        } else {
          // If we're close enough, snap to target and clear it
          pos.x = pos.targetX;
          pos.y = pos.targetY;
          pos.targetX = undefined;
          pos.targetY = undefined;
        }
      }

      // Repulsion forces
      for (let j = 0; j < bubblePositions.length; j++) {
        if (i === j) continue;
        // Ensure token exists at this index, defensively
        if (!tokens[j]?.metrics || !bubblePositions[j]) continue;

        const pos2 = bubblePositions[j];
        const size2 = calcBubbleSize(tokens[j]);
        const dx = pos2.x - pos.x;
        const dy = pos2.y - pos.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        distance = Math.max(0.1, distance); // Prevent division by zero
        const minDist = (bubbleSize + size2) / 2 + minDistance;

        if (distance < minDist) {
          const overlap = Math.min(1, (minDist - distance) / minDist);
          const force = repulsionStrength * overlap * overlap; // squared overlap for stronger push at close distance
          forceX -= (dx / distance) * force;
          forceY -= (dy / distance) * force;
        }
      }

      // Boundary forces (smoother version)
      const boundaryMargin = radius + 10;
      const boundaryForce = 0.7; // Reduced from 0.9 for gentler boundary handling

      if (pos.x < boundaryMargin) {
        forceX += boundaryForce * (boundaryMargin - pos.x);
      }
      if (pos.x > containerWidth - boundaryMargin) {
        forceX -= boundaryForce * (pos.x - (containerWidth - boundaryMargin));
      }
      if (pos.y < boundaryMargin) {
        forceY += boundaryForce * (boundaryMargin - pos.y);
      }
      if (pos.y > containerHeight - boundaryMargin) {
        forceY -= boundaryForce * (pos.y - (containerHeight - boundaryMargin));
      }

      // Apply forces to velocity with smoothing
      pos.vx = pos.vx * velocitySmoothing + forceX * (1 - velocitySmoothing);
      pos.vy = pos.vy * velocitySmoothing + forceY * (1 - velocitySmoothing);

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

    // Always keep animation running for constant gentle movement
    animationFrameId = requestAnimationFrame(updatePositions);
  }

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
         // Use the current $state value of maxTokens
        .slice(0, maxTokens);

      // Check if the actual set of token addresses has changed
      const oldAddresses = new Set(tokens.map(t => t.address));
      const newAddresses = new Set(fetchedTokens.map((t: Token) => t.address)); // Add type hint
      const setsAreEqual = oldAddresses.size === newAddresses.size && [...oldAddresses].every(addr => newAddresses.has(addr));

      if (!setsAreEqual || tokens.length === 0) {
        // If token set changed or it's the initial load, replace tokens and reset initialization
        tokens = fetchedTokens;
        isInitialized = false; // This will trigger the initialization effect
        // Clear potentially mismatched positions
        bubblePositions = [];
        // Reset error state on successful load/reset
        error = null;
      } else {
        // Simply update token data, but preserve current positions
        tokens = tokens.map(oldToken => {
          const updatedTokenData = fetchedTokens.find(t => t.address === oldToken.address);
          // Merge metrics, keeping existing token object identity if possible
          return updatedTokenData ? { ...oldToken, metrics: updatedTokenData.metrics } : oldToken;
        });
        // Reset error state on successful update
        error = null;
      }

    } catch (e) {
      console.error("Error loading tokens:", e);
      error = "Failed to load token data";
       // Keep existing tokens on error? Or clear them? Current logic keeps them.
    } finally {
      loading = false;
    }
  }


  // Effect for setup, teardown, and managing resize/intervals
  $effect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        const mobile = window.innerWidth < 768;
        // Only update state if the value actually changed
        if (isMobile !== mobile) isMobile = mobile;
        const newMaxTokens = mobile ? 20 : 100;
        if (maxTokens !== newMaxTokens) maxTokens = newMaxTokens;
      }
      if (containerElement) {
        const rect = containerElement.getBoundingClientRect();
        // Prevent setting 0x0 dimensions initially if element isn't ready
        if (rect.width > 0 && rect.height > 0) {
            if (containerWidth !== rect.width) containerWidth = rect.width;
            if (containerHeight !== rect.height) containerHeight = rect.height;
        } else if (containerWidth !== 0 || containerHeight !== 0) {
            // If element becomes 0x0 (e.g., display:none), reset dimensions
            containerWidth = 0;
            containerHeight = 0;
        }
      }
    };

    handleResize(); // Initial call
    loadTokens(); // Initial load

    window.addEventListener("resize", handleResize);
    const interval = setInterval(loadTokens, 30000); // Refresh data

    let resizeObserver: ResizeObserver | undefined;
    if (containerElement) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerElement);
    }

    // Cleanup function
    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
      clearInterval(interval);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = undefined; // Reset state
      }
       // Do not reset state variables like tokens here, they persist across renders unless explicitly changed.
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

  // Remove onDestroy as cleanup is handled by $effect return function

  $effect(() => {
    if (!scene || !renderer || !isInitialized || !tokens.length || !bubblePositions.length || !Object.keys(materials).length) {
        // Clear scene if prerequisites lost (e.g., tokens cleared)
        if (scene && scene.children.length > 0) {
            while(scene.children.length > 0){ scene.remove(scene.children[0]); }
        }
    }
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
    /* Remove transition for smoother animation - already removed */
    pointer-events: none; /* Hitbox handles pointer events */
    transition: transform 0.2s ease-out;
  }

  .bubble-hitbox {
    position: absolute;
    cursor: pointer;
    transform-origin: center center;
    will-change: transform;
    transition: transform 0.15s ease-out;
    z-index: 1; /* Base z-index for all bubbles */
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
</style>
