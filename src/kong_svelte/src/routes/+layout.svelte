<script lang="ts">
  import "../app.css";
  import { t } from "$lib/locales/translations";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import { currentEnvMode } from "$lib/utils/envUtils";
</script>

<div class="flex justify-center">
  <Navbar />
</div>

<svelte:head>
  <title>
    {currentEnvMode() ? `[${currentEnvMode()}] KongSwap` : `KongSwap`} - {$t(
      "common.browserSubtitle",
    )}
  </title>
</svelte:head>

<slot />

<style scoped>
  :global(body) {
    background: #5BB2CF;
  }
</style>
