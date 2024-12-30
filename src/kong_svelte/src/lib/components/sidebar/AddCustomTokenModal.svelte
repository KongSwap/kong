<script lang="ts">
	import { formatTokenBalance } from '$lib/utils/tokenFormatters';
  import { createEventDispatcher } from 'svelte';
  import Modal from '$lib/components/common/Modal.svelte';
  import { TokenService } from '$lib/services/tokens/TokenService';
  import { kongDB } from '$lib/services/db';
  import { toastStore } from '$lib/stores/toastStore';
  import { IcrcService } from '$lib/services/icrc/IcrcService';
  import { auth } from '$lib/services/auth';
  import { get } from 'svelte/store';

  const dispatch = createEventDispatcher();

  export let isOpen = true;

  let canisterId = '';
  let isLoading = false;
  let error = '';
  let tokenPreview: FE.Token | null = null;
  let step: 'input' | 'preview' = 'input';

  function onClose() {
    dispatch('close');
  }

  async function handleSearch() {
    if (!canisterId) {
      error = 'Please enter a canister ID';
      return;
    }

    isLoading = true;
    error = '';
    tokenPreview = null;

    try {
      // Check if token already exists
      const existingToken = await kongDB.tokens.get(canisterId);
      if (existingToken) {
        error = 'Token already exists';
        isLoading = false;
        return;
      }

      // Fetch token metadata
      const token = await TokenService.fetchTokenMetadata(canisterId);
      if (token) {
        // Fetch user's balance if connected
        if (get(auth).isConnected) {
          const balance = await IcrcService.getIcrc1Balance(token, get(auth).account.owner);
          token.balance = balance.toString();
        }
        tokenPreview = token;
        step = 'preview';
      } else {
        error = 'Invalid token canister';
      }
    } catch (e) {
      error = 'Failed to find token. Please check the canister ID.';
      console.error('Error searching token:', e);
    } finally {
      isLoading = false;
    }
  }

  async function handleConfirm() {
    if (!tokenPreview) return;
    
    isLoading = true;
    try {
      await kongDB.tokens.put(tokenPreview);
      toastStore.success('Token added successfully');
      dispatch('close');
    } catch (e) {
      error = 'Failed to add token';
      console.error('Error adding token:', e);
    } finally {
      isLoading = false;
    }
  }
</script>

<Modal 
  {isOpen}
  {onClose}
  title="Import Token"
  height="auto"
>
  <div class="fl" on:click|stopPropagation>
    {#if step === 'input'}
      <form on:submit|preventDefault={handleSearch} class="form-content">
        <div class="input-section">
          <div class="input-group">
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
        </div>

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
            {isLoading ? 'Searching...' : 'Search Token'}
          </button>
        </div>
      </form>
    {:else if step === 'preview' && tokenPreview}
      <div class="preview-content">
        <div class="token-preview">
          <div class="token-header">
            {#if tokenPreview.logo_url}
              <img 
                src={tokenPreview.logo_url} 
                alt={tokenPreview.symbol}
                class="token-logo"
              />
            {:else}
              <div class="token-logo-placeholder">
                {tokenPreview.symbol?.[0] || '?'}
              </div>
            {/if}
            <div class="token-info">
              <h3>{tokenPreview.name}</h3>
              <p class="token-symbol">{tokenPreview.symbol}</p>
            </div>
          </div>

          <div class="token-details">
            <div class="detail-row">
              <span class="detail-label">Canister ID</span>
              <code class="detail-value">{tokenPreview.canister_id}</code>
            </div>
            {#if get(auth).isConnected}
              <div class="detail-row">
                <span class="detail-label">Your Balance</span>
                <span class="detail-value highlight">
                  {formatTokenBalance(tokenPreview.balance, tokenPreview.decimals)} {tokenPreview.symbol}
                </span>
              </div>
            {/if}
            <div class="detail-row">
              <span class="detail-label">Decimals</span>
              <span class="detail-value">{tokenPreview.decimals}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Total Supply</span>
              <span class="detail-value">{formatTokenBalance(tokenPreview.metrics?.total_supply.toString(), tokenPreview.decimals)} {tokenPreview.symbol}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Fee</span>
              <span class="detail-value">{formatTokenBalance(tokenPreview.fee.toString(), tokenPreview.decimals)} {tokenPreview.symbol}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Standards</span>
              <div class="standards-list">
                {#if tokenPreview.icrc1}<span class="standard-tag">ICRC-1</span>{/if}
                {#if tokenPreview.icrc2}<span class="standard-tag">ICRC-2</span>{/if}
                {#if tokenPreview.icrc3}<span class="standard-tag">ICRC-3</span>{/if}
              </div>
            </div>
          </div>

          <div class="button-group">
            <button 
              type="button" 
              class="cancel-button" 
              on:click={() => step = 'input'}
              disabled={isLoading}
            >
              Back
            </button>
            <button 
              type="button" 
              class="submit-button" 
              on:click={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Adding...' : 'Add Token'}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</Modal>

<style lang="postcss">
  .add-token-modal {
    width: 100%;
    min-width: min(480px, calc(100vw - 2rem));
    max-width: 100%;
  }

  .form-content,
  .preview-content {
    padding: 1.5rem;
  }

  .input-section {
    flex: 1;
    min-height: 0;
  }

  .input-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
  }

  input {
    width: 100%;
    padding: 0.875rem 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    color: white;
    font-size: 1rem;
    transition: all 0.2s;
  }

  input:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1);
  }

  input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .error-message {
    margin: 1rem 0;
    padding: 0.875rem 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 0.75rem;
    color: rgb(239, 68, 68);
    font-size: 0.875rem;
  }

  .button-group {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
  }

  button {
    flex: 1;
    padding: 0.875rem;
    border-radius: 0.75rem;
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
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .cancel-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .submit-button {
    background: rgb(59, 130, 246);
    color: white;
    border: 1px solid rgba(59, 130, 246, 0.5);
  }

  .submit-button:hover:not(:disabled) {
    background: rgb(29, 100, 216);
  }

  /* Token Preview Styles */
  .token-preview {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .token-header {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 0.5rem;
  }

  .token-logo {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 50%;
    object-fit: cover;
  }

  .token-logo-placeholder {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
    font-weight: 500;
    color: white;
  }

  .token-info h3 {
    margin: 0 0 0.375rem;
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
    line-height: 1.2;
  }

  .token-symbol {
    margin: 0;
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .token-details {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 1.25rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
  }

  .detail-row:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .detail-label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .detail-value {
    color: white;
    font-size: 0.875rem;
  }

  code.detail-value {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8125rem;
  }

  .standards-list {
    display: flex;
    gap: 0.5rem;
  }

  .standard-tag {
    background: rgba(59, 130, 246, 0.15);
    color: rgb(96, 165, 250);
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.025em;
  }

  .detail-value.highlight {
    color: rgb(96, 165, 250);
    font-weight: 500;
  }
</style> 