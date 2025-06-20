<script lang="ts">
  import "../app.css";
  import { app } from "$lib/state/app.state.svelte"
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  // Theme initialization happens automatically in the store

  const handleResize = () => {
    app.isMobile = browser && window.innerWidth < 768;
    app.navbarHeight = document.getElementById('navbar-section')?.offsetHeight || 0;
  };


  onMount(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  })


  let { children } = $props<{
    children: any;
  }>();

</script>

{@render children?.()}

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