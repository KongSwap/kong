<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { t } from "$lib/services/translations";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import { walletStore } from "$lib/services/wallet/walletStore";
  import { appLoader } from "$lib/services/appLoader";

  // Lazy load backgrounds
  const poolsBackground = new URL('$lib/assets/backgrounds/pools.webp', import.meta.url).href;
  const jungleBackground = new URL('$lib/assets/backgrounds/kong_jungle2.webp', import.meta.url).href;

  let pageTitle = $state(process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]");
  let { children } = $props();

  // Preload SVG components
  const pxComponents = import.meta.glob("/pxcomponents/*.svg", {
    eager: true,
    as: "url",
  });

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

  // Load favorites when wallet connects
  walletStore.subscribe(($wallet) => {
    if ($wallet?.account?.owner) {
      setTimeout(() => tokenStore.loadFavorites(), 1000);
    }
  });

  onMount(async () => {
    await appLoader.initialize({
      backgrounds: [poolsBackground, jungleBackground],
      svgComponents: Object.values(pxComponents)
    });
  });

  // Watch route changes
  $effect.pre(() => {
    updateBackground($page.url.pathname);
  });

  onDestroy(() => {
    appLoader.cleanup();
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
