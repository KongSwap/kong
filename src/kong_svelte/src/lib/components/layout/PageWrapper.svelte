<!-- PageWrapper.svelte -->
<script lang="ts">
  import type { Component } from "svelte";
  import { assetCache } from "$lib/services/assetCache";
  import { onMount } from "svelte";
  import { themeStore } from "$lib/stores/themeStore";
  import ModalContainer from "$lib/components/common/ModalContainer.svelte";
  import AccountDetails from "$lib/components/sidebar/AccountDetails.svelte";

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
</script>

<div class="page-wrapper {$themeStore}" style:background-image={background.image} style:background-color={background.color}>
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

<ModalContainer />
<AccountDetails />

<style lang="postcss">
  .page-wrapper {
    min-height: 100vh;
    width: 100%;
    background-size: cover;
    background-position: center center;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
    opacity: 1;
  }

  .page-wrapper.modern {
    background: #030407;
    background-attachment: fixed;
    position: relative;
    min-height: 100vh;
    width: 100%;
    overflow-x: hidden;
  }

  .page-wrapper.modern::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 300px;
    background: linear-gradient(180deg, 
      rgba(3, 4, 7, 0.9) 0%,
      rgba(3, 4, 7, 0.6) 40%,
      rgba(3, 4, 7, 0) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  .page-wrapper.modern::after {
    content: '';
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 200px;
    background: linear-gradient(0deg, 
      rgba(3, 4, 7, 0.9) 0%,
      rgba(3, 4, 7, 0.6) 40%,
      rgba(3, 4, 7, 0) 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  .background-gradient {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 0% 0%, rgba(49, 46, 129, 0.08) 0%, transparent 55%),
      radial-gradient(circle at 100% 0%, rgba(55, 48, 163, 0.08) 0%, transparent 55%),
      radial-gradient(circle at 100% 100%, rgba(30, 58, 138, 0.08) 0%, transparent 55%),
      radial-gradient(circle at 0% 100%, rgba(67, 56, 202, 0.08) 0%, transparent 55%),
      linear-gradient(180deg, rgba(3, 4, 7, 0) 0%, rgba(3, 4, 7, 0.7) 100%);
    animation: midnightBreath 20s ease-in-out infinite;
  }

  .edge-light {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 0% 0%, rgba(199, 210, 254, 0.05) 0%, transparent 35%),
      radial-gradient(circle at 100% 0%, rgba(167, 243, 208, 0.05) 0%, transparent 35%),
      radial-gradient(circle at 100% 100%, rgba(253, 230, 138, 0.05) 0%, transparent 35%),
      radial-gradient(circle at 0% 100%, rgba(216, 180, 254, 0.05) 0%, transparent 35%);
    animation: edgeGlow 15s ease-in-out infinite alternate;
  }

  .nebula {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(ellipse at 30% 40%, rgba(49, 46, 129, 0.05) 0%, transparent 50%),
      radial-gradient(ellipse at 70% 60%, rgba(67, 56, 202, 0.05) 0%, transparent 50%);
    filter: blur(40px);
    animation: nebulaFloat 30s ease-in-out infinite alternate;
  }

  .background-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.15) 0%, transparent 80%),
      linear-gradient(180deg, rgba(15, 23, 42, 0.1) 0%, rgba(3, 4, 7, 0.1) 100%);
    opacity: 0.4;
    mix-blend-mode: soft-light;
  }

  .stars {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 1;
  }

  .star {
    position: absolute;
    width: 1px;
    height: 1px;
    background: white;
    border-radius: 50%;
    opacity: 0;
    box-shadow: 0 0 2px 1px rgba(255, 255, 255, 0.3);
    animation: midnightTwinkle 5s infinite;
    animation-delay: var(--delay);
    top: var(--top);
    left: var(--left);
  }

  .star:nth-child(3n) {
    width: 1.5px;
    height: 1.5px;
    box-shadow: 0 0 3px 1px rgba(255, 255, 255, 0.4);
  }

  .star:nth-child(7n) {
    box-shadow: 0 0 2px 1px rgba(148, 163, 184, 0.4);
  }

  .star:nth-child(13n) {
    box-shadow: 0 0 2px 1px rgba(226, 232, 240, 0.4);
  }

  .shooting-stars {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 2;
  }

  .shooting-star {
    position: absolute;
    top: var(--top);
    left: var(--left);
    width: 2px;
    height: 2px;
    background: white;
    border-radius: 50%;
    animation: shootingStar 4s linear infinite;
    animation-delay: var(--delay);
  }

  .shooting-star::before {
    content: '';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 50px;
    height: 1px;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.8) 0%, transparent 100%);
    opacity: 0;
  }

  @keyframes shootingStar {
    0% {
      transform: translate(0, 0) rotate(-45deg) scale(0);
      opacity: 0;
    }
    1% {
      transform: translate(0, 0) rotate(-45deg) scale(1);
      opacity: 1;
    }
    5% {
      transform: translate(-100px, 100px) rotate(-45deg) scale(1);
      opacity: 0;
    }
    100% {
      transform: translate(-100px, 100px) rotate(-45deg) scale(0);
      opacity: 0;
    }
  }

  @keyframes edgeGlow {
    0% {
      opacity: 0.5;
      transform: scale(1);
    }
    100% {
      opacity: 1;
      transform: scale(1.05);
    }
  }

  @keyframes nebulaFloat {
    0% {
      transform: translate(0, 0);
    }
    100% {
      transform: translate(-2%, 2%);
    }
  }

  @keyframes midnightBreath {
    0% {
      opacity: 0.92;
      transform: scale(1.02);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0.92;
      transform: scale(1.02);
    }
  }

  @keyframes midnightTwinkle {
    0% {
      opacity: 0;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(1.1);
    }
    100% {
      opacity: 0;
      transform: scale(1);
    }
  }

  .changing {
    animation: crossFade 0.2s ease;
  }

  @keyframes crossFade {
    0% { opacity: 1; }
    50% { opacity: 0.95; }
    100% { opacity: 1; }
  }
</style>
