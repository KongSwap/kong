<script lang="ts">
  import { walletsList } from '@windoge98/plug-n-play';
  import { createEventDispatcher, onMount } from "svelte";
  import { auth, selectedWalletId } from "$lib/services/auth";

  interface WalletInfo {
    id: string;
    name: string;
    icon: string;
  }

  onMount(() => {
    console.log('Available wallets:', walletsList);
  });

  // Map available wallets
  const walletList: WalletInfo[] = walletsList
    .filter(wallet => wallet.id === "plug")
    .map(wallet => ({
      id: wallet.id, 
      name: wallet.name,
      icon: wallet.icon
    }));

  const dispatch = createEventDispatcher();
  let connecting = false;
  let error = "";

  async function handleConnect(walletId: string) {
    if (!walletId || connecting) return;

    try {
      connecting = true;
      error = "";
      selectedWalletId.set(walletId);
      
      await auth.connect(walletId);
      
      if ($auth.isConnected) {
        dispatch("login");
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Connection failed";
      selectedWalletId.set(null);
    } finally {
      connecting = false;
    }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-full p-4 space-y-6">
  <h2 class="text-3xl font-bold text-white">Connect Wallet</h2>
  <p class="text-lg text-cyan-400">Choose your preferred wallet to continue</p>

  {#if error}
    <div class="w-full max-w-md p-4 text-red-400 border border-red-500/30 bg-red-950/20">
      {error}
    </div>
  {/if}

  <div class="w-full max-w-md space-y-4">
    {#each walletList as wallet}
      <button
        class="relative w-full p-4 transition-all duration-300 border-2 group hover:bg-cyan-500/10 {wallet.id === $selectedWalletId ? 'border-cyan-400 bg-cyan-500/20' : 'border-cyan-500/50'}"
        on:click={() => handleConnect(wallet.id)}
        disabled={connecting}
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <img src={wallet.icon} alt={wallet.name} class="w-8 h-8" />
            <div class="font-bold text-white">{wallet.name}</div>
          </div>
          {#if connecting && wallet.id === $selectedWalletId}
            <div class="w-5 h-5 border-2 border-t-2 border-white rounded-full border-t-transparent animate-spin"></div>
          {/if}
        </div>
      </button>
    {/each}
  </div>

  <button
    class="w-full max-w-md px-4 py-3 text-sm transition-colors border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10"
    on:click={() => dispatch("close")}
  >
    <span class="text-cyan-400">CANCEL</span>
  </button>
</div>

<style>
  .transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 300ms;
  }
</style>
