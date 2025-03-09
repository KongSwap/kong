<!-- PageWrapper.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  
  export let page: string;
  let mouseX = 0;
  let mouseY = 0;
  // No longer need starsMounted variable for static stars
  
  // Generate random positions for nebula gradients once
  const nebulaPositions = {
    blue: {
      x: 20 + Math.random() * 40, // 20-60%
      y: 10 + Math.random() * 30  // 10-40%
    },
    purple1: {
      x: 50 + Math.random() * 40, // 50-90%
      y: 40 + Math.random() * 40  // 40-80%
    },
    purple2: {
      x: 20 + Math.random() * 40, // 20-60%
      y: 50 + Math.random() * 40  // 50-90%
    },
    purple3: {
      x: 60 + Math.random() * 30, // 60-90%
      y: 10 + Math.random() * 40  // 10-50%
    }
  };

  // Add reactive declaration for competition page background
  $: isCompetition = page && page.includes('/competition/kong-madness');

  // Throttle mouse move handler to reduce calculations
  let ticking = false;
  function handleMouseMove(e: MouseEvent) {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        // Reduce movement amount and calculation frequency
        mouseX = (e.clientX / window.innerWidth - 0.5) * 10;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 10;
        ticking = false;
      });
      ticking = true;
    }
  }

  // Return to original star field with static stars (no falling animation)
  const starCount = 200; // Original star count 
  const starLayers = 5; // Original layer count for better parallax

  // COSMIC UPGRADE: Create star factory function for better performance
  const createStars = (count: number, layers: number) => {
    const stars = [];
    
    // Optimize by pre-computing layer assignments
    const layerCounts = new Array(layers).fill(Math.floor(count / layers));
    
    // Distribute remaining stars
    const remainder = count % layers;
    for (let i = 0; i < remainder; i++) {
      layerCounts[i]++;
    }
    
    // Create static stars for each layer (no falling animation)
    for (let layer = 0; layer < layers; layer++) {
      for (let i = 0; i < layerCounts[layer]; i++) {
        // Size scaling based on layer (farther stars are smaller)
        const baseSize = 0.6 + (Math.random() * 0.8);
        const layerFactor = 1 - (layer / layers * 0.5); // Deeper layers are smaller
        
        // Brightness based on size and layer
        const sizeFactor = baseSize / 2;
        const brightnessFactor = 0.3 + (Math.random() * 0.5) + (layer / layers * 0.2);
        
        // Static position - stars don't move vertically
        const top = Math.random() * 100;
        const left = Math.random() * 100;
        
        stars.push({
          size: baseSize * layerFactor * 2, // Size scaled by layer
          top: top, // Static position
          left: left, // Static position
          brightness: brightnessFactor * sizeFactor * 2.5,
          depth: layer,
          // Optimize by pre-calculating twinkle properties
          twinkle: Math.random() > 0.6, // 40% of stars twinkle
          twinkleSpeed: 2 + Math.random() * 4, // Random twinkle speed (2-6s)
          twinkleAmount: 0.3 + Math.random() * 0.5, // Random twinkle intensity
          // No animation delay needed for static stars
          delay: 0
        });
      }
    }
    
    return stars;
  };

  // COSMIC UPGRADE: Create stars with optimized distribution
  const stars = createStars(starCount, starLayers);
  
  // Return to original special stars count, but no falling animation
  const specialStars = Array(10).fill(0).map(() => {
    // Static position for special stars
    const top = Math.random() * 100;
    const left = Math.random() * 100;
    
    // Create more interesting color distribution - focus on blues, whites, and golds
    let hue;
    const colorType = Math.random();
    if (colorType < 0.4) {
      // Blue/cyan stars (180-240)
      hue = 180 + Math.random() * 60;
    } else if (colorType < 0.7) {
      // Gold/yellow stars (40-60)
      hue = 40 + Math.random() * 20;
    } else if (colorType < 0.9) {
      // White stars (represented by very low saturation in CSS)
      hue = 0; // Actual hue doesn't matter for white
    } else {
      // Occasional red/orange stars (0-30)
      hue = Math.random() * 30;
    }
    
    return {
      size: 2 + Math.random() * 2, // Larger special stars
      top: top, // Static position
      left: left, // Static position
      depth: Math.floor(Math.random() * 2), // Keep in front layers for visibility
      hue: hue,
      // Special stars with white option
      isWhite: colorType >= 0.7 && colorType < 0.9,
      brightness: 0.7 + Math.random() * 0.3,
      pulse: Math.random() > 0.4, // Most special stars pulse
      pulseSpeed: 3 + Math.random() * 5, // Random pulse speed
      delay: 0 // No animation delay needed for static stars
    };
  });
  
  // No need for starsMounted variable or setup since stars are static
  onMount(() => {
    // Nothing special to do on mount
  });
</script>

<svelte:window on:mousemove={handleMouseMove}/>

<div class="page-wrapper">
  <!-- Updated background based on page type -->
  {#if isCompetition}
    <div class="background-container custom"></div>
  {:else}
    <div class="background-container">
      <div class="dark-gradient"></div>
      <div 
        class="nebula-effect"
        style="
          transform: translate({mouseX * 0.2}px, {mouseY * 0.2}px);
          --blue-x: {nebulaPositions.blue.x}%;
          --blue-y: {nebulaPositions.blue.y}%;
          --purple1-x: {nebulaPositions.purple1.x}%;
          --purple1-y: {nebulaPositions.purple1.y}%;
          --purple2-x: {nebulaPositions.purple2.x}%;
          --purple2-y: {nebulaPositions.purple2.y}%;
          --purple3-x: {nebulaPositions.purple3.x}%;
          --purple3-y: {nebulaPositions.purple3.y}%;
        "
      ></div>
      
      <!-- COSMIC UPGRADE: Ultra-optimized 3D parallax stars with fly-in animation -->
      <div class="stars-container">
        {#each Array(starLayers) as _, layer}
          <div 
            class="stars-layer"
            style="
              transform: translate({mouseX * (0.05 + layer * 0.07)}px, {mouseY * (0.05 + layer * 0.07)}px);
              z-index: {layer};
            "
          >
            {#each stars.filter(star => star.depth === layer) as star}
              <div 
                class="star {star.twinkle ? 'twinkle' : ''}"
                style="
                  --size: {star.size}px;
                  --top: {star.top}%;
                  --left: {star.left}%;
                  --brightness: {star.brightness};
                  --depth: {layer};
                  --twinkle-speed: {star.twinkleSpeed}s;
                  --twinkle-amount: {star.twinkleAmount};
                "
              ></div>
            {/each}
          </div>
        {/each}
        
        <!-- COSMIC UPGRADE: Special stars layer (supergiants, colored stars) with fly-in -->
        <div 
          class="stars-layer special-stars-layer"
          style="transform: translate({mouseX * 0.1}px, {mouseY * 0.1}px);"
        >
          {#each specialStars as star}
            <div 
              class="special-star {star.pulse ? 'pulse' : ''}"
              style="
                --size: {star.size}px;
                --top: {star.top}%;
                --left: {star.left}%;
                --hue: {star.hue};
                --isWhite: {star.isWhite ? '0%' : '100%'};
                --brightness: {star.brightness};
                --pulse-speed: {star.pulseSpeed}s;
              "
            ></div>
          {/each}
        </div>
      </div>

      <!-- Add skyline with reduced animation -->
      <div class="skyline-wrapper">
        <img 
          src="/backgrounds/skyline.svg" 
          alt="Skyline" 
          class="skyline"
          style="transform: translate({mouseX * 0.05}px, 0)"
        />
      </div>
    </div>
  {/if}
  
  <div class="ticker-wrapper">
    <slot />
  </div>
  <div class="content-wrapper">
    <!-- Rest of the content -->
  </div>
  <div class="grass-silhouette" />
  <div class="tree-silhouette" />
</div>

<style lang="postcss">
  .page-wrapper {
    @apply flex flex-col w-full;
    min-height: 100vh;
    position: relative;
    z-index: 0;
  }

  /* Custom background for competition page */
  .background-container.custom {
    position: fixed;
    inset: 0;
    background: linear-gradient(90deg, #2a1b54 0%, #1a3a8f 100%);
    z-index: -1;
    will-change: transform; /* Optimize for GPU */
  }

  /* Background container for default pages */
  .background-container {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    will-change: transform; /* Optimize for GPU */
  }

  /* Dark theme gradient */
  .dark-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgb(2, 6, 23) 0%,
      rgb(10, 15, 35) 100%
    );
    opacity: 0;
    transition: opacity 0.5s ease;
  }

  /* Show dark gradient only in dark mode */
  :global(:root.dark) .dark-gradient {
    opacity: 1;
  }

  /* Nebula effect - optimized with fewer gradients */
  .nebula-effect {
    position: absolute;
    inset: 0;
    opacity: 0;
    filter: blur(80px); /* Reduced blur radius */
    background: 
      radial-gradient(
        circle at var(--blue-x) var(--blue-y),
        rgba(30, 64, 175, 0.6),
        transparent 60%
      ),
      radial-gradient(
        circle at var(--purple1-x) var(--purple1-y),
        rgba(147, 51, 234, 0.5),
        transparent 60%
      ),
      radial-gradient(
        circle at var(--purple3-x) var(--purple3-y),
        rgba(88, 28, 135, 0.5),
        transparent 55%
      );
    transition: opacity 0.5s ease;
    will-change: transform; /* Optimize for GPU */
  }

  /* Show nebula only in dark mode */
  :global(:root.dark) .nebula-effect {
    opacity: 0.15;
  }

  /* Light theme sky gradient */
  :global(:root:not(.dark)) .background-container::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg, 
      rgb(181, 218, 255) 0%,
      rgb(165, 199, 236) 85%,
      rgb(204, 221, 237) 100%
    );
  }

  .ticker-wrapper {
    @apply w-full;
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .content-wrapper {
    @apply flex-1;
  }

  /* Tree silhouette for light theme */
  :global(:root:not(.dark)) .tree-silhouette {
    position: fixed;
    bottom: 2rem;
    right: 10%;
    width: 200px;
    height: 300px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 160' preserveAspectRatio='none'%3E%3Cpath fill='%23436B35' d='M45,160 L55,160 L52,60 C52,60 45,50 50,30 C55,10 48,0 50,0 C52,0 45,10 50,30 C55,50 48,60 48,60 L45,160'/%3E%3Cpath fill='%235A8C47' d='M20,80 C20,40 50,20 50,20 C50,20 80,40 80,80 C80,120 50,110 50,110 C50,110 20,120 20,80 Z'/%3E%3Cpath fill='%236EA358' d='M30,60 C30,30 50,10 50,10 C50,10 70,30 70,60 C70,90 50,85 50,85 C50,85 30,90 30,60 Z'/%3E%3C/svg%3E");
    background-size: contain;
    background-repeat: no-repeat;
    background-position: bottom;
    pointer-events: none;
    z-index: 1;
  }

  /* Grass silhouette for light theme - simplified */
  :global(:root:not(.dark)) .grass-silhouette {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 180px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320' preserveAspectRatio='none'%3E%3Cpath fill='%2392C584' fill-opacity='0.2' d='M0,160 C120,160 180,110 240,110 C300,110 360,160 420,160 C480,160 540,110 600,110 C660,110 720,160 780,160 C840,160 900,110 960,110 C1020,110 1080,160 1140,160 C1200,160 1260,110 1320,110 C1380,110 1440,160 1440,160 L1440,320 L0,320 Z'/%3E%3Cpath fill='%2375B465' fill-opacity='0.3' d='M0,180 C60,180 120,140 180,140 C240,140 300,180 360,180 C420,180 480,140 540,140 C600,140 660,180 720,180 C780,180 840,140 900,140 C960,140 1020,180 1080,180 C1140,180 1200,140 1260,140 C1320,140 1380,180 1440,180 L1440,320 L0,320 Z'/%3E%3Cpath fill='%235AA349' fill-opacity='0.4' d='M0,220 C40,220 60,200 120,200 C180,200 240,220 300,220 C360,220 420,200 480,200 C540,200 600,220 660,220 C720,220 780,200 840,200 C900,200 960,220 1020,220 C1080,220 1140,200 1200,200 C1260,200 1320,220 1380,220 C1410,220 1430,200 1440,200 L1440,320 L0,320 Z'/%3E%3C/svg%3E");
    background-size: cover;
    background-position: center;
    pointer-events: none;
    z-index: 0;
  }

  /* Hide grass and tree silhouettes in dark theme */
  :global(:root.dark) .grass-silhouette,
  :global(:root.dark) .tree-silhouette {
    display: none;
  }

  /* COSMIC UPGRADE: Enhanced star styling with performance optimizations */
  .stars-container {
    position: absolute;
    inset: 0;
    z-index: 1;
    opacity: 0;
    transition: opacity 0.5s ease;
    perspective: 1000px; /* Add perspective for 3D effect */
    pointer-events: none; /* Optimization: Prevent mouse events */
    contain: strict; /* Optimization: Tell browser to isolate this element */
  }

  .stars-layer {
    position: absolute;
    inset: 0;
    will-change: transform; /* Optimization: Inform browser about transform */
    transform-style: preserve-3d; /* Maintain 3D space */
    backface-visibility: hidden; /* Optimization: Prevent repaints */
    contain: layout style paint; /* Optimization: Limit update scope */
  }

  .star {
    position: absolute;
    width: var(--size);
    height: var(--size);
    background: white;
    border-radius: 50%;
    top: var(--top);
    left: var(--left);
    opacity: var(--brightness);
    box-shadow: 0 0 calc(var(--size) * 0.8) rgba(255, 255, 255, 0.7); /* Original glow effect */
    transform: translateZ(calc(var(--depth) * 20px)); /* Original 3D depth */
    will-change: transform; /* Only transform will change with mouse movement */
  }

  /* Original twinkle animation */
  .star.twinkle {
    animation: twinkle var(--twinkle-speed) ease-in-out infinite;
  }

  @keyframes twinkle {
    0%, 100% { opacity: var(--brightness); }
    50% { opacity: calc(var(--brightness) * var(--twinkle-amount)); }
  }

  /* Original special stars styling - static with no animation */
  .special-star {
    position: absolute;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    top: var(--top);
    left: var(--left);
    opacity: var(--brightness);
    background: hsl(var(--hue), var(--isWhite, 100%), 80%);
    box-shadow: 
      0 0 calc(var(--size) * 0.5) hsl(var(--hue), var(--isWhite, 100%), 70%),
      0 0 calc(var(--size) * 1.2) hsl(var(--hue), var(--isWhite, 100%), 50%, 0.5);
    z-index: 10;
    will-change: transform; /* Only transform will change with mouse movement */
  }

  /* Original pulsing animation for special stars */
  .special-star.pulse {
    animation: pulse var(--pulse-speed) ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { 
      transform: scale(1);
      box-shadow: 
        0 0 calc(var(--size) * 0.5) hsl(var(--hue), var(--isWhite, 100%), 70%),
        0 0 calc(var(--size) * 1.2) hsl(var(--hue), var(--isWhite, 100%), 50%, 0.5);
    }
    50% { 
      transform: scale(1.2);
      box-shadow: 
        0 0 calc(var(--size) * 0.8) hsl(var(--hue), var(--isWhite, 100%), 70%),
        0 0 calc(var(--size) * 2) hsl(var(--hue), var(--isWhite, 100%), 50%, 0.7);
    }
  }

  /* Show elements in dark mode */
  :global(:root.dark) .stars-container {
    opacity: 1;
  }

  /* Remove old stars styling */
  .stars {
    display: none;
  }

  /* Skyline styling */
  .skyline-wrapper {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 30vh;
    z-index: 2;
    opacity: 0;
    transition: opacity 0.5s ease;
    will-change: transform; /* Optimize for GPU */
  }

  .skyline {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: bottom;
    will-change: transform; /* Optimize for GPU */
  }

  /* Show elements in dark mode */
  :global(:root.dark) .skyline-wrapper {
    opacity: 0.8;
  }

  /* Increase nebula opacity in dark mode */
  :global(:root.dark) .nebula-effect {
    opacity: 0.3;
  }
</style>
