<script lang="ts">
  import Portal from 'svelte-portal';
  import confetti from 'canvas-confetti';
  import { onMount } from 'svelte';
  import type { SwapToken } from '../types/swap.types';
  
  interface Props {
    payToken: SwapToken | null;
    payAmount: string;
    receiveToken: SwapToken | null;
    receiveAmount: string;
    txHash: string;
    onClose: () => void;
  }
  
  let {
    payToken,
    payAmount,
    receiveToken,
    receiveAmount,
    txHash,
    onClose,
  }: Props = $props();
  
  function triggerConfetti() {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 }
    };
    
    function fire(particleRatio: number, opts: any) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
      });
    }
    
    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    
    fire(0.2, {
      spread: 60,
    });
    
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8
    });
    
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2
    });
    
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  }
  
  onMount(() => {
    triggerConfetti();
    
    // Auto close after 5 seconds
    const timeout = setTimeout(onClose, 5000);
    
    return () => clearTimeout(timeout);
  });
</script>

<Portal target="body">
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <!-- Backdrop -->
    <div 
      class="fixed inset-0 bg-black/50 backdrop-blur-sm"
      on:click={onClose}
    />
    
    <!-- Modal -->
    <div class="relative min-h-screen flex items-center justify-center p-4">
      <div class="relative bg-white dark:bg-surface-900 rounded-xl shadow-xl w-full max-w-md">
        <!-- Content -->
        <div class="p-8 text-center">
          <!-- Success Icon -->
          <div class="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
            <svg class="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h2 class="text-2xl font-bold mb-2">Swap Successful!</h2>
          
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            You swapped {payAmount} {payToken?.symbol} for {receiveAmount} {receiveToken?.symbol}
          </p>
          
          <!-- Transaction Details -->
          <div class="bg-surface-100 dark:bg-surface-800 rounded-lg p-4 mb-6">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Transaction Hash</p>
            <p class="font-mono text-sm break-all">{txHash}</p>
          </div>
          
          <!-- Actions -->
          <div class="space-y-3">
            <button
              on:click={onClose}
              class="w-full px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
            
            <a
              href="/wallets/{payToken?.address}/transactions"
              class="block w-full px-4 py-3 bg-surface-200 hover:bg-surface-300 dark:bg-surface-800 dark:hover:bg-surface-700 rounded-lg font-medium transition-colors"
            >
              View Transaction
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</Portal>