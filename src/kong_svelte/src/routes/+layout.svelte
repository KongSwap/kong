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
    walletStore,
    restoreWalletConnection,
  } from "$lib/services/wallet/walletStore";
  import poolsBackground from "$lib/assets/backgrounds/pools.webp";
  import jungleBackground from "$lib/assets/backgrounds/kong_jungle2.webp";

  let pageTitle: string = $state("");
  let { children } = $props();
  let interval: NodeJS.Timeout | null = $state(null);

  onMount(async () => {
    pageTitle = process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]";
    
    if (!$localeStore) {
      switchLocale("en");
    }

    // Preload all pxcomponents
    const pxComponents = import.meta.glob("/pxcomponents/*.svg", {
      eager: true,
      as: "url",
    });

    // Create all promises at once
    const promises = [
      // Core data loading
      restoreWalletConnection(),
      tokenStore.loadTokens(),
      poolStore.loadPools(),
      
      // Asset preloading
      ...Object.values(pxComponents).map(url => {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = url;
        document.head.appendChild(link);
        return new Promise(resolve => link.onload = resolve);
      }),

      // Background images preloading
      new Promise(resolve => {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = jungleBackground;
        link.onload = resolve;
        document.head.appendChild(link);
      }),
      new Promise(resolve => {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = poolsBackground;
        link.onload = resolve;
        document.head.appendChild(link);
      })
    ];

    // Add balance loading if connected
    if ($walletStore.isConnected) {
      promises.push(tokenStore.loadBalances());
      interval = setInterval(tokenStore.loadBalances, 4000);
    }

    // Wait for everything to settle
    await Promise.allSettled(promises);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  });

  $effect(() => {
    if ($walletStore.isConnected) {
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
  <title>{`${pageTitle}`} - {$t("common.browserSubtitle")}</title>
  <link rel="preload" as="image" href={jungleBackground} />
  <link rel="preload" as="image" href={poolsBackground} />
  <!-- Individual preloads will be added dynamically -->
</svelte:head>

<div class="flex justify-center">
  <Navbar />
</div>

<Toast />

{@render children?.()}
