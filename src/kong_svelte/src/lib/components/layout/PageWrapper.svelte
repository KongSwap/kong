<!-- PageWrapper.svelte -->
<script lang="ts">
  import type { Component } from "svelte";
  import { assetCache } from "$lib/services/assetCache";
  import { onMount } from "svelte";

  let { page, children } = $props<{
    page?: string;
    children?: Component | (() => Component);
  }>();

  let poolsBgUrl = $state("");
  let jungleBgUrl = $state("");
  let isChanging = $state(false);

  let background = $derived.by(() => {
    const defaultBg = { image: 'none', color: '#5bb2cf' };
    if (!page) return defaultBg;
    
    if (page.includes("pools")) {
      return poolsBgUrl 
        ? { image: `url(${poolsBgUrl})`, color: '#5bb2cf' }
        : defaultBg;
    }
    if (page.includes("swap")) {
      return jungleBgUrl
        ? { image: `url(${jungleBgUrl})`, color: '#5bb2cf' }
        : defaultBg;
    }
    if (page.includes("stats")) return { image: 'none', color: '#5bb2cf' };
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
    poolsBgUrl = await assetCache.getAsset("/backgrounds/pools.webp");
    jungleBgUrl = await assetCache.getAsset("/backgrounds/kong_jungle2.webp");
  });
</script>

<div
  class="page-wrapper"
  class:changing={isChanging}
  style={`background-image: ${background.image}; background-color: ${background.color}`}
>
  {@render children?.()}
</div>

<style>
  .page-wrapper {
    min-height: 100vh;
    width: 100%;
    background-size: cover;
    background-position: center center;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
    opacity: 1;
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
