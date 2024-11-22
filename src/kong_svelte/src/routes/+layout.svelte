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
  import { themeStore } from "$lib/stores/themeStore";
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

  <PageWrapper page={$page.url.pathname}>
    <div class="nav-container">
      <Navbar />
    </div>
    <main class="content-container">
      {@render children?.()}
    </main>
    <Toast />
  </PageWrapper>

<style>
  .nav-container {
    height: 64px; /* Match this with your navbar height */
  }

  .content-container {
    padding-top: 64px; /* Match this with your navbar height */
  }

  :global(body) {
    min-height: 100vh;
    margin: 0;
    background-color: #0f172a;
  }

  :global(body[data-theme="modern"]) {
    background: radial-gradient(circle at 50% -50%, rgba(99, 102, 241, 0.15) 0%, rgba(28, 27, 38, 0) 50%),
                radial-gradient(circle at 0% 100%, rgba(74, 222, 128, 0.1) 0%, rgba(28, 27, 38, 0) 50%),
                radial-gradient(circle at 100% 100%, rgba(245, 158, 11, 0.1) 0%, rgba(28, 27, 38, 0) 50%),
                #1c1b26;
  }
</style>
