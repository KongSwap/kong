<!-- PageWrapper.svelte -->
<script lang="ts">
  import type { Component } from "svelte";
  import { assetCache } from "$lib/services/assetCache";
  import { onMount } from "svelte";
  import { themeStore } from "$lib/stores/themeStore";
  import ModalContainer from "$lib/components/common/ModalContainer.svelte";
  import AccountDetails from "$lib/components/sidebar/AccountDetails.svelte";
    import { browser } from "$app/environment";

  let { page, children } = $props<{
    page?: string;
    children?: Component | (() => Component);
  }>();

  let poolsBgUrl = $state("");
  let jungleBgUrl = $state("");
  let isChanging = $state(false);

  let background = $derived.by(() => {
    if ($themeStore === 'modern') {
      return { 
        image: 'none',
        color: '#030407',
        gradient: 'none'
      };
    }

    const defaultBg = { image: 'none', color: '#5bb2cf', gradient: 'none' };
    if (!page) return defaultBg;
    
    if (page.includes("pools")) {
      return poolsBgUrl 
        ? { image: `url(${poolsBgUrl})`, color: '#5bb2cf', gradient: 'none' }
        : defaultBg;
    }
    if (page.includes("swap")) {
      return jungleBgUrl
        ? { image: `url(${jungleBgUrl})`, color: '#5bb2cf', gradient: 'none' }
        : defaultBg;
    }
    if (page.includes("stats")) return { image: 'none', color: '#5bb2cf', gradient: 'none' };
    return defaultBg;
  });

  $effect(() => {
    if (background) {
      isChanging = true;
      setTimeout(() => {
        isChanging = false;
      }, 200);
    }
  });

  onMount(async () => {
    if ($themeStore === 'pixel') {
      poolsBgUrl = await assetCache.getAsset("/backgrounds/pools.webp");
      jungleBgUrl = await assetCache.getAsset("/backgrounds/kong_jungle2.webp");
    }
  });

  let constellationCanvas;
  let ctx;
  let stars = [];
  let constellations = [];
  const MAX_CONNECTION_DISTANCE = 150; // Maximum distance for star connections
  
  onMount(() => {
    if (constellationCanvas) {
      ctx = constellationCanvas.getContext('2d', { alpha: true });
      ctx.imageSmoothingEnabled = true;
      if (ctx.webkitImageSmoothingEnabled) ctx.webkitImageSmoothingEnabled = true;
      
      initCanvas();
      generateStars();
      animate();
      
      window.addEventListener('resize', handleResize, { passive: true });
      
      return () => {
        window.removeEventListener('resize', handleResize);
        if (resizeTimeout) clearTimeout(resizeTimeout);
      };
    }
  });

  function initCanvas() {
    constellationCanvas.width = window.innerWidth;
    constellationCanvas.height = window.innerHeight;
    
    window.addEventListener('resize', handleResize);
  }

  function generateStars() {
    stars = [];
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * constellationCanvas.width,
        y: Math.random() * constellationCanvas.height,
        radius: Math.random() * 1 + 0.5,
        originalRadius: Math.random() * 1 + 0.5,
        brightness: Math.random() * 0.3 + 0.7,
        alpha: Math.random(),
        increasing: true
      });
    }
  }

  function findNearbyStars(star, count = 2) {
    return stars
      .filter(s => s !== star)
      .map(s => ({
        star: s,
        distance: Math.hypot(s.x - star.x, s.y - star.y)
      }))
      .filter(s => s.distance < MAX_CONNECTION_DISTANCE)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, count)
      .map(s => s.star);
  }

  function tryCreateConstellation() {
    if (constellations.length >= 3) return; // Limit active constellations
    
    const startStar = stars[Math.floor(Math.random() * stars.length)];
    const nearbyStars = findNearbyStars(startStar, 2);
    
    if (nearbyStars.length < 2) return;
    
    // Check if these stars form a good triangle
    const side1 = Math.hypot(nearbyStars[0].x - startStar.x, nearbyStars[0].y - startStar.y);
    const side2 = Math.hypot(nearbyStars[1].x - startStar.x, nearbyStars[1].y - startStar.y);
    const side3 = Math.hypot(nearbyStars[1].x - nearbyStars[0].x, nearbyStars[1].y - nearbyStars[0].y);
    
    // Check if triangle is relatively equilateral
    const avgSide = (side1 + side2 + side3) / 3;
    const variance = Math.max(Math.abs(side1 - avgSide), Math.abs(side2 - avgSide), Math.abs(side3 - avgSide));
    
    if (variance > avgSide * 0.3) return; // Skip if triangle is too irregular

    constellations.push({
      stars: [startStar, ...nearbyStars],
      alpha: 0,
      growing: true,
      lifeTime: 0,
      maxLife: Math.random() * 300 + 200
    });
  }

  // Add requestAnimationFrame polyfill
  const requestAnimFrame = (function() {
    if(browser) {
      return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function(callback) {
          window.setTimeout(callback, 1000 / 60);
        };
    }
  })();

  function animate() {
    ctx.clearRect(0, 0, constellationCanvas.width, constellationCanvas.height);
    
    // Animate stars
    stars.forEach(star => {
      star.alpha += star.increasing ? 0.005 : -0.005;
      
      if (star.alpha >= 1) {
        star.increasing = false;
      } else if (star.alpha <= 0.7) {
        star.increasing = true;
      }
      
      star.radius = star.originalRadius * (0.9 + star.alpha * 0.2);
      
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * star.brightness})`;
      ctx.fill();
    });

    // Animate constellations
    constellations = constellations.filter(constellation => {
      constellation.lifeTime++;
      
      if (constellation.growing) {
        constellation.alpha += 0.005;
        if (constellation.alpha >= 0.3) constellation.growing = false;
      } else {
        constellation.alpha -= 0.005;
      }

      if (constellation.lifeTime >= constellation.maxLife || constellation.alpha <= 0) return false;

      // Draw constellation lines
      ctx.beginPath();
      ctx.moveTo(constellation.stars[0].x, constellation.stars[0].y);
      constellation.stars.forEach(star => {
        ctx.lineTo(star.x, star.y);
      });
      ctx.closePath();
      ctx.strokeStyle = `rgba(255, 255, 255, ${constellation.alpha * 0.5})`;
      ctx.lineWidth = 0.3;
      ctx.stroke();

      return true;
    });

    // Randomly create new constellation
    if (Math.random() < 0.005) {
      tryCreateConstellation();
    }

    // Request next frame
    requestAnimFrame(() => animate());
  }

  let resizeTimeout;
  function handleResize() {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    resizeTimeout = setTimeout(() => {
      if (constellationCanvas) {
        constellationCanvas.width = window.innerWidth;
        constellationCanvas.height = window.innerHeight;
        generateStars();
      }
    }, 250);
  }
</script>

<div class="page-wrapper">
  <div class="background"></div>
  <div class="premium-overlay"></div>
  <div class="stars"></div>
  <div class="accent-light"></div>
  <canvas class="constellation-canvas" bind:this={constellationCanvas}></canvas>
  <div class="falling-stars">
    {#each Array(6) as _, i}
      <div 
        class="falling-star" 
        style="
          animation: fallingStar var(--duration) linear infinite;
          --duration: {6 + Math.random() * 4}s; 
          --trail-length: {120 + Math.random() * 40}px;
          --glow-width: {18 + Math.random() * 4}px;
          --glow-height: {1.2 + Math.random() * 0.6}px;
          top: {Math.random() * -20}%; 
          left: {60 + Math.random() * 40}%;
          animation-delay: {Math.random() * -20}s;"
      />
    {/each}
  </div>
  <div class="content">
    {#if $themeStore === 'modern'}
      <div class="background-gradient" />
      <div class="background-overlay" />
      <div class="edge-light" />
      <div class="nebula" />
      <div class="stars">
        {#each Array(50) as _, i}
          <div class="star" style="--delay: {Math.random() * 5}s; --top: {Math.random() * 100}%; --left: {Math.random() * 100}%" />
        {/each}
      </div>
      <div class="shooting-stars">
        {#each Array(5) as _, i}
          <div class="shooting-star" style="--delay: {Math.random() * 10}s; --top: {Math.random() * 50}%; --left: {Math.random() * 100}%" />
        {/each}
      </div>
    {/if}
    <slot />
  </div>
</div>

<ModalContainer />
<AccountDetails />

<style lang="postcss">
  .page-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #070a10;
    overflow-y: auto;
    z-index: 0;
    -webkit-overflow-scrolling: touch; /* iOS smooth scroll */
  }

  .background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: 
      /* Sophisticated base gradient */
      -webkit-radial-gradient(circle at 50% 50%, 
        rgba(18, 22, 33, 0.97) 0%,
        rgba(12, 15, 24, 0.98) 100%),
      -webkit-radial-gradient(circle at 20% 20%,
        rgba(88, 107, 164, 0.1) 0%,
        rgba(66, 89, 152, 0.07) 45%,
        transparent 100%),
      -webkit-radial-gradient(circle at 80% 80%,
        rgba(114, 135, 206, 0.1) 0%,
        rgba(92, 111, 177, 0.07) 45%,
        transparent 100%);
    background: 
      radial-gradient(circle at 50% 50%, 
        rgba(18, 22, 33, 0.97) 0%,
        rgba(12, 15, 24, 0.98) 100%),
      radial-gradient(circle at 20% 20%,
        rgba(88, 107, 164, 0.1) 0%,
        rgba(66, 89, 152, 0.07) 45%,
        transparent 100%),
      radial-gradient(circle at 80% 80%,
        rgba(114, 135, 206, 0.1) 0%,
        rgba(92, 111, 177, 0.07) 45%,
        transparent 100%);
    -webkit-animation: subtleBreathing 15s ease-in-out infinite;
    animation: subtleBreathing 15s ease-in-out infinite;
    will-change: transform, opacity; /* Performance optimization */
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
  }

  .falling-stars {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: hidden;
    -webkit-transform: translateZ(0);
    transform: translateZ(0); /* Force GPU acceleration */
  }

  .falling-star {
    position: absolute;
    width: 2px;
    height: 2px;
    background: #fff;
    border-radius: 50%;
    opacity: 0;
    -webkit-filter: blur(0.5px);
    filter: blur(0.5px);
    will-change: transform, opacity;
  }

  .falling-star::before {
    content: '';
    position: absolute;
    top: 50%;
    -webkit-transform: translateY(-50%);
    transform: translateY(-50%);
    width: var(--trail-length, 150px);
    height: 1px;
    background: -webkit-linear-gradient(left, 
      rgba(255, 255, 255, 0.9) 0%,
      rgba(255, 255, 255, 0.4) 30%,
      rgba(255, 255, 255, 0.2) 60%,
      transparent 100%);
    background: linear-gradient(90deg, 
      rgba(255, 255, 255, 0.9) 0%,
      rgba(255, 255, 255, 0.4) 30%,
      rgba(255, 255, 255, 0.2) 60%,
      transparent 100%);
    opacity: 0.6;
    right: 0;
  }

  .falling-star::after {
    content: '';
    position: absolute;
    top: 50%;
    -webkit-transform: translateY(-50%);
    transform: translateY(-50%);
    width: var(--glow-width, 20px);
    height: var(--glow-height, 1.5px);
    background: -webkit-radial-gradient(
      left,
      ellipse,
      rgba(255, 255, 255, 0.9) 0%,
      transparent 100%
    );
    background: radial-gradient(
      ellipse at left,
      rgba(255, 255, 255, 0.9) 0%,
      transparent 100%
    );
    left: -2px;
  }

  @-webkit-keyframes fallingStar {
    0% {
      opacity: 0;
      -webkit-transform: translateX(0) translateY(-100%);
    }
    5% {
      opacity: 1;
      -webkit-transform: translateX(-20%) translateY(-80%);
    }
    95% {
      opacity: 1;
      -webkit-transform: translateX(-80%) translateY(180%);
    }
    100% {
      opacity: 0;
      -webkit-transform: translateX(-100%) translateY(200%);
    }
  }

  @keyframes fallingStar {
    0% {
      opacity: 0;
      transform: translateX(0) translateY(-100%);
    }
    5% {
      opacity: 1;
      transform: translateX(-20%) translateY(-80%);
    }
    95% {
      opacity: 1;
      transform: translateX(-80%) translateY(180%);
    }
    100% {
      opacity: 0;
      transform: translateX(-100%) translateY(200%);
    }
  }

  .constellation-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
    opacity: 0.8;
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }

  /* Add these browser-specific animation keyframes for all animations */
  @-webkit-keyframes subtleBreathing {
    0%, 100% {
      opacity: 1;
      -webkit-transform: scale(1);
    }
    50% {
      opacity: 0.98;
      -webkit-transform: scale(1.02);
    }
  }

  @-webkit-keyframes subtleStarTwinkle {
    0%, 100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.6;
    }
  }

  @-webkit-keyframes crossFade {
    0% { opacity: 1; }
    50% { opacity: 0.95; }
    100% { opacity: 1; }
  }

  /* Add performance optimizations */
  .content {
    position: relative;
    z-index: 1;
    min-height: 100%;
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
    will-change: transform;
  }

  /* Add touch-action for better mobile handling */
  @media (hover: none) and (pointer: coarse) {
    .page-wrapper {
      touch-action: pan-y pinch-zoom;
    }
  }

  /* Add fallback for older browsers */
  @supports not (backdrop-filter: blur()) {
    .premium-overlay {
      background: rgba(255, 255, 255, 0.02);
    }
  }
</style>
