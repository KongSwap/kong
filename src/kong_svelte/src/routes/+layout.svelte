<script lang="ts">
  import "../app.css";
  import { onMount, beforeUpdate } from "svelte";
  import { page } from "$app/stores";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { switchLocale, localeStore, t } from "$lib/services/translations";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import { poolStore } from "$lib/services/pools/poolStore";
  import {
    isConnected,
    restoreWalletConnection,
  } from "$lib/services/wallet/walletStore";
  import poolsBackground from "$lib/assets/backgrounds/pools.webp";
  import jungleBackground from "$lib/assets/backgrounds/kong_jungle2.webp";

  let initialized: boolean = false;
  let pageTitle: string = "";

  onMount(async () => {
    pageTitle =
      process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]";
    if (!$localeStore) {
      switchLocale("en");
    }
    await Promise.all([
      restoreWalletConnection(),
      tokenStore.loadTokens(),
      poolStore.loadPools(),
      isConnected() ? tokenStore.loadBalances() : null,
    ]);
    initialized = true;
  });

  beforeUpdate(() => {
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
  });
</script>

<div class="flex justify-center">
  <Navbar />
</div>

<Toast />

<svelte:head>
  <title>
    {`${pageTitle}`} - {$t("common.browserSubtitle")}
  </title>
</svelte:head>

<slot />
