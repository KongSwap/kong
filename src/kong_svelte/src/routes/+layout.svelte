<script lang="ts">
  import "../app.css";
  import { themeStore } from "$lib/stores/themeStore";
  import { onMount } from "svelte";

  onMount(async () => {
    themeStore.initTheme();
  })
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