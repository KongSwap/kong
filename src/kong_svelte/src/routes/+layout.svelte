<script lang="ts">
  import "../app.css";
  import { themeStore } from "$lib/stores/themeStore";
  import { onMount } from "svelte";
  import { app } from "$lib/state/app.state.svelte";

  onMount(() => {
    themeStore.initTheme();

    const handleResize = () => app.isMobile = window.innerWidth < 768;
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  })

  // $inspect(app);
</script>

<slot />

<style>


  /* Faster fade-out for loading spinner */
  @media (prefers-reduced-motion: no-preference) {

    @keyframes fadeOut {
      to {
        opacity: 0;
        visibility: hidden;
      }
    }
  }
</style>