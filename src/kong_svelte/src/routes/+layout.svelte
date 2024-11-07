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
  import { walletStore } from "$lib/stores/walletStore";

  let initialized: boolean = false;

  onMount(async () => {
    switchLocale("en");
    await Promise.all([restoreWalletConnection(), tokenStore.loadTokens(), poolStore.loadPools()]);
    if($walletStore.isConnected) {
      await tokenStore.loadBalances();
    }
    initialized = true;
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

{#if !initialized}
  <div class="min-h-[94vh] flex justify-center items-center">
    <LoadingIndicator />
  </div>
{:else}
  <slot />
{/if}

<style scoped>
  :global(body) {
    background: #5BB2CF;
  }
</style>
