<script lang="ts">
  import { formatBalance } from '$lib/utils/numberFormatUtils';
  import { fade } from "svelte/transition";
  import coinReceivedSound from "$lib/assets/sounds/coin_received.mp3";
  import { settingsStore } from "$lib/stores/settingsStore";
  import { toastStore } from "$lib/stores/toastStore";
  import Panel from '$lib/components/common/Panel.svelte';
  import bananaDance from "$lib/assets/banana_dance.gif";
  import type { AnyToken } from '$lib/utils/tokenUtils';
  import { isSolanaToken } from '$lib/utils/tokenUtils';

  export let show = false;
  export let payAmount: string = "0";
  export let payToken: AnyToken | null = null;
  export let receiveAmount: string = "0";
  export let receiveToken: AnyToken | null = null;
  export let solanaTransactionHash: string | null = null;
  export let onClose: () => void;

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

    let tradeDetails = 
      `🍌 Trade completed on KongSwap!\n\n` +
      `Swapped ${formattedPaidAmount} ${payToken.symbol} for ${formattedReceivedAmount} ${receiveToken.symbol}\n\n`;
    
    if (solanaTransactionHash) {
      tradeDetails += `Transaction: https://solscan.io/tx/${solanaTransactionHash}\n\n`;
    }
    
    // Only add trade link for Kong tokens (ICP ecosystem)
    if (!isSolanaToken(payToken) && !isSolanaToken(receiveToken)) {
      tradeDetails += `Trade now: https://www.kongswap.io/swap?from=${payToken.address}&to=${receiveToken.address}\n`;
    }
    
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

    let tweetText = `🍌 Just swapped ${formattedPaidAmount} ${payToken.symbol} for ${formattedReceivedAmount} ${receiveToken.symbol} on @KongSwap!`;
    
    if (solanaTransactionHash) {
      tweetText += `\n\nTransaction: https://solscan.io/tx/${solanaTransactionHash}`;
    } else if (!isSolanaToken(payToken) && !isSolanaToken(receiveToken)) {
      // Only add trade link for Kong tokens
      tweetText += `\n\nTrade now: https://www.kongswap.io/swap?from=${payToken.address}&to=${receiveToken.address}`;
    }
    
    const encodedText = encodeURIComponent(tweetText);
    window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, '_blank');
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
        <div class="text-center space-y-6 mb-2">
          <!-- Success Icon -->
          <div class="flex justify-center">
            <img 
              src={bananaDance} 
              class="w-24 opacity-90 hover:scale-110 transition-transform duration-300" 
              alt="Success" 
              loading="eager"
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

          <!-- Transaction Link if available -->
          {#if solanaTransactionHash && (isSolanaToken(payToken) || isSolanaToken(receiveToken))}
            <div class="bg-kong-bg-dark/30 rounded-lg p-4 border border-kong-border/20">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm text-kong-text-secondary">Transaction</span>
                <a 
                  href="https://solscan.io/tx/{solanaTransactionHash}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-kong-accent-blue hover:text-kong-accent-blue/80 text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <span class="truncate max-w-[120px]">{solanaTransactionHash.slice(0, 8)}...</span>
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          {/if}

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
            {#if solanaTransactionHash}
              <a 
                href="https://solscan.io/tx/{solanaTransactionHash}"
                target="_blank"
                rel="noopener noreferrer"
                class="w-full py-3 px-4 rounded-lg bg-kong-accent-green/90 hover:bg-kong-accent-green text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>View on Solscan</span>
              </a>
            {/if}
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
