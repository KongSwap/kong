<script lang="ts">
  import { modalManager, type ConfirmationModalProps } from '$lib/stores/modalManager';
  import Modal from '../Modal.svelte';
  import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-svelte';

  let {
    id,
    variant = 'info',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    ...modalProps
  }: ConfirmationModalProps & { id: string } = $props();

  let isOpen = $state(true);
  let isLoading = $state(false);

  // Variant styling
  const variantStyles = {
    danger: {
      icon: XCircle,
      iconClass: 'text-red-500',
      confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
      borderClass: 'border-red-200'
    },
    warning: {
      icon: AlertTriangle,
      iconClass: 'text-yellow-500',
      confirmClass: 'bg-yellow-600 hover:bg-yellow-700 text-white',
      borderClass: 'border-yellow-200'
    },
    info: {
      icon: Info,
      iconClass: 'text-blue-500',
      confirmClass: 'bg-blue-600 hover:bg-blue-700 text-white',
      borderClass: 'border-blue-200'
    },
    success: {
      icon: CheckCircle,
      iconClass: 'text-green-500',
      confirmClass: 'bg-green-600 hover:bg-green-700 text-white',
      borderClass: 'border-green-200'
    }
  };

  const currentVariant = $derived(variantStyles[variant]);
  const IconComponent = $derived(currentVariant.icon);

  async function handleConfirm() {
    if (isLoading) return;
    
    try {
      isLoading = true;
      
      if (onConfirm) {
        await onConfirm();
      }
      
      modalManager.close(id, true);
    } catch (error) {
      console.error('Confirmation error:', error);
    } finally {
      isLoading = false;
    }
  }

  function handleCancel() {
    if (isLoading) return;
    
    if (onCancel) {
      onCancel();
    }
    
    modalManager.close(id, false);
  }

  function handleClose() {
    handleCancel();
  }
</script>

<Modal
  bind:isOpen
  onClose={handleClose}
  width="480px"
  className="confirmation-modal"
  {...modalProps}
>
  <div class="flex flex-col gap-6 p-6">
    <!-- Icon and Message -->
    <div class="flex items-start gap-4">
      <div class="flex-shrink-0 mt-1">
        <IconComponent size={24} class={currentVariant.iconClass} />
      </div>
      <div class="flex-1">
        <div class="text-kong-text-primary text-base leading-relaxed">
          {message}
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex gap-3 justify-end">
      <button
        type="button"
        class="px-4 py-2 rounded-lg font-medium transition-colors duration-200 bg-kong-bg-secondary hover:bg-kong-bg-tertiary text-kong-text-secondary border border-kong-border-primary"
        onclick={handleCancel}
        disabled={isLoading}
      >
        {cancelText}
      </button>
      
      <button
        type="button"
        class="px-4 py-2 rounded-lg font-medium transition-colors duration-200 {currentVariant.confirmClass} disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        onclick={handleConfirm}
        disabled={isLoading}
      >
        {#if isLoading}
          <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        {/if}
        {confirmText}
      </button>
    </div>
  </div>
</Modal>

<style>
  :global(.confirmation-modal .modal-content) {
    border-radius: 12px;
  }
</style>