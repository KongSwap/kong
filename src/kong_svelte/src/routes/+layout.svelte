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
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import LoadingScreen from "$lib/components/common/LoadingScreen.svelte";

  let pageTitle = $state(
    process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]",
  );
  let { children } = $props();


  // Initialize app
  onMount(() => {
    const init = async () => {
      await appLoader.initialize();
    };
    
    init().catch(console.error);
  });

  // Load favorites when wallet connects
  walletStore.subscribe(($wallet) => {
    if ($wallet?.account?.owner) {
      setTimeout(async () => {
        await Promise.all([
          tokenStore.loadBalances(),
          tokenStore.loadFavorites(),
        ]);
      }, 1000);
    }
  });

  onDestroy(() => {
    appLoader.cleanup();
  });
</script>

<svelte:head>
  <title>{pageTitle} - {$t("common.browserSubtitle")}</title>
</svelte:head>

<LoadingScreen />
<div class="min-h-screen bg-black">
  <PageWrapper page={$page.url.pathname}>
    <div class="flex justify-center">
      <Navbar />
    </div>
    {@render children?.()}
    <Toast />
  </PageWrapper>
</div>
