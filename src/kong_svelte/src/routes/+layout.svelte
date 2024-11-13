<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
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

  let pageTitle: string = $state("");
  let { children } = $props();
  let interval: NodeJS.Timeout | null = $state(null);

  onMount(() => {
    pageTitle = process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]";
    if (!$localeStore) {
      switchLocale("en");
    }
    const init = async () => {
      await Promise.allSettled([
        restoreWalletConnection(),
        tokenStore.loadTokens(),
        poolStore.loadPools()
      ]);
      if (isConnected()) {
        interval = setInterval(tokenStore.loadBalances, 5000);
      }
    };
    init();
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  });

  $effect(() => {
    if (isConnected()) {
      if (interval) return;

      tokenStore.loadBalances();
      interval = setInterval(tokenStore.loadBalances, 5000);
    }
  });

  $effect.pre(() => {
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

<svelte:head>
  <title>
    {`${pageTitle}`} - {$t("common.browserSubtitle")}
  </title>
</svelte:head>

<div class="flex justify-center">
  <Navbar />
</div>

<Toast />

{@render children?.()}
