<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { t } from "$lib/locales/translations";
  import { currentEnvMode } from "$lib/utils/envUtils";
  import { restoreWalletConnection } from "$lib/stores/walletStore";
  import { switchLocale } from "$lib/stores/localeStore";
  import { tokenStore } from "$lib/stores/tokenStore";
  import { poolStore } from "$lib/stores/poolStore";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";

  const initializeData = Promise.all([tokenStore.loadTokens(), poolStore.loadPools()]);
  onMount(async () => {
    switchLocale("en");
    await restoreWalletConnection();
  });
</script>

<div class="flex justify-center">
  <Navbar />
</div>

<Toast />

<svelte:head>
  <title>
    {currentEnvMode() ? `[${currentEnvMode()}] KongSwap` : `KongSwap`} - {$t("common.browserSubtitle")}
  </title>
</svelte:head>

{#await initializeData}
  <div class="min-h-[94vh] flex justify-center items-center">
    <LoadingIndicator />
  </div>
{:then}
  <slot />
{/await}

<style scoped>
  :global(body) {
    background: #5BB2CF;
  }
</style>
