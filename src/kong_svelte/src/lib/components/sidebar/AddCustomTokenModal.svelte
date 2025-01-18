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
  variant="transparent"
  title="Import Token"
  height="auto"
>
  <div class="fl" on:click|stopPropagation>
    {#if step === 'input'}
      <div class="import-instructions">
        <div class="warning-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>Make sure you trust this token before importing it.</span>
        </div>
        <div class="instruction-steps">
          <h3>How to import a token:</h3>
          <ol>
            <li>Find the token's canister ID (e.g. from the project's documentation)</li>
            <li>Enter the canister ID below</li>
            <li>Verify the token details before confirming</li>
          </ol>
        </div>
      </div>

      <form on:submit|preventDefault={handleSearch} class="form-content">
        <div class="input-section">
          <label for="canisterId" class="input-label">Token Canister ID</label>
          <div class="input-group">
            <input
              id="canisterId"
              type="text"
              bind:value={canisterId}
              placeholder="ryjl3-tyaaa-aaaaa-aaaba-cai"
              disabled={isLoading}
            />
          </div>

          {#if error}
            <div class="error-message">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
            </div>
          {/if}
        </div>

        <div class="button-group pb-4">
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
            disabled={isLoading || !canisterId}
          >
            {#if isLoading}
              <span class="loading-spinner"></span>
              <span>Searching...</span>
            {:else}
              Search Token
            {/if}
          </button>
        </div>
      </form>
    {:else if step === 'preview' && tokenPreview}
      <div class="preview-content">
        <div class="warning-box mb-4" class:error={!tokenPreview.icrc1 && !tokenPreview.icrc2}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            {#if !tokenPreview.icrc1 && !tokenPreview.icrc2}
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            {:else}
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            {/if}
          </svg>
          <div class="warning-content">
            {#if !tokenPreview.icrc1 && !tokenPreview.icrc2}
              <span class="warning-title error">Token Not Supported</span>
              <span class="warning-text error">This token does not implement the required ICRC standards.</span>
            {:else}
              <span class="warning-title">Verify Token Details</span>
              <span class="warning-text">Make sure all information matches the official documentation.</span>
            {/if}
          </div>
        </div>

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

          <div class="s">
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
              <span class="detail-value">
                {formatTokenBalance(tokenPreview.metrics?.total_supply.toString(), tokenPreview.decimals)} {tokenPreview.symbol}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Fee</span>
              <span class="detail-value">
                {formatTokenBalance(tokenPreview.fee.toString(), tokenPreview.decimals)} {tokenPreview.symbol}
              </span>
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

          <div class="confirmation-section">
            <div class="button-group pb-4">
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
                class:error={!tokenPreview.icrc1 && !tokenPreview.icrc2}
                on:click={handleConfirm}
                disabled={isLoading || !tokenPreview.icrc1}
              >
                {#if isLoading}
                  <span class="loading-spinner"></span>
                  <span>Adding Token...</span>
                {:else if !tokenPreview.icrc1 && !tokenPreview.icrc2}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>Not Supported</span>
                {:else}
                  Import Token
                {/if}
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</Modal>

<style scoped lang="postcss">
  .add-token-modal {
    width: 100%;
    min-width: min(480px, calc(100vw - 2rem));
    max-width: 100%;
  }

  .form-content,
  .preview-content {
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
    @apply text-kong-text-primary/70;
  }

  input {
    width: 100%;
    padding: 0.875rem 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    @apply text-kong-text-primary;
    font-size: 1rem;
    transition: all 0.2s;
  }

  input:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1);
  }

  input::placeholder {
    @apply text-kong-text-primary/30;
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
    @apply text-kong-text-primary/70;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .cancel-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    @apply text-kong-text-primary;
  }

  .submit-button {
    background: rgb(59, 130, 246);
    @apply text-kong-text-primary;
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
    @apply text-kong-text-primary;
  }

  .token-info h3 {
    margin: 0 0 0.375rem;
    font-size: 1.5rem;
    font-weight: 600;
    @apply text-kong-text-primary;
    line-height: 1.2;
  }

  .token-symbol {
    margin: 0;
    font-size: 1rem;
    @apply text-kong-text-primary/70;
  }

  .s {
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
    @apply text-kong-text-primary/70;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .detail-value {
    @apply text-kong-text-primary;
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
    @apply text-kong-text-primary;
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.025em;
  }

  .detail-value.highlight {
    @apply text-kong-text-primary;
    font-weight: 500;
  }

  .import-instructions {
    @apply mb-6 space-y-4;
  }

  .warning-box {
    @apply flex items-start gap-3 p-3 rounded-lg;
    @apply bg-yellow-500/10 text-yellow-500;
    @apply transition-colors duration-200;
  }

  .warning-box.error {
    @apply bg-kong-accent-red/10 text-kong-accent-red;
  }

  .warning-title.error,
  .warning-text.error {
    @apply text-kong-accent-red;
  }

  .warning-content {
    @apply flex flex-col gap-0.5;
  }

  .warning-title {
    @apply font-medium;
  }

  .warning-text {
    @apply text-xs text-yellow-500/90;
  }

  .confirmation-section {

  }

  .confirmation-box {
    @apply flex items-start p-4 rounded-lg;
    @apply bg-kong-primary/5 border border-kong-primary/20;
  }

  .confirmation-box.error {
    @apply bg-kong-accent-red/5 border-kong-accent-red/20;
  }

  .confirmation-icon {
    @apply p-2 rounded-lg;
  }

  .confirmation-icon.success {
    @apply bg-kong-primary/10 text-kong-primary;
  }

  .confirmation-icon.error {
    @apply bg-kong-accent-red/10 text-kong-accent-red;
  }

  .confirmation-content {
    @apply flex flex-col;
  }

  .confirmation-title {
    @apply font-medium text-sm;
    &.success { @apply text-kong-primary; }
    &.error { @apply text-kong-accent-red; }
  }

  .confirmation-text {
    @apply text-xs text-kong-text-primary/70;
  }

  /* Update token details styling */
  .token-details {
    @apply bg-white/5 rounded-lg divide-y divide-white/5;
    @apply border border-white/10;
    @apply transition-colors duration-200;
  }

  .token-details:has(.standards-list:not(:has(.standard-tag))) {
    @apply border-kong-accent-red/20;
  }

  /* Make standard tags more prominent */
  .standard-tag {
    @apply bg-kong-primary/10 text-kong-primary;
    @apply px-3 py-1.5 rounded-lg text-xs font-medium;
    @apply border border-kong-primary/20;
    @apply flex items-center gap-2;
  }

  .standard-tag::before {
    content: "";
    @apply w-1.5 h-1.5 rounded-full bg-current;
  }

  .input-label {
    @apply block text-sm font-medium text-kong-text-primary/70 mb-2;
  }

  .input-group {
    @apply relative;
  }

  input {
    @apply w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-kong-text-primary;
    @apply placeholder:text-kong-text-primary/30;
    @apply focus:outline-none focus:border-kong-primary/50 focus:ring-1 focus:ring-kong-primary/50;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .error-message {
    @apply flex items-center gap-2 p-3 rounded-lg;
    @apply bg-kong-accent-red/10 text-kong-accent-red text-sm;
    @apply border border-kong-accent-red/20;
  }

  .button-group {
    @apply flex gap-3;
  }

  button {
    @apply flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .cancel-button {
    @apply bg-white/5 text-kong-text-primary/70 hover:bg-white/10 hover:text-kong-text-primary;
  }

  .submit-button {
    @apply bg-kong-primary text-white hover:bg-kong-bg-dark;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
    @apply transition-all duration-200;
  }

  .submit-button.error {
    @apply bg-kong-accent-red text-white hover:bg-kong-accent-red-hover;
    @apply cursor-not-allowed opacity-100;
  }

  .loading-spinner {
    @apply w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin;
  }

  .token-header {
    @apply flex items-center gap-4 p-3 rounded-lg bg-white/5;
  }

  .token-logo {
    @apply w-12 h-12 rounded-full;
  }

  .token-logo-placeholder {
    @apply w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-xl font-semibold text-kong-text-primary;
  }

  .token-info h3 {
    @apply text-lg font-semibold text-kong-text-primary mb-1;
  }

  .token-symbol {
    @apply text-sm text-kong-text-primary/70;
  }


  .standards-list:not(:has(.standard-tag)) {
    @apply text-kong-accent-red;
  }

  .standards-list:not(:has(.standard-tag))::after {
    content: "No supported standards found";
    @apply text-sm font-medium;
  }

  .detail-row {
    @apply flex items-center p-3;
    @apply transition-colors duration-200;
  }

  .detail-row:hover {
    @apply bg-white/[0.02];
  }

  code.detail-value {
    @apply bg-white/10 px-3 py-1.5 rounded-lg;
    @apply font-mono text-sm;
    @apply border border-white/5;
  }

  .standard-tag {
    @apply bg-kong-primary/10 text-kong-primary;
    @apply px-3 py-1.5 rounded-lg text-xs font-semibold;
    @apply border border-kong-primary/20;
  }
</style> 