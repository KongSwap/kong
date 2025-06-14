<script lang="ts">
  import "../app.css";
  import MetaTags from "$lib/components/common/MetaTags.svelte";
  import type { LayoutData } from "./$types";
  import { app } from "$lib/state/app.state.svelte";
  import { onMount } from "svelte";
  
  let { children, data } = $props<{
    children: any;
    data: LayoutData;
  }>();

  onMount(() => {
    const handleResize = () => app.isMobile = window.innerWidth < 768;
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  })

  // $inspect(app);
</script>

<svelte:head>
  <style>
    body {
      width: 100%;
      height: 100%;
      display: flex;
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
</svelte:head>

<MetaTags
  title={data.metadata.title}
  description={data.metadata.description}
  image={data.metadata.image}
  url={data.metadata.url}
/>

{@render children?.()}
