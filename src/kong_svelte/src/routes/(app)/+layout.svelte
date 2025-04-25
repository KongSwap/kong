<script lang="ts">
  import { fade } from "svelte/transition";
  import { page } from "$app/state";
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import PageWrapper from "$lib/components/layout/PageWrapper.svelte";
  import AddToHomeScreen from "$lib/components/common/AddToHomeScreen.svelte";
  import QRModal from "$lib/components/common/QRModal.svelte";
  import TokenTicker from "$lib/components/nav/TokenTicker.svelte";
  import GlobalSearch from "$lib/components/search/GlobalSearch.svelte";
  import { searchStore } from "$lib/stores/searchStore";
  import KeyboardShortcutsHelp from "$lib/components/common/KeyboardShortcutsHelp.svelte";
  import GlobalWalletProvider from "$lib/components/wallet/GlobalWalletProvider.svelte";
  import { goto } from "$app/navigation";
  
  let { children } = $props<{
    children: any;
  }>();
</script>

<div class="flex flex-col min-h-screen w-full origin-center app-content">
  <PageWrapper page={page.url.pathname}>
    <div class="ticker-section">
      <TokenTicker />
    </div>
    <div class="bg-transparent navbar-section">
      <Navbar />
    </div>
    <main class="flex flex-col items-center w-full flex-grow">
      <div class="w-full h-full" transition:fade>
        {@render children?.()}
      </div>
    </main>

    <footer class="w-full h-6 bg-transparent absolute bottom-0 mx-auto">
      <div
        class="flex items-center justify-center opacity-60 hover:opacity-90 transition-opacity duration-200"
      >
        <p class="text-xs text-kong-text-secondary">
          Powered by <button
            onclick={() => goto("/")}
            class="text-kong-text-primary font-semibold hover:text-kong-primary"
            >KongSwap</button
          >
        </p>
      </div>
    </footer>
  </PageWrapper>
  <Toast />
  <AddToHomeScreen />
  <QRModal />
  <GlobalSearch
    isOpen={$searchStore.isOpen}
    on:close={() => searchStore.close()}
  />
  <KeyboardShortcutsHelp />
  <GlobalWalletProvider />
  <div id="modals"></div>
</div>
