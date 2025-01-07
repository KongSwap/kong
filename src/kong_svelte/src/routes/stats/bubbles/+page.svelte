<script lang="ts">
  import { onMount } from 'svelte';
  import { liveTokens } from '$lib/services/tokens/tokenStore';

  let tokens = [];
  let bubblePositions: Array<{ x: number; y: number; vx: number; vy: number }> = [];
  let containerWidth = 0;
  let containerHeight = 0;
  let containerElement: HTMLElement;
  let animationFrameId: number;
  let isInitialized = false;
  let isMobile = false;
  let maxTokens = 100;

  // Subscribe to liveTokens store
  $: {
    tokens = $liveTokens.filter(token => Number(token.metrics?.volume_24h) > 0 && Number(token.metrics?.tvl) > 100).slice(0, maxTokens);
    if (tokens.length > 0 && containerElement && !isInitialized) {
      isInitialized = true;
      initializePositions();
      updatePositions();
    }
  }

  function calcBubbleSize(changePercent: number | string | null | undefined) {
    const numericValue = typeof changePercent === 'string' ? parseFloat(changePercent) : changePercent;
    const absVal = Math.abs(numericValue || 0);
    // Make bubbles smaller on mobile
    const baseSize = isMobile ? 70 : 100;
    return baseSize + absVal * (isMobile ? 2 : 3);
  }

  function getBubbleColor(changePercent: number | string | null | undefined) {
    const numericValue = typeof changePercent === 'string' ? parseFloat(changePercent) : changePercent;
    if (!numericValue) return '#999';
    return numericValue >= 0 ? 'rgba(65, 184, 131, 0.8)' : 'rgba(219, 50, 54, 0.8)';
  }

  function initializePositions() {
    if (!containerElement) return;
    
    const rect = containerElement.getBoundingClientRect();
    containerWidth = rect.width;
    containerHeight = rect.height;

    // Only initialize positions for bubbles that don't already have positions
    if (bubblePositions.length < tokens.length) {
      // Calculate grid dimensions based on number of tokens
      const numTokens = tokens.length;
      const cols = Math.ceil(Math.sqrt(numTokens * 1.5)); // More columns for better spacing
      const rows = Math.ceil(numTokens / cols);
      
      // Calculate maximum bubble size for spacing
      const maxBubbleSize = Math.max(...tokens.map(token => 
        calcBubbleSize(token?.metrics?.price_change_24h)
      ));
      
      // Calculate cell size with margins, using maxBubbleSize
      const cellWidth = Math.max(maxBubbleSize * 1.2, containerWidth / cols);
      const cellHeight = Math.max(maxBubbleSize * 1.2, containerHeight / rows);

      // Calculate usable area (accounting for margins)
      const margin = maxBubbleSize / 2;
      const usableWidth = containerWidth - margin * 2;
      const usableHeight = containerHeight - margin * 2;

      bubblePositions = tokens.map((token, index) => {
        if (bubblePositions[index]) {
          return bubblePositions[index];
        }

        // Calculate grid position with offset
        const row = Math.floor(index / cols);
        const col = index % cols;

        // Add significant random offset
        const randomAngle = Math.random() * Math.PI * 2;
        const randomRadius = Math.random() * cellWidth * 0.3;
        const offsetX = Math.cos(randomAngle) * randomRadius;
        const offsetY = Math.sin(randomAngle) * randomRadius;

        // Base position with margins
        const baseX = margin + (usableWidth * (col + 0.5) / cols);
        const baseY = margin + (usableHeight * (row + 0.5) / rows);

        return {
          x: baseX + offsetX,
          y: baseY + offsetY,
          vx: (Math.random() - 0.5) * 2, // Add initial velocity
          vy: (Math.random() - 0.5) * 2
        };
      });
    }
  }

  function updatePositions() {
    const damping = 0.85; // Slightly less damping for more movement
    const repulsionStrength = 2.5; // Much stronger repulsion
    const minDistance = 30; // Larger minimum distance
    const boundaryStrength = 0.5;
    const maxSpeed = 12; // Higher max speed for quicker separation

    for (let i = 0; i < bubblePositions.length; i++) {
      const pos = bubblePositions[i];
      const size1 = calcBubbleSize(tokens[i].metrics?.price_change_24h);
      const radius = size1 / 2;
      
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
          // Stronger force when very close
          const overlap = 1 - distance / minDist;
          const force = repulsionStrength * Math.pow(overlap, 1.5); // More aggressive force scaling
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          // Immediate position adjustment for overlapping
          if (distance < (size1 + size2) / 2) {
            const correction = ((size1 + size2) / 2 - distance) * 0.5;
            pos.x -= (dx / distance) * correction;
            pos.y -= (dy / distance) * correction;
          }
          
          pos.vx -= fx;
          pos.vy -= fy;
        }
      }

      // Enforce hard boundaries with margin
      const margin = 20;
      if (pos.x < radius + margin) {
        pos.x = radius + margin;
        pos.vx = Math.abs(pos.vx) * boundaryStrength;
      }
      if (pos.x > containerWidth - radius - margin) {
        pos.x = containerWidth - radius - margin;
        pos.vx = -Math.abs(pos.vx) * boundaryStrength;
      }
      if (pos.y < radius + margin) {
        pos.y = radius + margin;
        pos.vy = Math.abs(pos.vy) * boundaryStrength;
      }
      if (pos.y > containerHeight - radius - margin) {
        pos.y = containerHeight - radius - margin;
        pos.vy = -Math.abs(pos.vy) * boundaryStrength;
      }

      // Add friction
      pos.vx *= damping;
      pos.vy *= damping;

      // Update positions with lower max speed
      const speed = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy);
      if (speed > maxSpeed) {
        pos.vx = (pos.vx / speed) * maxSpeed;
        pos.vy = (pos.vy / speed) * maxSpeed;
      }

      pos.x += pos.vx;
      pos.y += pos.vy;
    }

    // More sensitive movement threshold
    const totalMovement = bubblePositions.reduce((sum, pos) => sum + Math.abs(pos.vx) + Math.abs(pos.vy), 0);
    if (totalMovement > 0.005) {
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
    const symbolSize = Math.max(0.45, Math.min(1.1, bubbleSize * 0.06 * mobileScale * sizeScale));
    const priceSize = Math.max(0.35, Math.min(0.9, bubbleSize * 0.045 * mobileScale * sizeScale));
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
    if (typeof window !== 'undefined') {
      isMobile = window.innerWidth < 768;
      maxTokens = isMobile ? 20 : 100;
      if (containerElement) {
        const rect = containerElement.getBoundingClientRect();
        containerWidth = rect.width;
        containerHeight = rect.height;
        initializePositions();
      }
    }
  }

  onMount(() => {
    handleResize();
    window.addEventListener('resize', handleResize);

    if (containerElement) {
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerElement);

      return () => {
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      };
    }
  });
</script>

<style>
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
    }
  }
</style>

<div class="bubbles-container" bind:this={containerElement}>
  {#each tokens as token, i}
    {@const bubbleSize = calcBubbleSize(token?.metrics?.price_change_24h)}
    {@const logoSize = calcLogoSize(bubbleSize)}
    {@const fontSize = calcFontSize(bubbleSize)}
    <div
      class="bubble-hitbox"
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
          background-color: {getBubbleColor(token?.metrics?.price_change_24h)};
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
          >{token?.symbol}</span>
          {#if token?.metrics?.price_change_24h != null}
            <span 
              class="price-change"
              style="font-size: {fontSize.priceSize}rem;"
            >
              {typeof token.metrics.price_change_24h === 'number' 
                ? token.metrics.price_change_24h.toFixed(2) 
                : parseFloat(token.metrics.price_change_24h).toFixed(2)}%
            </span>
          {/if}
        </div>
      </div>
    </div>
  {/each}
</div>
