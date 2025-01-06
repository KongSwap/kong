<script lang="ts">
  import { formatBalance } from '$lib/utils/numberFormatUtils';
  import { fade, scale } from "svelte/transition";
  import { backOut } from "svelte/easing";
  import coinReceivedSound from "$lib/assets/sounds/coin_received.mp3";
  import { settingsStore } from "$lib/services/settings/settingsStore";
  import { toastStore } from "$lib/stores/toastStore";
  import Panel from '$lib/components/common/Panel.svelte';

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
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center"
    transition:fade={{ duration: 200 }}
    on:click={handleClose}
  >
    <div
      class="max-w-md w-full mx-4"
      on:click|stopPropagation
    >
      <Panel 
        variant="transparent"
        type="main"
        className="w-full p-8"
      >
        <div class="text-center space-y-6">
          <!-- Success Icon -->
          <div class="flex justify-center">
            <img 
              src="/stats/banana_dance.gif" 
              class="w-24 opacity-90 hover:scale-110 transition-transform duration-300" 
              alt="Success" 
            />
          </div>
          
          <!-- Title -->
          <div>
            <h2 class="text-2xl font-semibold text-kong-text-primary">
              Trade Completed
            </h2>
            <p class="text-kong-text-secondary text-sm mt-2">Transaction successful</p>
          </div>
          
          <!-- Trade Details -->
          <div class="bg-kong-bg-dark/30 rounded-lg p-6 space-y-4 border border-kong-border/20">
            <div class="flex items-center justify-between">
              <span class="text-sm text-kong-text-secondary">You sent</span>
              <div class="flex items-center gap-3">
                <img src={payToken.logo_url} alt={payToken.symbol} class="w-6 h-6 rounded-full" />
                <span class="text-kong-text-primary text-lg">{payAmount} {payToken.symbol}</span>
              </div>
            </div>

            <div class="flex justify-center">
              <div class="text-kong-text-secondary text-xl">↓</div>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-sm text-kong-text-secondary">You received</span>
              <div class="flex items-center gap-3">
                <img src={receiveToken.logo_url} alt={receiveToken.symbol} class="w-6 h-6 rounded-full" />
                <span class="text-kong-text-primary text-lg">{receiveAmount} {receiveToken.symbol}</span>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col gap-3 pt-2">
            <div class="flex gap-3">
              <button 
                class="flex-1 py-3 px-4 rounded-lg bg-kong-primary/90 hover:bg-kong-primary text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                on:click={copyTradeDetails}
              >
                <i class="fas fa-copy"></i>
                <span>Copy Details</span>
              </button>
              <button 
                class="flex-1 py-3 px-4 rounded-lg bg-kong-accent-blue/90 hover:bg-kong-accent-blue text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                on:click={shareOnX}
              >
                <i class="fab fa-x-twitter"></i>
                <span>Share on X</span>
              </button>
            </div>
            <button 
              class="w-full py-3 px-4 rounded-lg bg-kong-accent-red/90 hover:bg-kong-accent-red text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              on:click={handleClose}
            >
              <i class="fas fa-times"></i>
              <span>Close</span>
            </button>
          </div>
        </div>
      </Panel>
    </div>
  </div>
{/if}

<style>
  /* Remove all existing styles and keep it minimal */
</style>
