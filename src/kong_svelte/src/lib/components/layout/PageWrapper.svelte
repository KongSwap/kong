<!-- PageWrapper.svelte -->
<script lang="ts">
  import type { Component } from "svelte";
  import { onMount } from "svelte";
  import { themeStore } from "$lib/stores/themeStore";
  import ModalContainer from "$lib/components/common/ModalContainer.svelte";
  import AccountDetails from "$lib/components/sidebar/AccountDetails.svelte";
  import { browser } from "$app/environment";
  import { fade } from "svelte/transition";
   
  let { page, children } = $props<{
    page?: string;
    children?: Component | (() => Component);
  }>();

  let isChanging = $state(false);
  let scrollY = $state(0);
  let mouseX = $state(0);
  let mouseY = $state(0);

  let background = $derived.by(() => {
    if ($themeStore === 'modern') {
      return { 
        image: 'none',
        color: '#020204',
        gradient: 'none'
      };
    }
    return { image: 'none', color: '#020204', gradient: 'none' };
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

  // Add more variety to nebula colors and sizes
  let nebulae = $state(Array(5).fill(null).map(() => ({
    top: 10 + Math.random() * 70,
    left: Math.random() * 100,
    scale: 0.8 + Math.random() * 1.2,
    hue: Math.random() * 80 + 190, // More blue-purple range
    opacity: 0.4 + Math.random() * 0.3
  })));
</script>

<div class="page-wrapper" in:fade={{ duration: 300 }}>
  {#if $themeStore === 'modern'}
    <div class="background"></div>
    
    <div class="nebula-container">
      {#each nebulae as nebula}
        <div 
          class="nebula"
          style="
            --top: {nebula.top}%;
            --left: {nebula.left}%;
            --scale: {nebula.scale};
            --hue: {nebula.hue};
            --opacity: {nebula.opacity};"
        />
      {/each}
    </div>

    <div class="stars">
      {#each Array(200) as _, i}
        <div 
          class="star"
          style="
            --size: {0.8 + Math.random() * 1.8}px;
            --top: {Math.random() * 100}%;
            --left: {Math.random() * 100}%;
            --brightness: {0.5 + Math.random() * 0.5};"
        />
      {/each}
    </div>

    <div class="skyline-wrapper">
        <img 
          src="/backgrounds/skyline.svg" 
          alt="Skyline" 
          class="skyline" 
          style="transform: translate({mouseX * 0.05}px, {mouseY * 0.05}px)"
        />
    </div>
  {/if}
  
  <div class="content">
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
    background: #0a0c14;
  }

  .background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at 50% 50%, 
      rgba(15, 18, 28, 0.99) 0%,
      rgba(8, 10, 18, 1) 100%
    );
    backdrop-filter: blur(100px);
  }

  .nebula-container {
    position: fixed;
    inset: 0;
    z-index: 1;
    pointer-events: none;
  }

  .nebula {
    position: absolute;
    width: 400px;
    height: 400px;
    top: var(--top);
    left: var(--left);
    transform: scale(var(--scale));
    background: radial-gradient(circle at center,
      hsla(var(--hue), 100%, 75%, 0.12) 0%,
      hsla(calc(var(--hue) + 20), 100%, 65%, 0.08) 30%,
      hsla(calc(var(--hue) + 40), 100%, 60%, 0.05) 50%,
      transparent 75%
    );
    filter: blur(40px);
    animation: nebula-pulse 15s ease-in-out infinite;
    opacity: var(--opacity);
  }

  @keyframes nebula-pulse {
    0%, 100% { opacity: var(--opacity); transform: scale(var(--scale)); }
    50% { opacity: calc(var(--opacity) * 1.3); transform: scale(calc(var(--scale) * 1.1)); }
  }

  .stars {
    position: fixed;
    inset: 0;
    z-index: 1;
  }

  .star {
    position: absolute;
    width: var(--size);
    height: var(--size);
    background: rgba(255, 255, 255, var(--brightness));
    border-radius: 50%;
    top: var(--top);
    left: var(--left);
    box-shadow: 
      0 0 4px rgba(255, 255, 255, calc(var(--brightness) * 0.5)),
      0 0 8px rgba(255, 255, 255, calc(var(--brightness) * 0.3));
  }

  .skyline-wrapper {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    z-index: 3;
  }

  .skyline {
    width: 100%;
    height: auto;
    max-height: 40vh;
    object-fit: cover;
    opacity: 0.9;
    transition: transform 0.2s ease-out;
  }

  .content {
    position: relative;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    z-index: 4;
  }

  .skyline-placeholder {
    width: 100%;
    height: 200px;
    background-color: #666;
  }
</style>
