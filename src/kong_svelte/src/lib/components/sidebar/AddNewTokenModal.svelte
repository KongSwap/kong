<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { addToken, fetchTokenMetadata } from "$lib/api/tokens";
  import { auth } from "$lib/services/auth";
  import { loadBalances } from "$lib/services/tokens/tokenStore";
  import { userTokens } from "$lib/stores/userTokens";
  import { get } from "svelte/store";
  import { toastStore } from "$lib/stores/toastStore";
  import { debounce } from "$lib/utils/debounce";
  import { fade } from "svelte/transition";
    import BigNumber from "bignumber.js";
    import { tokenData } from "$lib/stores/tokenData";

  // Props
  const props = $props<{
    isOpen: boolean;
    onClose: () => void;
  }>();

  // State
  let customTokenCanisterId = $state("");
  let isAddingCustomToken = $state(false);
  let customTokenError = $state("");
  let isLoadingPreview = $state(false);
  let previewToken = $state<FE.Token | null>(null);
  let lastPreviewedCanisterId = $state("");

  const dispatch = createEventDispatcher<{
    tokenAdded: FE.Token;
  }>();

  // Reset form when modal opens
  $effect(() => {
    if (props.isOpen) {
      customTokenCanisterId = "";
      customTokenError = "";
      previewToken = null;
      lastPreviewedCanisterId = "";
    }
  });

  // Helper function to safely convert any potential BigInt values to strings
  function safeStringify(value: any): any {
    if (typeof value === 'bigint') {
      return value.toString();
    } else if (Array.isArray(value)) {
      return value.map(safeStringify);
    } else if (value !== null && typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const key in value) {
        result[key] = safeStringify(value[key]);
      }
      return result;
    }
    return value;
  }

  // Format canister ID for preview and validation
  function formatCanisterId(canisterId: string): string | null {
    const trimmed = canisterId.trim();
    
    // If it already has the IC. prefix, just return it
    if (trimmed.startsWith("IC.")) {
      return trimmed;
    }
    
    // If it's a valid canister ID format (contains hyphens), add the IC. prefix
    if (trimmed.includes("-")) {
      return `IC.${trimmed}`;
    }
    
    // Invalid format
    return null;
  }

  // Load token preview
  async function loadTokenPreview(forceRefresh = false) {
    console.log("loadTokenPreview called with:", customTokenCanisterId, "forceRefresh:", forceRefresh);
    
    if (!customTokenCanisterId.trim()) {
      console.log("Empty canister ID, clearing preview");
      customTokenError = "";
      previewToken = null;
      return;
    }
    
    const formattedCanisterId = formatCanisterId(customTokenCanisterId);
    console.log("Formatted canister ID:", formattedCanisterId);
    
    if (!formattedCanisterId) {
      console.log("Invalid canister ID format");
      customTokenError = "Invalid canister ID format. Expected format: xxxxx-xxxxx-xxxxx-xxxxx-xxx";
      previewToken = null;
      return;
    }
    
    // Extract the actual canister ID without the IC. prefix
    const canisterId = formattedCanisterId.startsWith("IC.") 
      ? formattedCanisterId.substring(3) 
      : formattedCanisterId;
    
    console.log("Extracted canister ID for API call:", canisterId);
    
    // Skip if we've already previewed this canister ID AND we have a preview token
    // This prevents skipping when we have an error but the lastPreviewedCanisterId is set
    if (!forceRefresh && canisterId === lastPreviewedCanisterId && previewToken !== null) {
      console.log("Skipping preview, already previewed this canister ID and have a token");
      return;
    }
    
    isLoadingPreview = true;
    customTokenError = "";
    
    try {
      console.log("Fetching token metadata for:", canisterId);
      const token = await fetchTokenMetadata(canisterId);
      console.log("Token metadata result:", token);
      
      if (token) {
        console.log("Setting preview token:", token);
        previewToken = token;
        // Only update lastPreviewedCanisterId after a successful API call
        lastPreviewedCanisterId = canisterId;
      } else {
        console.log("No token metadata returned");
        customTokenError = "Could not fetch token metadata. Please check the canister ID.";
        previewToken = null;
      }
    } catch (error) {
      console.error('Error fetching token preview:', error);
      customTokenError = error instanceof Error 
        ? error.message 
        : "Failed to fetch token preview. Please check the canister ID.";
      previewToken = null;
    } finally {
      isLoadingPreview = false;
    }
  }

  // Create a debounced version of the preview function
  const debouncedPreview = debounce(() => loadTokenPreview(false), 500);

  // Function to reset preview state when canister ID changes significantly
  function resetPreviewIfNeeded(newCanisterId: string) {
    // If the canister ID has changed significantly (more than just formatting),
    // reset the preview state to ensure we get a fresh preview
    if (lastPreviewedCanisterId && newCanisterId) {
      const strippedNew = newCanisterId.replace(/[^a-zA-Z0-9]/g, '');
      const strippedLast = lastPreviewedCanisterId.replace(/[^a-zA-Z0-9]/g, '');
      
      // If the alphanumeric parts don't match, reset the preview
      if (strippedNew !== strippedLast) {
        console.log("Canister ID changed significantly, resetting preview state");
        previewToken = null;
        lastPreviewedCanisterId = "";
      }
    }
  }

  // Watch for changes to the canister ID and trigger preview
  $effect(() => {
    if (customTokenCanisterId.trim()) {
      console.log("Canister ID changed, triggering preview:", customTokenCanisterId);
      // Reset preview if needed
      resetPreviewIfNeeded(customTokenCanisterId);
      // Use the debounced version to prevent too many API calls while typing
      debouncedPreview();
    } else {
      previewToken = null;
      customTokenError = "";
    }
  });

  // Handle adding a custom token
  async function handleAddNewToken() {
    console.log("handleAddNewToken called with canisterId:", customTokenCanisterId);
    
    if (!customTokenCanisterId.trim()) {
      console.log("Empty canister ID, showing error");
      customTokenError = "Please enter a valid canister ID";
      return;
    }
    
    // Format the canister ID if needed
    const formattedCanisterId = formatCanisterId(customTokenCanisterId);
    console.log("Formatted canister ID for adding:", formattedCanisterId);
    
    if (!formattedCanisterId) {
      console.log("Invalid canister ID format");
      customTokenError = "Invalid canister ID format. Expected format: xxxxx-xxxxx-xxxxx-xxxxx-xxx";
      return;
    }
    
    // Check if user is authenticated
    const authStore = get(auth);
    console.log("Auth store state:", authStore);
    
    if (!authStore.isConnected) {
      console.log("User is not authenticated");
      customTokenError = "You need to be logged in to add a token";
      toastStore.error("Please connect your wallet to add a token");
      return;
    }
    
    isAddingCustomToken = true;
    customTokenError = "";
    
    try {
      // Always call the addToken API regardless of whether we have a preview token
      console.log("Calling addToken API with:", formattedCanisterId);
      
      try {
        const tokenReply = await addToken(formattedCanisterId);
        console.log("addToken API response:", tokenReply);
      } catch (apiError) {
        console.error("Error calling addToken API:", apiError);
        // Continue with the process even if the backend API call fails
        // This allows users to still add tokens to their local list
        toastStore.warning(`Token added locally only. Backend registration failed: ${apiError.message}`);
      }
      
      // If we have a preview token, use it for the UI
      let tokenToAdd: FE.Token;
      
      if (previewToken) {
        console.log("Using preview token for UI:", previewToken);
        tokenToAdd = previewToken;
      } else {
        // If we don't have a preview token, we can't proceed
        console.error("No preview token available and backend call failed");
        throw new Error("Failed to get token information. Please try again.");
      }
      
      // Enable the token in userTokens store
      console.log("Enabling token in userTokens store");
      userTokens.enableToken(tokenToAdd);
      
      // Load balance for the newly enabled token if user is connected
      if (authStore?.account?.owner) {
        console.log("Loading balances for newly added token");
        loadBalances(authStore.account.owner.toString(), { 
          tokens: [tokenToAdd],
          forceRefresh: true 
        }).catch(e => console.error("Failed to load balances:", e));
      }
      
      // Dispatch event to parent
      console.log("Dispatching tokenAdded event");
      dispatch('tokenAdded', tokenToAdd);
      toastStore.success(`Token ${tokenToAdd.name} added successfully`);
      
      // Close the modal
      console.log("Closing modal");
      props.onClose();
    } catch (error) {
      console.error('Error adding custom token:', error);
      customTokenError = error instanceof Error ? error.message : "Failed to add token. Please check the canister ID and try again.";
      toastStore.error(customTokenError);
    } finally {
      isAddingCustomToken = false;
    }
  }
</script>

<Modal
  isOpen={props.isOpen}
  title="Add New Token"
  onClose={props.onClose}
  loading={isAddingCustomToken}
  width="550px"
  isPadded={true}
  variant="transparent"
>
  <div class="custom-token-modal-content px-2">
    <p class="text-sm text-kong-text-secondary mb-4">
      Enter the canister ID of the token you want to add. Token details will be automatically previewed.
    </p>
    
    <div class="form-group">
      <label for="canister-id" class="form-label">Canister ID</label>
      <div class="input-container">
        <input
          id="canister-id"
          type="text"
          bind:value={customTokenCanisterId}
          placeholder="e.g. ryjl3-tyaaa-aaaaa-aaaba-cai"
          class="form-input {customTokenError ? 'error' : ''}"
          on:keydown={(e) => {
            if (e.key === 'Enter' && customTokenCanisterId.trim()) {
              handleAddNewToken();
            }
          }}
        />
        {#if isLoadingPreview}
          <div class="input-loading-indicator">
            <div class="button-spinner"></div>
          </div>
        {:else if customTokenCanisterId.trim()}
          <button 
            class="refresh-button" 
            title="Refresh token preview"
            on:click={() => loadTokenPreview(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M3 22v-6h6"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
          </button>
        {/if}
      </div>
      {#if customTokenError}
        <p class="error-message">{customTokenError}</p>
      {/if}
    </div>
    
    {#if previewToken}
        <div class="token-card"  transition:fade={{ duration: 200 }}>
          <div class="token-icon">
            {#if previewToken.logo_url}
              <img src={previewToken.logo_url} alt={previewToken.symbol} class="token-logo" />
            {:else}
              <div class="token-logo-placeholder">{previewToken.symbol.substring(0, 2)}</div>
            {/if}
          </div>
          <div class="token-details">
            <div class="token-name-row">
              <span class="token-symbol">{previewToken.symbol}</span>
              <span class="token-name">{previewToken.name}</span>
            </div>
            <div class="token-info-grid">
              <div class="token-info-item">
                <span class="info-label">Canister ID</span>
                <span class="info-value">{previewToken.canister_id}</span>
              </div>
              <div class="token-info-item">
                <span class="info-label">Decimals</span>
                <span class="info-value">{previewToken.decimals}</span>
              </div>
              <div class="token-info-item">
                <span class="info-label">Fee</span>
                <span class="info-value">{BigNumber(previewToken.fee.toString()).div(BigNumber(10).pow(previewToken.decimals))}</span>
              </div>
              <div class="token-info-item">
                <span class="info-label">Standards</span>
                <span class="info-value">
                  {[
                    previewToken.icrc1 ? 'ICRC-1' : '',
                    previewToken.icrc2 ? 'ICRC-2' : '',
                    previewToken.icrc3 ? 'ICRC-3' : ''
                  ].filter(Boolean).join(', ') || 'None'}
                </span>
              </div>
            </div>
          </div>
        </div>
    {/if}
    
    <div class="modal-actions">
      <button 
        class="cancel-button" 
        on:click={props.onClose}
      >
        Cancel
      </button>
      <button 
        class="add-button" 
        disabled={isAddingCustomToken || isLoadingPreview || (!previewToken && !!customTokenError)}
        on:click={() => {
          console.log("Add Token button clicked");
          handleAddNewToken();
        }}
      >
        {#if isAddingCustomToken}
          <div class="button-spinner"></div>
          <span>Adding...</span>
        {:else}
          <span>Add Token</span>
        {/if}
      </button>
    </div>
  </div>
</Modal>

<style scoped lang="postcss">
  /* Modal styles */
  .custom-token-modal-content {
    @apply flex flex-col;
  }

  .form-group {
    @apply mb-6;
  }

  .form-label {
    @apply block text-sm font-medium text-kong-text-primary mb-2;
  }

  .input-container {
    @apply relative;
  }

  .form-input {
    @apply w-full px-3 py-2.5 bg-kong-bg-dark/70 border border-kong-border/40
           rounded-lg text-kong-text-primary placeholder-kong-text-secondary/70
           focus:outline-none focus:ring-1 focus:ring-kong-accent-blue/40;
  }

  .form-input.error {
    @apply border-kong-accent-red/70 focus:ring-kong-accent-red/40;
  }

  .input-loading-indicator {
    @apply absolute right-3 top-1/2 transform -translate-y-1/2;
  }

  .error-message {
    @apply mt-1.5 text-sm text-kong-accent-red;
  }

  .token-card {
    @apply flex items-center gap-4 bg-kong-bg-dark p-3 mb-4 rounded-lg border border-kong-border/20;
  }

  .token-icon {
    @apply flex-shrink-0;
  }

  .token-logo {
    @apply w-12 h-12 rounded-full object-cover bg-kong-bg-light/30;
  }

  .token-logo-placeholder {
    @apply w-12 h-12 rounded-full bg-kong-primary/20 text-kong-primary
           flex items-center justify-center font-bold text-lg;
  }

  .token-details {
    @apply flex-1 min-w-0;
  }

  .token-name-row {
    @apply flex items-center gap-2 mb-2;
  }

  .token-symbol {
    @apply font-bold text-kong-text-primary;
  }

  .token-name {
    @apply text-sm text-kong-text-secondary truncate;
  }

  .token-info-grid {
    @apply grid grid-cols-2 gap-x-4 gap-y-2;
  }

  .token-info-item {
    @apply flex flex-col;
  }

  .info-label {
    @apply text-xs text-kong-text-secondary;
  }

  .info-value {
    @apply text-sm text-kong-text-primary truncate;
  }

  .modal-actions {
    @apply flex justify-end gap-3 mt-4;
  }

  .cancel-button {
    @apply px-4 py-2 bg-kong-bg-dark/70 text-kong-text-primary rounded-md
           hover:bg-kong-bg-dark/90 transition-colors;
  }

  .add-button {
    @apply flex items-center gap-2 px-4 py-2 bg-kong-primary text-white rounded-md
           hover:bg-kong-primary-hover transition-colors
           disabled:opacity-70 disabled:cursor-not-allowed;
  }

  .button-spinner {
    @apply w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin;
  }

  .refresh-button {
    @apply absolute right-3 top-1/2 transform -translate-y-1/2
           text-kong-text-secondary hover:text-kong-text-primary
           p-1 rounded-full hover:bg-kong-bg-light/20 transition-colors;
  }
</style> 