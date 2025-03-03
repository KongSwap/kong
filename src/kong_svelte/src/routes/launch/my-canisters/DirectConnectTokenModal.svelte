<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import TextInput from "$lib/components/common/TextInput.svelte";
  import { toastStore } from "$lib/stores/toastStore";
  import { fade } from "svelte/transition";
  
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
  
  // Handle escape key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen) {
      onClose();
    }
  }
  
  // Handle click outside
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
  
  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });
  
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

{#if isOpen}
  <div 
    class="fixed inset-0 flex items-center justify-center z-[100000]" 
    on:click={handleBackdropClick}
    transition:fade={{ duration: 200 }}
  >
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black bg-opacity-70"></div>
    
    <!-- Modal Content -->
    <div 
      class="relative bg-gray-900 rounded-lg shadow-xl w-[450px] max-w-full mx-4"
      transition:fade={{ duration: 150 }}
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-800">
        <h3 class="text-lg font-medium text-white">Connect Token</h3>
        <button 
          class="text-gray-400 hover:text-white"
          on:click={onClose}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <!-- Body -->
      <div class="p-4 space-y-4">
        <p class="text-sm text-gray-300">
          Enter the canister ID of the token's <span class="font-bold text-yellow-400">Proof of Work (PoW) canister</span> you want to connect to this miner. This is the token's mining canister, not the ledger/coin canister.
        </p>
        
        <div class="bg-gray-800 p-3 rounded-md border border-yellow-500/30">
          <p class="text-xs text-yellow-400 flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Important: You must connect to the token's PoW canister, not its ledger canister. The PoW canister is responsible for mining operations.</span>
          </p>
        </div>
        
        <TextInput
          id="token-canister-id"
          label="Token PoW Canister ID"
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
    </div>
  </div>
{/if} 