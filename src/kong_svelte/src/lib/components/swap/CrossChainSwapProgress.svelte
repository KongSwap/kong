<script lang="ts">
  import { crossChainSwapStore } from '$lib/services/swap/CrossChainSwapMonitor';
  import { CrossChainSwapMonitor } from '$lib/services/swap/CrossChainSwapMonitor';
  import LoadingIndicator from '$lib/components/common/LoadingIndicator.svelte';
  import { fade, slide } from 'svelte/transition';
  
  // Get all active swaps as an array
  let activeSwaps = $derived(Object.entries($crossChainSwapStore).map(([id, swap]) => ({ id, ...swap })));
  
  function getStatusIcon(status: string) {
    switch (status) {
      case 'Pending':
        return '⏳';
      case 'Processing':
      case 'WaitingForSignature':
      case 'SendingToSolana':
        return '⚙️';
      case 'Confirmed':
      case 'Submitted':
        return '✅';
      case 'Failed':
        return '❌';
      default:
        return '🔄';
    }
  }
  
  function getStatusColor(status: string) {
    switch (status) {
      case 'Confirmed':
      case 'Submitted':
        return 'text-green-600 dark:text-green-400';
      case 'Failed':
        return 'text-red-600 dark:text-red-400';
      case 'Processing':
      case 'WaitingForSignature':
      case 'SendingToSolana':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  }
  
  function getProgressPercentage(status: string): number {
    switch (status) {
      case 'Pending':
        return 25;
      case 'Processing':
        return 50;
      case 'WaitingForSignature':
        return 60;
      case 'SendingToSolana':
        return 80;
      case 'Confirmed':
      case 'Submitted':
        return 100;
      case 'Failed':
        return 0;
      default:
        return 0;
    }
  }
</script>

{#if activeSwaps.length > 0}
  <div class="fixed bottom-4 right-4 w-96 max-h-96 overflow-y-auto z-50 space-y-2" transition:fade={{ duration: 200 }}>
    {#each activeSwaps as swap (swap.id)}
      <div 
        class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4"
        transition:slide={{ duration: 300 }}
      >
        <!-- Header -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-lg">{getStatusIcon(swap.status)}</span>
            <div>
              <h4 class="font-semibold text-sm text-gray-900 dark:text-white">
                {swap.payToken} → {swap.receiveToken}
              </h4>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Job #{swap.jobId.toString()}
              </p>
            </div>
          </div>
          <button
            onclick={() => CrossChainSwapMonitor.stopMonitoring(swap.id)}
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Amount Info -->
        <div class="flex justify-between text-sm mb-3">
          <span class="text-gray-600 dark:text-gray-400">Amount:</span>
          <span class="text-gray-900 dark:text-white font-medium">
            {swap.payAmount} {swap.payToken} → {swap.receiveAmount} {swap.receiveToken}
          </span>
        </div>
        
        <!-- Status -->
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-gray-600 dark:text-gray-400">Status:</span>
          <span class="text-sm font-medium {getStatusColor(swap.status)}">
            {swap.status}
          </span>
        </div>
        
        <!-- Progress Bar -->
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
          <div 
            class="h-2 rounded-full transition-all duration-500 ease-out
              {swap.status === 'Failed' ? 'bg-red-500' : 
               swap.status === 'Confirmed' ? 'bg-green-500' : 
               'bg-gradient-to-r from-blue-500 to-purple-500'}"
            style="width: {getProgressPercentage(swap.status)}%"
          >
            {#if swap.status !== 'Failed' && swap.status !== 'Confirmed'}
              <div class="h-full w-full relative overflow-hidden">
                <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            {/if}
          </div>
        </div>
        
        <!-- Elapsed Time -->
        <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
          <span>Elapsed time:</span>
          <span>{CrossChainSwapMonitor.getElapsedTime(swap.id)}</span>
        </div>
        
        <!-- Transaction Links -->
        {#if swap.payTxSignature || swap.receiveTxSignature}
          <div class="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2 space-y-1">
            {#if swap.payTxSignature}
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-600 dark:text-gray-400">Pay TX:</span>
                <a 
                  href="https://solscan.io/tx/{swap.payTxSignature}?cluster=devnet" 
                  target="_blank"
                  class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {swap.payTxSignature.slice(0, 8)}...
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            {/if}
            {#if swap.receiveTxSignature}
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-600 dark:text-gray-400">Receive TX:</span>
                <a 
                  href="https://solscan.io/tx/{swap.receiveTxSignature}?cluster=devnet" 
                  target="_blank"
                  class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {swap.receiveTxSignature.slice(0, 8)}...
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            {/if}
          </div>
        {/if}
        
        <!-- Error Message -->
        {#if swap.error}
          <div class="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
            {swap.error}
          </div>
        {/if}
        
        <!-- Processing Animation -->
        {#if swap.status !== 'Confirmed' && swap.status !== 'Failed'}
          <div class="flex items-center justify-center mt-2">
            <LoadingIndicator size={16} />
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
</style>