<script lang="ts">
  import { crossChainSwapStore, CrossChainSwapMonitor } from '$lib/services/swap/CrossChainSwapMonitor';
  import { fade, slide } from 'svelte/transition';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  $: activeSwaps = Object.entries($crossChainSwapStore);
  $: hasActiveSwaps = activeSwaps.length > 0;

  // Progress animation
  const progress = tweened(0, {
    duration: 400,
    easing: cubicOut
  });

  // Get status color
  function getStatusColor(status: string): string {
    switch (status) {
      case 'Pending':
      case 'WaitingForSignature':
        return 'text-yellow-500';
      case 'Processing':
      case 'SendingToSolana':
        return 'text-blue-500';
      case 'Confirmed':
        return 'text-green-500';
      case 'Failed':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  }

  // Get status icon
  function getStatusIcon(status: string): string {
    switch (status) {
      case 'Pending':
        return '⏳';
      case 'Processing':
        return '⚙️';
      case 'WaitingForSignature':
        return '✍️';
      case 'SendingToSolana':
        return '📤';
      case 'Confirmed':
        return '✅';
      case 'Failed':
        return '❌';
      default:
        return '🔄';
    }
  }

  // Get progress percentage
  function getProgress(status: string): number {
    switch (status) {
      case 'Pending':
        return 20;
      case 'WaitingForSignature':
        return 40;
      case 'Processing':
        return 60;
      case 'SendingToSolana':
        return 80;
      case 'Confirmed':
        return 100;
      case 'Failed':
        return 0;
      default:
        return 10;
    }
  }

  // Update progress bar
  $: if (hasActiveSwaps) {
    const latestSwap = activeSwaps[activeSwaps.length - 1][1];
    progress.set(getProgress(latestSwap.status));
  }
</script>

{#if hasActiveSwaps}
  <div 
    class="fixed bottom-4 right-4 max-w-sm z-50"
    transition:fade={{ duration: 300 }}
  >
    <div class="bg-kong-bg-primary/95 backdrop-blur-sm border border-kong-border/20 rounded-lg shadow-lg p-4 space-y-3">
      <h3 class="text-sm font-semibold text-kong-text-primary mb-2">
        Active Cross-Chain Swaps
      </h3>
      
      {#each activeSwaps as [jobId, swap] (jobId)}
        <div 
          class="bg-kong-bg-secondary/50 rounded-md p-3 space-y-2"
          transition:slide={{ duration: 300 }}
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-lg">{getStatusIcon(swap.status)}</span>
              <span class="text-sm font-medium text-kong-text-primary">
                {swap.payToken} → {swap.receiveToken}
              </span>
            </div>
            <span class="text-xs {getStatusColor(swap.status)} font-medium">
              {swap.status}
            </span>
          </div>
          
          <div class="text-xs text-kong-text-secondary">
            {swap.payAmount} {swap.payToken} → {swap.receiveAmount} {swap.receiveToken}
          </div>
          
          <div class="flex items-center justify-between text-xs">
            <span class="text-kong-text-tertiary">
              Job #{jobId.slice(0, 8)}...
            </span>
            <span class="text-kong-text-tertiary">
              {CrossChainSwapMonitor.getElapsedTime(jobId)}
            </span>
          </div>
          
          <!-- Progress bar -->
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div 
              class="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style="width: {getProgress(swap.status)}%"
            />
          </div>
          
          {#if swap.error}
            <div class="text-xs text-red-500 mt-1">
              Error: {swap.error}
            </div>
          {/if}
          
          {#if swap.receiveTxSignature && swap.status === 'Confirmed'}
            <a 
              href="https://solscan.io/tx/{swap.receiveTxSignature}" 
              target="_blank"
              class="text-xs text-blue-500 hover:text-blue-400 underline"
            >
              View on Solscan →
            </a>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  /* Add any custom styles here */
</style>