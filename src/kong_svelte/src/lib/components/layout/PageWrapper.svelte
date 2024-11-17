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

  let backgroundStyle = $derived.by(() => {
    if (!page) return "blue-bg";
    if (page.includes("pools")) {
        return `url(${poolsBgUrl})`;
    }
    if (page.includes("swap")) return `url(${jungleBgUrl})`;
    if (page.includes("stats")) return "#5bb2cf";
    return "blue-bg";
  });

  onMount(async () => {
    poolsBgUrl = await assetCache.getAsset("/backgrounds/pools.webp");
    jungleBgUrl = await assetCache.getAsset("/backgrounds/kong_jungle2.webp");
  });
</script>

<div
  class="page-wrapper"
  style={`background: ${backgroundStyle}; background-size: cover; background-position: center center;`}
>
  {@render children?.()}
</div>

<style scoped>
  .page-wrapper {
    min-height: 100vh;
    width: 100%;
    will-change: background-image;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .pools-bg {
    background: #5bb2cf var(--pools-bg-url) center/cover no-repeat;
    -webkit-background-size: cover;
    background-size: cover;
  }

  .jungle-bg {
    background: #5bb2cf var(--jungle-bg-url) center/cover no-repeat;
    -webkit-background-size: cover;
    background-size: cover;
  }

  .blue-bg {
    background: #5bb2cf;
  }
</style>
