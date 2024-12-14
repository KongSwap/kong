<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { fade } from "svelte/transition";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { appLoader } from "$lib/services/appLoader";
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import { updateWorkerService } from "$lib/services/updateWorkerService";
  import { auth } from "$lib/services/auth";
  import AddToHomeScreen from "$lib/components/common/AddToHomeScreen.svelte";

  let pageTitle = $state(
    process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]",
  );
  let { children } = $props();
  let initializationPromise: Promise<void> | null = null;

  async function init() {
    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      try {
        await appLoader.initialize();
        await auth.initialize();
      } catch (error) {
        console.error("Initialization error:", error);
        initializationPromise = null;
        throw error;
      }
    })();

    return initializationPromise;
  }

  onMount(() => {
    init();
  });

  onDestroy(() => {
    appLoader.destroy();
    updateWorkerService.destroy();
  });
</script>

<svelte:head>
  <title>{pageTitle} - Rumble in the crypto jungle!</title>
</svelte:head>

<div class="app-container">
  <PageWrapper page={$page.url.pathname}>
    <div class="nav-container">
      <Navbar />
    </div>
    <main class="content-container">
      {#key $page.url.pathname}
        <div class="w-full h-full" in:fade={{ duration: 250 }}>
          {@render children?.()}
        </div>
      {/key}
    </main>
  </PageWrapper>
  <Toast />
  <AddToHomeScreen />
</div>

<style scoped lang="postcss">
  :global(body) {
    width: 100%;
    height: 100%;
    display: flex;
    background-color: #010101;
  }

  .nav-container {
    background-color: transparent;
  }

  .content-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .app-container {
    @apply flex flex-col min-h-screen w-full;
    transform-origin: center;
  }
</style>
