<script lang="ts">
  import { SolanaService } from '$lib/services/solana/SolanaService';
  import Button from '$lib/components/common/Button.svelte';
  import { onMount } from 'svelte';

  export let amount: number | null = null;
  export let showTransferButton = false;
  
  let kongAddress = '';
  let loading = false;

  onMount(async () => {
    try {
      loading = true;
      kongAddress = await SolanaService.getKongSolanaAddress();
    } catch (error) {
      console.error('Failed to get Kong Solana address:', error);
    } finally {
      loading = false;
    }
  });

  function copyAddress() {
    navigator.clipboard.writeText(kongAddress);
  }

  function openInSolana() {
    window.open(`https://explorer.solana.com/address/${kongAddress}`, '_blank');
  }
</script>

<div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
  <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
    Kong Solana Address
  </h3>
  
  {#if loading}
    <div class="animate-pulse">
      <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
      <div class="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
    </div>
  {:else if kongAddress}
    <div class="space-y-3">
      <div class="p-3 bg-white dark:bg-gray-700 rounded-lg border">
        <code class="text-sm font-mono break-all text-gray-900 dark:text-gray-100">
          {kongAddress}
        </code>
      </div>
      
      {#if amount}
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Send: <span class="font-medium">{amount} SOL</span>
        </p>
      {/if}
      
      <div class="flex gap-2">
        <Button variant="secondary" size="sm" on:click={copyAddress}>
          📋 Copy
        </Button>
        
        <Button variant="secondary" size="sm" on:click={openInSolana}>
          🔍 View on Explorer
        </Button>
        
        {#if showTransferButton}
          <Button 
            variant="primary" 
            size="sm"
            on:click={() => window.open(`https://phantom.app/ul/browse/https://explorer.solana.com/address/${kongAddress}?cluster=mainnet-beta`, '_blank')}
          >
            📱 Open in Phantom
          </Button>
        {/if}
      </div>
    </div>
  {:else}
    <p class="text-sm text-red-600 dark:text-red-400">
      Failed to load Kong Solana address
    </p>
  {/if}
</div>