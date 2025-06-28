<script lang="ts">
  import { browser } from "$app/environment";
  import WalletProvider from "./WalletProvider.svelte";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { auth } from "$lib/stores/auth";
  
  // Extract walletProviderStore state
  let storeState = $state({isOpen: false});
  
  $effect(() => {
    const unsubscribe = walletProviderStore.subscribe(state => {
      storeState = state;
    });
    return unsubscribe;
  });
  
  let isOpen = $derived(storeState.isOpen);
  
  // Handle successful login
  function handleLogin() {
    // If user is now connected, handle login success
    if ($auth.isConnected) {
      walletProviderStore.handleLoginSuccess();
    }
  }
  
  // Ensure clean close of the modal
  function handleClose() {
    walletProviderStore.close();
  }
</script>

{#if browser}
  <WalletProvider
    isOpen={isOpen}
    onClose={handleClose}
    onLogin={handleLogin}
  />
{/if} 