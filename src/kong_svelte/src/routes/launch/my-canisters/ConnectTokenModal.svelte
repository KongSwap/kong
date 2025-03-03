<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  
  // Props
  export let isOpen = false;
  export let onClose: () => void;
  
  // State
  let canisterId = "";
  let isSubmitting = false;
  let error = "";
  
  const dispatch = createEventDispatcher<{
    connect: string;
  }>();
  
  function handleSubmit() {
    // Validate canister ID
    if (!canisterId.trim()) {
      error = "Please enter a canister ID";
      return;
    }
    
    // Reset error
    error = "";
    isSubmitting = true;
    
    try {
      // Dispatch the connect event with the canister ID
      dispatch("connect", canisterId.trim());
      
      // Reset form
      canisterId = "";
      
      // Close modal
      onClose();
    } catch (err) {
      console.error("Error connecting token:", err);
      toastStore.error("Failed to connect token");
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Modal
  {isOpen}
  title="Connect Token"
  onClose={onClose}
  width="450px"
  height="auto"
  variant="transparent"
  modalKey="connect-token-modal"
>
  <div class="p-4 space-y-4">
    <p class="text-sm text-gray-300">
      Enter the canister ID of the token you want to connect to this miner.
    </p>
    
    <TextInput
      id="token-canister-id"
      label="Token Canister ID"
      bind:value={canisterId}
      placeholder="e.g. ryjl3-tyaaa-aaaaa-aaaba-cai"
      error={error}
      required={true}
      on:keydown={(e) => {
        if (e.key === 'Enter' && canisterId.trim()) {
          handleSubmit();
        }
      }}
    />
    
    <div class="flex justify-end space-x-3 pt-2">
      <button
        on:click={onClose}
        class="px-4 py-2 text-gray-300 transition-colors bg-gray-700 rounded-md hover:bg-gray-600"
      >
        Cancel
      </button>
      <button
        on:click={handleSubmit}
        disabled={isSubmitting || !canisterId.trim()}
        class="px-4 py-2 text-white transition-colors bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if isSubmitting}
          <span class="inline-block w-4 h-4 mr-1 border-2 rounded-full border-t-white border-b-white animate-spin"></span>
        {/if}
        Connect
      </button>
    </div>
  </div>
</Modal> 