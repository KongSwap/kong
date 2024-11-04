<script lang="ts">
  import Clouds from "$lib/components/stats/Clouds.svelte";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
</script>

  <main class="stats">
    <Clouds />
    <slot />
  </main>

<div class="grass-background"></div>

<style scoped>
  .stats {
    background-color: #5bb2cf;
  }

  .grass-background {
    background-image: url("/backgrounds/grass.webp");
    background-repeat: repeat-x;
    background-size: 100% 100%;
    z-index: 10;
    width: 100%;
    height: 80px;
    min-height: 80px;
  }
</style>
