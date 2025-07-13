<script lang="ts">
  import { modalManager, type SignatureModalProps } from '$lib/stores/modalManager';
  import Modal from '../Modal.svelte';
  import { Pen, AlertCircle, CheckCircle } from 'lucide-svelte';

  let {
    id,
    message,
    error = '',
    onSignatureComplete,
    ...modalProps
  }: SignatureModalProps & { id: string } = $props();

  let isOpen = $state(true);
  let isProcessing = $state(false);
  let isComplete = $state(false);

  function handleClose() {
    if (!isProcessing) {
      modalManager.close(id, false);
    }
  }

  function handleSignatureSuccess() {
    isComplete = true;
    if (onSignatureComplete) {
      onSignatureComplete();
    }
    
    // Auto-close after a short delay to show success state
    setTimeout(() => {
      modalManager.close(id, true);
    }, 1500);
  }

  // Listen for signature completion from external wallet
  $effect(() => {
    // This would typically listen to wallet events
    // For now, this is a placeholder for wallet integration
  });
</script>

<Modal
  bind:isOpen
  onClose={handleClose}
  width="480px"
  className="signature-modal"
  closeOnClickOutside={!isProcessing}
  closeOnEscape={!isProcessing}
  {...modalProps}
>
  <div class="flex flex-col gap-6 p-6">
    <!-- Header with Icon -->
    <div class="flex items-center gap-4">
      <div class="flex-shrink-0 p-3 rounded-full bg-kong-accent-primary/10">
        {#if isComplete}
          <CheckCircle size={24} class="text-green-500" />
        {:else if error}
          <AlertCircle size={24} class="text-red-500" />
        {:else}
          <Pen size={24} class="text-kong-accent-primary" />
        {/if}
      </div>
      
      <div class="flex-1">
        <h3 class="text-lg font-semibold text-kong-text-primary">
          {#if isComplete}
            Signature Complete
          {:else if error}
            Signature Error
          {:else}
            Signature Required
          {/if}
        </h3>
        
        <p class="text-sm text-kong-text-tertiary mt-1">
          {#if isComplete}
            Your transaction has been signed successfully
          {:else if error}
            There was an error with your signature
          {:else}
            Please approve this transaction in your wallet
          {/if}
        </p>
      </div>
    </div>

    <!-- Message Content -->
    <div class="p-4 rounded-lg bg-kong-bg-secondary border border-kong-border-primary">
      <div class="text-sm text-kong-text-primary whitespace-pre-wrap break-words">
        {message}
      </div>
    </div>

    <!-- Error Display -->
    {#if error}
      <div class="p-4 rounded-lg bg-red-50 border border-red-200">
        <div class="flex items-center gap-2">
          <AlertCircle size={16} class="text-red-500 flex-shrink-0" />
          <div class="text-sm text-red-700">{error}</div>
        </div>
      </div>
    {/if}

    <!-- Status Indicators -->
    {#if !isComplete && !error}
      <div class="flex items-center justify-center gap-3 py-4">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 bg-kong-accent-primary rounded-full animate-pulse"></div>
          <span class="text-sm text-kong-text-secondary">Waiting for signature...</span>
        </div>
      </div>
    {/if}

    <!-- Success State -->
    {#if isComplete}
      <div class="flex items-center justify-center gap-3 py-4">
        <div class="flex items-center gap-2 text-green-600">
          <CheckCircle size={16} />
          <span class="text-sm font-medium">Transaction signed successfully!</span>
        </div>
      </div>
    {/if}

    <!-- Action Buttons -->
    {#if !isComplete}
      <div class="flex gap-3 justify-end">
        {#if error}
          <button
            type="button"
            onclick={() => { error = ''; }}
            class="px-4 py-2 rounded-lg font-medium transition-colors duration-200 bg-kong-accent-primary hover:bg-kong-accent-secondary text-white"
          >
            Retry
          </button>
        {/if}
        
        <button
          type="button"
          onclick={handleClose}
          disabled={isProcessing}
          class="px-4 py-2 rounded-lg font-medium transition-colors duration-200 bg-kong-bg-secondary hover:bg-kong-bg-tertiary text-kong-text-secondary border border-kong-border-primary disabled:opacity-50"
        >
          {error ? 'Close' : 'Cancel'}
        </button>
      </div>
    {/if}
  </div>
</Modal>

<style>
  :global(.signature-modal .modal-content) {
    border-radius: 12px;
  }
</style>