<script lang="ts">
  import "../app.css";
  import MetaTags from "$lib/components/common/MetaTags.svelte";
  import { themeStore } from "$lib/stores/themeStore";
  import type { LayoutData } from "./$types";
  import { onMount } from "svelte";
  
  export let data: LayoutData;


</script>


<div class="text-white flex flex-col items-center justify-center h-screen">
  TESTING
</div>

<slot />


<style>
  body {
    width: 100%;
    height: 100%;
    display: flex;
  }

  /* Ensure dialog portals work correctly when appended to body */
  body > div {
    position: relative;
    z-index: 10000;
  }

  /* Hide app until theme is ready */
  html:not([data-theme-ready="true"]) .app-content {
    visibility: hidden;
  }

  /* Simple loading indicator */
  .theme-loading {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-dark, #0d111f);
    z-index: 9999;
    opacity: 1;
    transition: opacity 0.2s ease-out;
  }

  html[data-theme-ready="true"] .theme-loading {
    opacity: 0;
    pointer-events: none;
  }

  /* Faster fade-out for loading spinner */
  @media (prefers-reduced-motion: no-preference) {
    html[data-theme-ready="true"] .theme-loading {
      animation: fadeOut 0.2s forwards;
    }

    @keyframes fadeOut {
      to {
        opacity: 0;
        visibility: hidden;
      }
    }
  }
</style>
