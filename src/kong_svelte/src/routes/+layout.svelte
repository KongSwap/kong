<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { t } from "$lib/services/translations";
  import { tokenStore } from "$lib/services/tokens/tokenStore";
  import { appLoader } from "$lib/services/appLoader";
  import { themeStore } from "$lib/stores/themeStore";
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

  onDestroy(() => {
    appLoader.destroy();
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

<style lang="postcss">
  .nav-container {
    content: normal;
  }

  :global([data-theme="modern"]) .nav-container {
    margin-bottom: 1rem;
  }

  .content-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    
  }

  :global(body) {
    margin: 0;
    background-color: #0f172a;
  }
</style>
