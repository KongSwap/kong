<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import {
    auth,
    availableWallets,
    selectedWalletId,
  } from "$lib/services/auth";
  import { t } from "$lib/services/translations";

  const dispatch = createEventDispatcher();
  let connecting = false;

  async function handleConnect(walletId: string) {
    if (!walletId || connecting) return;
    try {
      connecting = true;
      selectedWalletId.set(walletId);
      localStorage.setItem("kongSelectedWallet", walletId);
      await auth.connect(walletId);
      if ($auth.isConnected) dispatch("login");
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      selectedWalletId.set("");
    } finally {
      connecting = false;
    }
  }
</script>

<div class="wallet-provider">
  <div class="wallet-list">
    {#each availableWallets as wallet}
      <button
        class="wallet-option"
        on:click={() => handleConnect(wallet.id)}
        disabled={connecting}
      >
        <div class="wallet-icon">
          <img src={wallet.icon} alt={wallet.name} />
        </div>
        <span>{wallet.name}</span>
      </button>
    {/each}
  </div>
</div>

<style lang="postcss">
  .wallet-provider {
    @apply flex flex-col h-full p-2;
  }

  .wallet-list {
    @apply flex flex-col gap-3 overflow-y-auto;
  }

  .wallet-option {
    @apply flex items-center gap-4 w-full px-4 py-3
           bg-slate-800/40 
           rounded-xl transition-all duration-300
           border border-slate-700/20 
           backdrop-blur-md
           relative;
    
    &:hover:not(:disabled) {
      @apply bg-slate-700/50
             border-indigo-500/40
             shadow-[0_0_25px_rgba(99,102,241,0.15)]
             ring-2 ring-indigo-500/20;
    }
    
    &:disabled {
      @apply opacity-50 cursor-not-allowed shadow-none;
    }

    &:not(:disabled):active {
      @apply scale-[0.98];
    }
  }

  .wallet-icon {
    @apply relative flex items-center justify-center
           w-10 h-10 rounded-xl
           bg-gradient-to-br from-slate-700/50 to-slate-800/50
           border border-slate-600/20
           transition-all duration-300;
  }

  .wallet-option:hover .wallet-icon {
    @apply bg-gradient-to-br from-indigo-600/20 to-indigo-800/20
           border-indigo-500/30;
  }

  .wallet-option img {
    @apply w-7 h-7 rounded-lg
           transition-all duration-300;
  }

  .wallet-option:hover img {
    @apply scale-110 brightness-110;
  }

  .wallet-option span {
    @apply text-white/90 font-medium
           tracking-wide transition-colors duration-300;
  }

  .wallet-option:hover span {
    @apply text-white;
  }

  .wallet-list::-webkit-scrollbar {
    @apply w-1.5;
  }

  .wallet-list::-webkit-scrollbar-track {
    @apply bg-transparent;
  }

  .wallet-list::-webkit-scrollbar-thumb {
    @apply bg-white/5 rounded-full 
           hover:bg-white/15
           transition-colors duration-200;
  }
</style>
