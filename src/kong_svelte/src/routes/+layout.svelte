<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { page } from "$app/stores"; // Import the $page store
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { t } from "$lib/locales/translations";
  import { currentEnvMode } from "$lib/utils/envUtils";
  import { restoreWalletConnection } from "$lib/stores/walletStore";
  import { switchLocale, localeStore } from "$lib/stores/localeStore";
  import { tokenStore } from "$lib/stores/tokenStore";
  import { poolStore } from "$lib/stores/poolStore";
  import { walletStore } from "$lib/stores/walletStore";
  import poolsBackground from "$lib/assets/backgrounds/pools.webp";
  import jungleBackground from "$lib/assets/backgrounds/kong_jungle2.webp";
  import { browser } from "$app/environment";

  let initialized: boolean = false;

  onMount(async () => {
    if (!localeStore) {
      switchLocale("en");
    }
    Promise.all([
      restoreWalletConnection(),
      tokenStore.loadTokens(),
      poolStore.loadPools(),
      $walletStore.isConnected ? tokenStore.loadBalances() : null,
    ]);
    initialized = true;
  });

  $: if (browser) {
    if ($page.url.pathname.startsWith("/pools")) {
      document.body.style.background = `#5BB2CF url(${poolsBackground})`;
    } else if ($page.url.pathname.startsWith("/stats")) {
      document.body.style.background = "#5BB2CF";
    } else if ($page.url.pathname.startsWith("/swap")) {
      document.body.style.background = `#5BB2CF url(${jungleBackground})`;
    } else {
      document.body.style.background = `#5BB2CF url(${jungleBackground})`;
    }
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
  }
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
