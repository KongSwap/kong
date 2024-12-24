<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '$lib/components/common/Modal.svelte';
  import { TokenService } from '$lib/services/tokens/TokenService';
  import { kongDB } from '$lib/services/db';
  import { toastStore } from '$lib/stores/toastStore';

  const dispatch = createEventDispatcher();

  export let isOpen = true;

  let canisterId = '';
  let isLoading = false;
  let error = '';

  function onClose() {
    dispatch('close');
  }

  async function handleSubmit() {
    if (!canisterId) {
      error = 'Please enter a canister ID';
      return;
    }

    isLoading = true;
    error = '';

    try {
      // Check if token already exists
      const existingToken = await kongDB.tokens.get(canisterId);
      if (existingToken) {
        error = 'Token already exists';
        isLoading = false;
        return;
      }

      // Fetch token metadata and add to DB
      const token = await TokenService.fetchTokenMetadata(canisterId);
      if (token) {
        await kongDB.tokens.put(token);
        toastStore.success('Token added successfully');
        dispatch('close');
      } else {
        error = 'Invalid token canister';
      }
    } catch (e) {
      error = 'Failed to add token. Please check the canister ID.';
      console.error('Error adding custom token:', e);
    } finally {
      isLoading = false;
    }
  }
</script>

<Modal 
  {isOpen}
  {onClose}
  title="Add Custom Token"
>
  <div class="add-token-modal">
    <form on:submit|preventDefault={handleSubmit}>
      <div class="input-group">
        <label for="canisterId">Token Canister ID</label>
        <input
          id="canisterId"
          type="text"
          bind:value={canisterId}
          placeholder="Enter canister ID"
          disabled={isLoading}
        />
      </div>

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <div class="button-group">
        <button 
          type="button" 
          class="cancel-button" 
          on:click={() => dispatch('close')}
          disabled={isLoading}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          class="submit-button" 
          disabled={isLoading}
        >
          {isLoading ? 'Adding...' : 'Add Token'}
        </button>
      </div>
    </form>
  </div>
</Modal>

<style lang="postcss">
  .add-token-modal {
    padding: 1.5rem;
    width: 100%;
    max-width: 400px;
  }

  h2 {
    margin: 0 0 1.5rem;
    font-size: 1.5rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .input-group {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
  }

  input {
    width: 100%;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    color: white;
    font-size: 1rem;
  }

  input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.2);
  }

  input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-message {
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 0.5rem;
    color: rgb(239, 68, 68);
    font-size: 0.875rem;
  }

  .button-group {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  button {
    flex: 1;
    padding: 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cancel-button {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.7);
  }

  .cancel-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .submit-button {
    background: rgba(59, 130, 246, 0.5);
    color: white;
  }

  .submit-button:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.7);
  }
</style> 