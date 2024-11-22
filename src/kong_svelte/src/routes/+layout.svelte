<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { t } from "$lib/services/translations";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import { appLoader } from "$lib/services/appLoader";
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import LoadingScreen from "$lib/components/common/LoadingScreen.svelte";
  import { auth } from "$lib/services/auth";

  let pageTitle = $state(
    process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]",
  );
  let { children } = $props();

  let isInitialized = false;

  // Initialize app
  onMount(() => {
    const init = async () => {
      await appLoader.initialize();
      isInitialized = true;
    };
    
    init().catch(console.error);
  });

  // Load favorites when wallet connects and PNP is initialized
  auth.subscribe(($auth) => {
    if ($auth?.account?.owner && isInitialized) {
      // Ensure PNP is initialized before loading balances
      tokenStore.loadBalances($auth.account.owner).catch(console.error);
      tokenStore.loadFavorites().catch(console.error);
    }
  });

  onDestroy(() => {
    appLoader.destroy();
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
