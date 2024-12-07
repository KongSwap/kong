<script lang="ts">
  import { formatTokenAmount } from '$lib/utils/numberFormatUtils';
  import { fade, scale, fly } from "svelte/transition";
  import { backOut } from "svelte/easing";
  import { onDestroy } from "svelte";
  import coinReceivedSound from "$lib/assets/sounds/coin_received.mp3";
  import { settingsStore } from "$lib/services/settings/settingsStore";

  export let show = false;
  export let payAmount: string;
  export let payToken: FE.Token;
  export let receiveAmount: string;
  export let receiveToken: FE.Token;
  export let onClose: () => void;
  export let principalId: string;

  let showCopiedToast = false;

  // Play sound effect when modal opens
  $: if (show && $settingsStore.sound_enabled) {
    const audio = new Audio(coinReceivedSound);
    audio.play();
  }

  function handleClose() {
    onClose();
  }

  async function copyTradeDetails() {
    const formattedPaidAmount = formatTokenAmount(payAmount, payToken.decimals).toString();
    const formattedReceivedAmount = formatTokenAmount(receiveAmount, receiveToken.decimals).toString();

    const tradeDetails = 
      `Trade completed on KongSwap\n` +
      `Swapped ${formattedPaidAmount} ${payToken.symbol} for ${formattedReceivedAmount} ${receiveToken.symbol}\n` +
      `View trade: https://kongswap.io/swap?ref=${principalId}`;

    try {
      await navigator.clipboard.writeText(tradeDetails);
      showCopiedToast = true;
      setTimeout(() => showCopiedToast = false, 2000);
    } catch (err) {
      console.error('Failed to copy trade details:', err);
    }
  }

  onDestroy(() => {
    showCopiedToast = false;
  });
</script>

{#if show}
  <div
    class="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center"
    transition:fade={{ duration: 300 }}
    on:click={handleClose}
  >
    <div
      class="modal-container bg-[#0a0f1f]/90 p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl relative overflow-hidden border border-indigo-500/10"
      transition:scale={{ duration: 400, easing: backOut }}
      on:click|stopPropagation
    >
      <div class="stars" />
      <div class="twinkling" />
      
      <div class="text-center space-y-4 relative z-10" in:scale={{ delay: 200, duration: 400 }}>
        <div class="flex items-center justify-center">
          <img src="/stats/banana_dance.gif" class="w-24 opacity-90 hover:scale-110 transition-transform duration-300" alt="Success" />
        </div>
        
        <div class="space-y-4">
          <h2 class="text-xl font-medium bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-200">
            Trade Completed
          </h2>
          
          <div class="bg-[#0c1529]/50 backdrop-blur rounded-xl p-4 border border-indigo-500/10 hover:border-indigo-500/20 transition-colors duration-300">
            <div class="flex items-center justify-between mb-3">
              <div class="text-sm text-indigo-200/70">Sent</div>
              <div class="font-medium text-indigo-100">
                {formatTokenAmount(payAmount, payToken.decimals).toString()} {payToken.symbol}
              </div>
            </div>

            <div class="flex justify-center my-2">
              <div class="text-indigo-400/50">↓</div>
            </div>

            <div class="flex items-center justify-between">
              <div class="text-sm text-indigo-200/70">Received</div>
              <div class="font-medium text-indigo-100">
                {formatTokenAmount(receiveAmount, receiveToken.decimals).toString()} {receiveToken.symbol}
              </div>
            </div>
          </div>

          <div class="flex gap-2">
            <button 
              class="swap-button blue-button"
              on:click={copyTradeDetails}
            >
              Copy Details
            </button>
            <button 
              class="swap-button red-button"
              on:click={handleClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
    
    {#if showCopiedToast}
      <div 
        class="fixed bottom-4 left-1/2 -translate-x-1/2 bg-indigo-900/90 text-indigo-50 px-4 py-2 rounded-lg shadow-lg border border-indigo-500/20"
        in:fly={{ y: 20, duration: 300 }}
        out:fade
      >
        Trade details copied to clipboard
      </div>
    {/if}
    <!-- <BananaRain /> -->
  </div>
{/if}

<style>
  .modal-container {
    background: linear-gradient(to bottom right, rgba(13, 17, 23, 0.97), rgba(23, 27, 43, 0.97));
    box-shadow: 0 0 40px rgba(66, 153, 225, 0.1);
  }

  .stars {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: transparent url('/stars.png') repeat;
    z-index: 0;
    opacity: 0.5;
    animation: move-stars 400s linear infinite;
  }

  .twinkling {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: transparent url('/twinkling.png') repeat;
    z-index: 1;
    opacity: 0.3;
    animation: move-clouds 200s linear infinite;
  }

  .swap-button {
    flex: 1;
    padding: 12px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.9rem;
    transition: all 0.2s ease;
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    color: white;
  }

  .blue-button {
    background: linear-gradient(135deg, 
      rgba(55, 114, 255, 0.8) 0%, 
      rgba(55, 114, 255, 0.9) 100%
    );
  }

  .blue-button:hover {
    background: linear-gradient(135deg, 
      rgba(55, 114, 255, 0.9) 0%, 
      rgba(55, 114, 255, 1) 100%
    );
    transform: translateY(-1px);
  }

  .red-button {
    background: linear-gradient(135deg, 
      rgba(239, 68, 68, 0.8) 0%, 
      rgba(239, 68, 68, 0.9) 100%
    );
  }

  .red-button:hover {
    background: linear-gradient(135deg, 
      rgba(239, 68, 68, 0.9) 0%, 
      rgba(239, 68, 68, 1) 100%
    );
    transform: translateY(-1px);
  }

  @keyframes move-stars {
    from {background-position: 0 0;}
    to {background-position: 10000px 0;}
  }

  @keyframes move-clouds {
    from {background-position: 0 0;}
    to {background-position: 10000px 0;}
  }
</style>
