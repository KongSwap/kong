<!-- PageWrapper.svelte -->
<script lang="ts">
  import type { Component } from "svelte";
  import { assetCache } from "$lib/services/assetCache";
  import { onMount } from "svelte";
  import { themeStore } from "$lib/stores/themeStore";
  import ModalContainer from "$lib/components/common/ModalContainer.svelte";
  import AccountDetails from "$lib/components/sidebar/AccountDetails.svelte";
  import { browser } from "$app/environment";
  import Clouds from "../stats/Clouds.svelte";
  import { updateWorkerService } from "$lib/services/updateWorkerService";

  let { page, children } = $props<{
    page?: string;
    children?: Component | (() => Component);
  }>();

  function tvIn(node: HTMLElement, { 
    duration = 250,
    delay = 0
  }) {
    return {
      delay,
      duration,
      css: (t: number, u: number) => {
        // Start from a line and expand
        const scaleY = Math.min(1, Math.pow(t * 1.2, 2));
        const brightness = 0.7 + (t * 0.3);
        // Increased static during transition
        const staticAmount = t < 0.9 ? Math.min(1, (1 - t) * 3) : 0;
        const blur = t < 0.9 ? (1 - t) * 2 : 0;
        
        // Add stronger jitter during the transition
        const jitterX = t < 0.9 ? (Math.random() - 0.5) * 20 * (1 - t) : 0;
        const jitterY = t < 0.9 ? (Math.random() - 0.5) * 20 * (1 - t) : 0;
        const rotation = t < 0.9 ? (Math.random() - 0.5) * 4 * (1 - t) : 0;
        
        node.style.setProperty('--static-amount', String(staticAmount));
        node.style.setProperty('--blur-amount', `${blur}px`);
        
        return `
          transform: 
            scale(1, ${scaleY})
            translate(${jitterX}px, ${jitterY}px)
            rotate(${rotation}deg);
          transform-origin: center;
          opacity: ${t};
          filter: blur(var(--blur-amount));
        `;
      }
    };
  }

  let isChanging = $state(false);
  let scrollY = $state(0);
  let mouseX = $state(0);
  let mouseY = $state(0);
  let skylineUrl = $state("");
  let skylineError = $state(false);

  let background = $derived.by(() => {
    if ($themeStore === 'modern') {
      return { 
        image: 'none',
        color: '#030407',
        gradient: 'none'
      };
    }

    // Pixel theme always uses the gradient background
    if ($themeStore === 'pixel') {
      return { 
        image: 'none', 
        color: '#5bb2cf',
        gradient: `linear-gradient(180deg, 
          #a7e3ff 0%, 
          #87CEEB 35%, 
          #5bb2cf 100%)`
      };
    }

    return { image: 'none', color: '#030407', gradient: 'none' };
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
    try {
      // Try to preload the skyline asset
      skylineUrl = await updateWorkerService.preloadAsset("/backgrounds/skyline.svg");
    } catch (error) {
      console.error("Failed to preload skyline.svg in PageWrapper:", error);
      skylineError = true;
      skylineUrl = "/backgrounds/fallback-skyline.svg";
    }

    if (browser) {
      window.addEventListener('scroll', () => {
        scrollY = window.scrollY;
      }, { passive: true });
      window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 20;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 20;
      }, { passive: true });
    }
  });
</script>

<div class="page-wrapper" in:tvIn={{ duration: 300 }}>
  {#if $themeStore === 'modern'}
    <div class="background"></div>
    <div class="night-sky">
      {#each Array(100) as _, i}
        <div 
          class="star-particle"
          style="
            --size: {1 + Math.random() * 2}px;
            --top: {Math.random() * 100}%;
            --left: {Math.random() * 100}%;
            --delay: {Math.random() * 5}s;
            --duration: {3 + Math.random() * 4}s;"
        />
      {/each}
    </div>
    <div class="premium-overlay"></div>
    <div class="stars"></div>
    <div class="accent-light"></div>
    <div class="skyline-container">
      <div class="city-lights"></div>
      <div class="glow-effect" style="transform: translate({mouseX * 0.05}px, {mouseY * 0.05}px)"></div>
      {#if !skylineError}
        <img 
          src={skylineUrl} 
          alt="Skyline" 
          class="skyline" 
          style="transform: translate3d({mouseX * 0.1}px, calc({Math.sin(scrollY * 0.002) * 5}px + {mouseY * 0.1}px), 0)"
        />
      {:else}
        <div class="skyline-placeholder"></div>
      {/if}
    </div>
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
  {:else}
    <div 
      class="pixel-background" 
      style:background={background.gradient}
    >
      <div class="floating-pixels">
        {#each Array(15) as _, i}
          <div 
            class="pixel-square"
            style="
              --delay: {Math.random() * 5}s;
              --duration: {4 + Math.random() * 3}s;
              --top: {Math.random() * 100}%;
              --left: {Math.random() * 100}%;
              --size: {8 + Math.random() * 12}px;
              --hue: {180 + Math.random() * 40};"
          />
        {/each}
      </div>
    </div>
    {#if $themeStore === 'pixel'}
      <Clouds/>
    {/if}
  {/if}
  
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
    {@render children()}
  </div>
</div>

<ModalContainer />
<AccountDetails />

<style scoped lang="postcss">
  .page-wrapper {
    position: fixed;
    inset: 0;
    width: 100%;
    overflow: hidden;
    z-index: 0;
    background: #070a10;
  }

  .page-wrapper::before {
    content: "";
    position: fixed;
    top: -50%;
    left: -50%;
    width: 200vw;
    height: 200vh;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise' x='0' y='0'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.8' numOctaves='5' stitchTiles='stitch' result='noise'/%3E%3CfeColorMatrix type='saturate' values='0' in='noise' result='noiseGray'/%3E%3CfeBlend mode='overlay' in='noiseGray' in2='noiseGray' result='noiseFinal'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.6'/%3E%3C/svg%3E"),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain' x='0' y='0'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='3' numOctaves='4' stitchTiles='stitch' result='grain'/%3E%3CfeColorMatrix type='saturate' values='0' in='grain' result='grainGray'/%3E%3CfeBlend mode='multiply' in='grainGray' in2='grainGray' result='grainFinal'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)' opacity='0.4'/%3E%3C/svg%3E");
    background-size: 100px 100px, 150px 150px;
    animation: staticNoise 0.016s steps(1) infinite;
    opacity: var(--static-amount, 0);
    pointer-events: none;
    mix-blend-mode: screen;
    z-index: 9998;
  }

  @keyframes staticNoise {
    0% { transform: translate(0, 0) scale(1); }
    10% { transform: translate(-12px, 8px) scale(1.03); }
    20% { transform: translate(8px, -15px) scale(0.97); }
    30% { transform: translate(-15px, 10px) scale(1.02); }
    40% { transform: translate(10px, -8px) scale(0.98); }
    50% { transform: translate(-12px, 15px) scale(1.03); }
    60% { transform: translate(15px, -12px) scale(0.97); }
    70% { transform: translate(-8px, 12px) scale(1.02); }
    80% { transform: translate(12px, -15px) scale(0.98); }
    90% { transform: translate(-15px, 8px) scale(1.03); }
    100% { transform: translate(0, 0) scale(1); }
  }

  .page-wrapper::after {
    content: "";
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(255, 255, 255, 0.2) 50%,
      transparent 51%
    );
    background-size: 100% 8px;
    animation: scanlines 0.05s linear infinite;
    pointer-events: none;
    opacity: var(--static-amount, 0);
    mix-blend-mode: overlay;
    z-index: 9997;
  }

  @keyframes scanlines {
    0% { transform: translateY(0); }
    100% { transform: translateY(8px); }
  }

  .pixel-background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    overflow: hidden;
    image-rendering: pixelated;
    background-color: #5bb2cf;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }

  .pixel-background::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at 50% 150%, 
      rgba(255, 255, 255, 0.15) 0%,
      transparent 70%
    );
    pointer-events: none;
  }

  .pixel-background::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent 0%,
      rgba(255, 255, 255, 0.03) 50%,
      transparent 100%
    );
    background-size: 100% 4px;
    pointer-events: none;
    opacity: 0.5;
  }

  .retro-overlay {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(0deg, 
        rgba(255, 255, 255, 0.1) 0%, 
        transparent 10%
      ),
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(255, 255, 255, 0.05) 2px,
        rgba(255, 255, 255, 0.05) 4px
      );
    mix-blend-mode: overlay;
    pointer-events: none;
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        90deg,
        rgba(0, 0, 0, 0.1),
        rgba(0, 0, 0, 0.1) 1px,
        transparent 1px,
        transparent 4px
      );
      animation: scanline 10s linear infinite;
      opacity: 0.3;
    }
  }

  @keyframes scanline {
    0% {
      transform: translateY(-100%);
    }
    100% {
      transform: translateY(100%);
    }
  }

  .floating-pixels {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .pixel-square {
    position: absolute;
    width: var(--size);
    height: var(--size);
    background: hsla(var(--hue), 80%, 75%, 0.3);
    top: var(--top);
    left: var(--left);
    animation: floatPixel var(--duration) ease-in-out infinite;
    animation-delay: var(--delay);
    box-shadow: 
      inset 0 0 2px rgba(255, 255, 255, 0.6),
      0 0 4px rgba(255, 255, 255, 0.2);
    image-rendering: pixelated;
  }

  @keyframes floatPixel {
    0%, 100% {
      transform: translate(0, 0) rotate(0deg);
    }
    50% {
      transform: translate(20px, -20px) rotate(90deg);
    }
  }

  .background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
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
    animation: subtleBreathing 15s ease-in-out infinite;
    will-change: transform, opacity;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
  }

  .night-sky {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: 
      radial-gradient(circle at 50% 0%, 
        rgba(61, 85, 255, 0.1) 0%,
        transparent 50%),
      radial-gradient(circle at 80% 20%, 
        rgba(120, 0, 255, 0.05) 0%,
        transparent 50%);
    pointer-events: none;
    z-index: 1;
  }

  .star-particle {
    position: absolute;
    width: var(--size);
    height: var(--size);
    background: #fff;
    border-radius: 50%;
    top: var(--top);
    left: var(--left);
    animation: twinkle var(--duration) ease-in-out infinite;
    animation-delay: var(--delay);
    will-change: opacity, transform;
    transform-style: preserve-3d;
    box-shadow: 0 0 2px #fff;
    opacity: 0;
  }

  @keyframes twinkle {
    0%, 100% {
      opacity: 0.2;
      transform: scale(0.8) translateZ(0);
    }
    50% {
      opacity: 1;
      transform: scale(1) translateZ(0);
    }
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
    transform: translateZ(0);
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

  .skyline-container {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    z-index: 1;
  }

  @keyframes cityLightsPulse {
    0%, 100% {
      opacity: 0.8;
      filter: blur(1px) brightness(1);
    }
    50% {
      opacity: 1;
      filter: blur(1.5px) brightness(1.2);
    }
  }

  .glow-effect {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: 
      linear-gradient(to bottom,
        transparent 0%,
        rgba(88, 107, 164, 0.08) 40%,
        rgba(114, 135, 206, 0.12) 70%,
        rgba(147, 168, 255, 0.18) 100%
      ),
      radial-gradient(
        circle at 50% 100%,
        rgba(147, 168, 255, 0.25) 0%,
        transparent 70%
      );
    animation: glowPulse 8s ease-in-out infinite;
    pointer-events: none;
    mix-blend-mode: screen;
    transition: transform 0.2s ease-out;
  }

  @keyframes glowPulse {
    0%, 100% {
      opacity: 0.7;
      filter: blur(20px) brightness(1);
    }
    50% {
      opacity: 0.9;
      filter: blur(25px) brightness(1.2);
    }
  }

  .skyline {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: translateZ(0);
    will-change: transform;
    opacity: 0.9;
    animation: floatSkyline 15s ease-in-out infinite;
    filter: 
      drop-shadow(0 0 10px rgba(88, 107, 164, 0.3))
      drop-shadow(0 0 20px rgba(147, 168, 255, 0.1));
    transition: transform 0.2s ease-out;
  }

  @keyframes floatSkyline {
    0%, 100% {
      transform: translateY(0) rotate3d(1, 0, 0, 0deg);
    }
    50% {
      transform: translateY(-5px) rotate3d(1, 0, 0, 0.5deg);
    }
  }

  .content {
    position: relative;
    flex: 1;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    z-index: 2;
  }

  :global(.clouds-container) {
    z-index: 1;
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

  .skyline-placeholder {
    width: 100%;
    height: 200px;
    background-color: #ccc;
  }
</style>
