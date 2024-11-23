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
  let skylineUrl = $state("");
  let isChanging = $state(false);
  let scrollY = $state(0);
  let mouseX = $state(0);
  let mouseY = $state(0);

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
    skylineUrl = await assetCache.getAsset("/backgrounds/skyline.svg");
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

<div class="page-wrapper">
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
    <img 
      src={skylineUrl} 
      alt="" 
      class="skyline" 
      style="transform: translate3d({mouseX * 0.1}px, calc({Math.sin(scrollY * 0.002) * 5}px + {mouseY * 0.1}px), 0)"
    />
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
    -webkit-overflow-scrolling: touch;
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
  }

  @keyframes twinkle {
    0%, 100% {
      opacity: 0.2;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1);
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
