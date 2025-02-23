<script lang="ts">
  import { walletsList } from '@windoge98/plug-n-play';
  export let onLoginSuccess: () => void;
  export let pnp: any;
  export const showModal = false;
  
  let showWalletSelector = false;
  let statusMessage = '';
  let statusType = 'info';

  async function connectWallet(walletId: string) {
    try {
      if (!pnp) {
        throw new Error('Wallet connection not initialized yet. Please try again in a moment.');
      }
      console.log("Connecting wallet with ID:", walletId);
      await pnp.connect(walletId);
      console.log("Wallet connected successfully");
      showWalletSelector = false;
      showStatus('Connected successfully!', 'success');
      onLoginSuccess();
    } catch (error) {
      console.error("Wallet connection failed:", error);
      showStatus(error instanceof Error ? error.message : 'Failed to connect wallet', 'error');
    }
  }

  function showStatus(message: string, type: string = 'info') {
    statusMessage = message;
    statusType = type;
    setTimeout(() => {
      statusMessage = '';
    }, 5000);
  }
</script>

<button class="flex items-center justify-center gap-2 px-6 py-3 text-base font-medium text-gray-900 bg-green-500 border-none rounded-lg cursor-pointer hover:brightness-110" on:click={() => showWalletSelector = true}>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 12v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/>
    <polyline points="16 12 20 12 20 12"/>
  </svg>
  Connect Wallet
</button>

{#if showWalletSelector}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
    <div class="bg-gray-800 p-8 rounded-2xl w-[90%] max-w-[480px] border border-white/10">
      <h3 class="mb-6 text-center text-green-500">Choose Your Wallet</h3>
      <div class="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2">
        {#each walletsList as wallet}
          <button 
            class="flex items-center gap-4 p-4 border rounded-lg cursor-pointer bg-white/5 border-white/10 hover:bg-white/10"
            on:click={() => connectWallet(wallet.id)}
          >
            {#if wallet.logo}
              <img 
                src={`data:image/png;base64,${wallet.logo}`}
                alt="{wallet.name} logo"
                class="w-8 h-8 rounded-lg"
              />
            {/if}
            <span>{wallet.name}</span>
          </button>
        {/each}
      </div>
      <button class="w-full px-6 py-3 text-white bg-transparent border rounded-lg cursor-pointer border-white/20 hover:bg-white/10" on:click={() => showWalletSelector = false}>
        Cancel
      </button>
    </div>
  </div>
{/if}

{#if statusMessage}
  <div class="fixed bottom-8 right-8 p-4 rounded-lg z-50 max-w-[400px] {
    statusType === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-500' :
    statusType === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-500' :
    'bg-blue-500/10 border border-blue-500/20 text-blue-500'
  }">
    {statusMessage}
  </div>
{/if}
