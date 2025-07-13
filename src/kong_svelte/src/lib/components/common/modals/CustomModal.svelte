<script lang="ts">
  import { modalManager, type CustomModalProps } from '$lib/stores/modalManager';
  import Modal from '../Modal.svelte';

  let {
    id,
    component,
    props: customProps = {},
    ...modalProps
  }: CustomModalProps & { id: string } = $props();

  let isOpen = $state(true);

  function handleClose(result?: any) {
    modalManager.close(id, result);
  }

  // Provide close function to custom component via props
  const enhancedProps = $derived({
    ...customProps,
    onClose: handleClose,
    modalId: id
  });
</script>

<Modal
  bind:isOpen
  onClose={handleClose}
  className="custom-modal"
  {...modalProps}
>
  {#if component}
    <svelte:component this={component} {...enhancedProps} />
  {:else}
    <div class="p-6 text-center text-kong-text-tertiary">
      <div class="text-lg mb-2">Invalid Modal</div>
      <div class="text-sm">No component provided for custom modal</div>
      <button
        type="button"
        onclick={() => handleClose()}
        class="mt-4 px-4 py-2 rounded-lg bg-kong-accent-primary text-white hover:bg-kong-accent-secondary transition-colors"
      >
        Close
      </button>
    </div>
  {/if}
</Modal>

<style>
  :global(.custom-modal .modal-content) {
    border-radius: 12px;
  }
</style>