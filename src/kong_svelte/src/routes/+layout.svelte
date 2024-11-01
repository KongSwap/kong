<script lang="ts">
  import "../app.css";
  import { t } from "$lib/locales/translations";
  import { onMount } from "svelte";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import { currentEnvMode } from "$lib/utils/envUtils";
  import Toast from "$lib/components/common/Toast.svelte";
  import { restoreWalletConnection } from "$lib/stores/walletStore";

  onMount(async () => {
    Promise.all([restoreWalletConnection()]);
  });
</script>

<div class="flex justify-center">
  <Navbar />
</div>

<Toast />

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
