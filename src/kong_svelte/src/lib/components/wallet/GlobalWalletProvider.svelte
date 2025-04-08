<script lang="ts">
  import { browser } from "$app/environment";
  import WalletProvider from "./WalletProvider.svelte";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { auth } from "$lib/stores/auth";
  
  // Extract walletProviderStore state
  let isOpen = $derived($walletProviderStore.isOpen);
  
  // Handle successful login
  function handleLogin() {
    // If user is now connected, handle login success
    if ($auth.isConnected) {
      walletProviderStore.handleLoginSuccess();
    }
  }
</script>

{#if browser}
  <WalletProvider
    isOpen={isOpen}
    onClose={() => walletProviderStore.close()}
    onLogin={handleLogin}
  />
{/if} 