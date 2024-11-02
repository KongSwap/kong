<script lang="ts">
  import Clouds from "$lib/components/stats/Clouds.svelte";
  import { onMount } from "svelte";
  import { t } from "$lib/locales/translations";
  import { restoreWalletConnection } from "$lib/stores/walletStore";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import { currentEnvMode } from "$lib/utils/envUtils";
  import { switchLocale } from "$lib/stores/localeStore";
  import { poolStore } from "$lib/stores/poolStore";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";

  onMount(() => {
    switchLocale("en");
  });

  const initializeData = Promise.all([restoreWalletConnection(), poolStore.loadPools()])

</script>

<svelte:head>
  <title>
    {currentEnvMode() ? `[${currentEnvMode()}] KongSwap` : `KongSwap`} - {$t(
      "common.browserSubtitle",
    )}
  </title>
</svelte:head>

<Navbar />

{#await initializeData}
  <div class="min-h-[94vh] flex justify-center items-center">
    <LoadingIndicator />
  </div>
{:then}
  <main class="stats">
    <Clouds />
    <slot />
  </main>
{/await}

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
