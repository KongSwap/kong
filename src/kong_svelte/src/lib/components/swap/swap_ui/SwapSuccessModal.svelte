<script lang="ts">
  import { formatBalance } from '$lib/utils/numberFormatUtils';
  import { fade, scale, fly } from "svelte/transition";
  import { backOut } from "svelte/easing";
  import coinReceivedSound from "$lib/assets/sounds/coin_received.mp3";
  import { settingsStore } from "$lib/services/settings/settingsStore";
  import { toastStore } from "$lib/stores/toastStore";

  export let show = false;
  export let payAmount: string = "0";
  export let payToken: FE.Token | null = null;
  export let receiveAmount: string = "0";
  export let receiveToken: FE.Token | null = null;
  export let onClose: () => void;
  export let principalId: string = "";

  // Validate tokens are defined
  $: isValid = payToken && receiveToken && 
               typeof payToken.decimals === 'number' && 
               typeof receiveToken.decimals === 'number' &&
               payAmount && receiveAmount;

  // Play sound effect when modal opens
  $: if (show && isValid && $settingsStore.sound_enabled) {
    const audio = new Audio(coinReceivedSound);
    audio.play();
  }

  function handleClose() {
    onClose();
  }

  async function copyTradeDetails() {
    if (!isValid) return;

    const formattedPaidAmount = formatBalance(payAmount, payToken.decimals).toString();
    const formattedReceivedAmount = formatBalance(receiveAmount, receiveToken.decimals).toString();

    const tradeDetails = 
      `🍌 Trade completed on KongSwap!\n\n` +
      `Swapped ${formattedPaidAmount} ${payToken.symbol} for ${formattedReceivedAmount} ${receiveToken.symbol}\n\n` +
      `Trade now: https://www.kongswap.io/swap?from=${payToken.canister_id}&to=${receiveToken.canister_id}\n`
    try {
      await navigator.clipboard.writeText(tradeDetails);
      toastStore.success('Trade details copied to clipboard');
    } catch (err) {
      console.error('Failed to copy trade details:', err);
      toastStore.error('Failed to copy trade details');
    }
  }

  async function shareOnX() {
    if (!isValid) return;

    const formattedPaidAmount = formatBalance(payAmount, payToken.decimals).toString();
    const formattedReceivedAmount = formatBalance(receiveAmount, receiveToken.decimals).toString();

    const tweetText = encodeURIComponent(
      `🍌 Just swapped ${formattedPaidAmount} ${payToken.symbol} for ${formattedReceivedAmount} ${receiveToken.symbol} on @KongSwap!\n\nTrade now: https://www.kongswap.io/swap?from=${payToken.canister_id}&to=${receiveToken.canister_id}`
    );
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank');
  }
</script>

{#if show && isValid}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-md z-[100] flex items-center justify-center"
    transition:fade={{ duration: 300 }}
    on:click={handleClose}
  >
    <div
      class="modal-container p-7 rounded-md max-w-md w-full mx-4 shadow-2xl relative overflow-hidden"
      transition:scale={{ duration: 400, easing: backOut }}
      on:click|stopPropagation
    >
      <!-- Animated gradient border -->
      <div class="absolute inset-0 bg-kong-bg-dark/30 rounded-md animate-gradient-x" />
      
      <!-- Glowing success indicator -->
      <div class="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-kong-primary/20 rounded-full blur-3xl animate-pulse" />
      
      <div class="text-center space-y-6 relative z-10" in:scale={{ delay: 200, duration: 400 }}>
        <div class="flex items-center justify-center relative">
          <div class="absolute inset-0 bg-gradient-to-b from-kong-primary/10 to-transparent rounded-full blur-xl" />
          <img 
            src="/stats/banana_dance.gif" 
            class="w-28 opacity-90 hover:scale-110 transition-transform duration-300 drop-shadow-xl" 
            alt="Success" 
          />
        </div>
        
        <div class="space-y-6">
          <div class="space-y-2">
            <h2 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-kong-primary to-kong-accent-blue">
              Trade Completed! 🎉
            </h2>
            <p class="text-kong-text-secondary text-sm">Your transaction was successful</p>
          </div>
          
          <div class="trade-details-container group">
            <div class="flex items-center justify-between mb-4">
              <div class="text-sm text-kong-primary/70">You sent</div>
              <div class="font-medium text-kong-text-primary flex items-center gap-2">
                <div class="token-amount-display">
                  <img src={payToken.logo_url} alt={payToken.symbol} class="w-6 h-6 rounded-full shadow-md" />
                  <span>{payAmount} {payToken.symbol}</span>
                </div>
              </div>
            </div>

            <div class="flex justify-center my-3">
              <div class="text-indigo-400/50 text-xl group-hover:scale-110 transition-transform">↓</div>
            </div>

            <div class="flex items-center justify-between">
              <div class="text-sm text-kong-primary/70">You received</div>
              <div class="font-medium text-kong-text-primary flex items-center gap-2">
                <div class="token-amount-display">
                  <img src={receiveToken.logo_url} alt={receiveToken.symbol} class="w-6 h-6 rounded-full shadow-md" />
                  <span>{receiveAmount} {receiveToken.symbol}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3 text-white">
            <div class="flex gap-3">
              <button 
                class="action-button copy-button group"
                on:click={copyTradeDetails}
              >
                <i class="fas fa-copy mr-2 group-hover:scale-110 transition-transform"></i>
                <span>Copy Details</span>
              </button>
              <button 
                class="action-button share-button group"
                on:click={shareOnX}
              >
                <i class="fab fa-x-twitter mr-2 group-hover:scale-110 transition-transform"></i>
                <span>Share on X</span>
              </button>
            </div>
            <button 
              class="action-button close-button group"
              on:click={handleClose}
            >
              <i class="fas fa-times mr-2 group-hover:scale-110 transition-transform"></i>
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style scoped lang="postcss">
  .modal-container {
    @apply bg-kong-bg-dark/95;
    box-shadow: 
      0 0 60px rgba(66, 153, 225, 0.15),
      inset 0 0 20px rgba(66, 153, 225, 0.1);
  }

  .trade-details-container {
    @apply bg-kong-bg-dark/50 backdrop-blur rounded-xl p-6
           border border-kong-border/30 hover:border-kong-border/50 
           transition-all duration-300 shadow-lg hover:shadow-xl
           hover:bg-kong-bg-dark/60;
  }

  .token-amount-display {
    @apply flex items-center gap-2 bg-kong-bg-dark/30 
           px-3 py-1.5 rounded-lg border border-kong-border/20;
  }

  .action-button {
    @apply flex-1 py-3.5 px-4 rounded-xl font-semibold text-sm
           transition-all duration-200 flex items-center justify-center
           border border-kong-border/30 hover:border-kong-border/50
           shadow-md hover:shadow-xl relative overflow-hidden;
  }

  .copy-button {
    @apply bg-gradient-to-r from-kong-primary/90 to-kong-primary
           hover:from-kong-primary hover:to-kong-primary
           hover:-translate-y-0.5;
  }

  .share-button {
    @apply bg-gradient-to-r from-kong-accent-blue/80 to-kong-accent-blue
           hover:from-kong-accent-blue hover:to-kong-accent-blue
           hover:-translate-y-0.5;
  }

  .close-button {
    @apply bg-gradient-to-r from-kong-accent-red/90 to-kong-accent-red
           hover:from-kong-accent-red hover:to-kong-accent-red
           hover:-translate-y-0.5;
  }

  @keyframes gradient-x {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .animate-gradient-x {
    animation: gradient-x 15s ease infinite;
    background-size: 200% 200%;
  }
</style>
