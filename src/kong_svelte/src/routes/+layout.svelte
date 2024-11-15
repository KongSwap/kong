<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { t } from "$lib/services/translations";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import { poolStore } from "$lib/services/pools/poolStore";
  import { walletStore, restoreWalletConnection } from "$lib/services/wallet/walletStore";
  import { browser } from "$app/environment";

  // Lazy load backgrounds
  const poolsBackground = new URL('$lib/assets/backgrounds/pools.webp', import.meta.url).href;
  const jungleBackground = new URL('$lib/assets/backgrounds/kong_jungle2.webp', import.meta.url).href;

  let pageTitle = $state(process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]");
  let { children } = $props();
  let interval: NodeJS.Timeout | null = $state(null);

  // Preload assets in parallel
  const preloadAsset = (url: string, type = 'image') => {
    if (!browser) return Promise.resolve();
    return new Promise((resolve) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = type;
      link.href = url;
      link.onload = resolve;
      document.head.appendChild(link);
    });
  };

  // Initialize app state
  const initializeApp = async () => {
    // Core data loading - run in parallel
    const corePromises = [
      restoreWalletConnection(),
      tokenStore.loadTokens(),
      poolStore.loadPools(),
    ];

    // Asset preloading - run in parallel
    const assetPromises = [
      preloadAsset(jungleBackground),
      preloadAsset(poolsBackground),
    ];

    // Preload SVG components
    const pxComponents = import.meta.glob("/pxcomponents/*.svg", {
      eager: true,
      as: "url",
    });
    const svgPromises = Object.values(pxComponents).map(url => preloadAsset(url));

    // Run all promises in parallel
    await Promise.allSettled([
      ...corePromises,
      ...assetPromises,
      ...svgPromises
    ]);

    // Setup wallet polling if connected
    if ($walletStore.isConnected) {
      await tokenStore.loadBalances();
      interval = setInterval(tokenStore.loadBalances, 4000);
    }
  };

  // Background management
  const updateBackground = (pathname: string) => {
    const backgrounds = {
      '/pools': poolsBackground,
      '/stats': null,
      '/swap': jungleBackground,
    };

    const defaultBg = jungleBackground;
    const matchedPath = Object.keys(backgrounds).find(path => pathname.startsWith(path));
    const background = matchedPath ? backgrounds[matchedPath] : defaultBg;

    document.body.style.background = background 
      ? `#5BB2CF url(${background})`
      : '#5BB2CF';
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
  };

  onMount(async () => {
    await initializeApp();
    
    return () => {
      if (interval) clearInterval(interval);
    };
  });

  // Watch route changes
  $effect.pre(() => {
    updateBackground($page.url.pathname);
  });
</script>

<svelte:head>
  <title>{pageTitle} - {$t("common.browserSubtitle")}</title>
</svelte:head>

<div class="flex justify-center">
  <Navbar />
</div>

<Toast />

{@render children?.()}
