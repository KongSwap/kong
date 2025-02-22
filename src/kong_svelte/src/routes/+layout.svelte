<script lang="ts">
  import "../app.css";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { fade } from "svelte/transition";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { appLoader } from "$lib/services/appLoader";
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import AddToHomeScreen from "$lib/components/common/AddToHomeScreen.svelte";
  import QRModal from "$lib/components/common/QRModal.svelte";
  import { themeStore } from "$lib/stores/themeStore";
  import { browser } from "$app/environment";
  import TokenTicker from "$lib/components/nav/TokenTicker.svelte";
  import { auth } from "$lib/services/auth";
  import { kongDB } from "$lib/services/db";
  import { userTokens } from "$lib/stores/userTokens";
  import { DEFAULT_TOKENS } from "$lib/constants/tokenConstants";
  import { fetchTokensByCanisterId } from "$lib/api/tokens";
  import AlertBar from "$lib/components/common/AlertBar.svelte";
  import TrollBox from "$lib/components/common/TrollBox.svelte";
  
  let pageTitle = $state(
    process.env.DFX_NETWORK === "ic" ? "KongSwap" : "KongSwap [DEV]",
  );
  let initializationPromise: Promise<void> | null = null;
  let initializationError: Error | null = null;
  let defaultTokens: FE.Token[] = [];
  async function init() {
    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      try {
        await kongDB.initialize();
        await auth.initialize();
        await appLoader.initialize();
        console.log("[App] App initialization complete");
      } catch (error) {
        console.error("[App] Initialization error:", error);
        initializationError = error as Error;
        initializationPromise = null;
        throw error;
      }
    })();

    return initializationPromise;
  }

  onMount(async () => {
    init().catch((error) => {
      console.error("[App] Failed to initialize app:", error);
      initializationError = error;
    });

    defaultTokens = await fetchTokensByCanisterId(
      Object.values(DEFAULT_TOKENS),
    );
    if (defaultTokens.length > 0 && !$auth.isConnected) {
      userTokens.enableTokens(defaultTokens);
    }
    await userTokens.refreshTokenData();

    if (browser) {
      themeStore.initTheme();
    }
  });

  onDestroy(() => {
    if (browser) {
      appLoader.destroy();
    }
  });

  $effect(() => {
    if (defaultTokens.length > 0 && !$auth.isConnected) {
      userTokens.enableTokens(defaultTokens);
    }
  });
</script>

{#if initializationError}
  <div class="error-message">
    Failed to initialize app: {initializationError.message}
  </div>
{/if}

<svelte:head>
  <title>{pageTitle} - Rumble in the crypto jungle!</title>
</svelte:head>

<div class="app-container">
  <PageWrapper page={$page.url.pathname}>
    {#if process.env.DFX_NETWORK !== "ic"}
      <!-- <AlertBar href="/predict" type="success">
        <svg
          slot="icon"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          ><path
            fill="currentColor"
            d="M4.012 11.5h3.465q-.092-1.18-.613-2.284q-.522-1.104-1.345-1.927q-.661.898-1.05 1.96T4.011 11.5m12.511 0h3.466q-.068-1.17-.457-2.222q-.39-1.053-1.051-1.951q-.881.842-1.373 1.917t-.585 2.256M5.519 16.673q.823-.842 1.344-1.917t.614-2.256H4.012q.086 1.189.466 2.232t1.041 1.941m12.962 0q.661-.898 1.05-1.951q.39-1.053.458-2.222h-3.466q.093 1.18.585 2.256t1.373 1.917M8.488 11.5H11.5V4.012q-1.575.104-2.953.766q-1.378.663-2.393 1.768q1.013 1.008 1.622 2.269q.609 1.26.713 2.685m4.011 0h3.012q.103-1.425.702-2.705t1.632-2.249q-1.015-1.106-2.393-1.768T12.5 4.012zm-1 8.489V12.5H8.489q-.105 1.464-.704 2.705t-1.631 2.21q1.015 1.106 2.374 1.788q1.358.682 2.972.786m1 0q1.575-.104 2.953-.767t2.393-1.768q-1.033-.97-1.632-2.23t-.702-2.724H12.5zM12 21q-1.864 0-3.506-.71q-1.642-.711-2.857-1.926q-1.216-1.216-1.926-2.858Q3 13.864 3 12t.71-3.506t1.927-2.857T8.494 3.71Q10.137 3 12 3t3.506.71q1.642.711 2.857 1.927q1.216 1.215 1.926 2.857Q21 10.137 21 12t-.71 3.506q-.711 1.642-1.926 2.857q-1.216 1.216-2.858 1.926Q13.864 21 12 21"
          /></svg
        >
        Prediction markets are live! Place your bets now!
      </AlertBar> -->
    {/if}
    <div class="ticker-section">
      <TokenTicker />
    </div>
    <div class="nav-container">
      <Navbar />
    </div>
    <main class="content-container">
      {#key $page.url.pathname}
        <div class="w-full h-full" in:fade={{ duration: 250 }}>
          <slot />
        </div>
      {/key}
    </main>
  </PageWrapper>
  <Toast />
  <AddToHomeScreen />
  <QRModal />
  <!-- Add TrollBox component -->
  <TrollBox />
  <div id="modals"></div>
</div>

<style scoped lang="postcss">
  :global(body) {
    width: 100%;
    height: 100%;
    display: flex;
    @apply dark:bg-[#010101] light:bg-gray-200 transition-colors duration-200;
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
