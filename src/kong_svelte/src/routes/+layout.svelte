<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { t } from "$lib/locales/translations";
  import { restoreWalletConnection } from "$lib/stores/walletStore";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import { currentEnvMode } from "$lib/utils/envUtils";
  import { switchLocale } from "$lib/stores/localeStore";

  onMount(async () => {
    switchLocale("en");
    Promise.all([restoreWalletConnection()]);
  });
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
    background: #000000 url("/backgrounds/kong_jungle.webp") no-repeat center
      center fixed;
    background-size: cover;
  }
</style>
