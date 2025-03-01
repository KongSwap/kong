<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { addToken } from "$lib/api/tokens";
  import { auth } from "$lib/services/auth";
  import { loadBalances } from "$lib/services/tokens/tokenStore";
  import { userTokens } from "$lib/stores/userTokens";
  import { get } from "svelte/store";

  // Props
  const props = $props<{
    isOpen: boolean;
    onClose: () => void;
  }>();

  // State
  let customTokenCanisterId = $state("");
  let isAddingCustomToken = $state(false);
  let customTokenError = $state("");

  const dispatch = createEventDispatcher<{
    tokenAdded: FE.Token;
  }>();

  // Reset form when modal opens
  $effect(() => {
    if (props.isOpen) {
      customTokenCanisterId = "";
      customTokenError = "";
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

  // Handle adding a custom token
  async function handleAddCustomToken() {
    if (!customTokenCanisterId.trim()) {
      customTokenError = "Please enter a valid canister ID";
      return;
    }
    
    // Format the canister ID if needed
    let formattedCanisterId = customTokenCanisterId.trim();
    if (!formattedCanisterId.startsWith("IC.") && !formattedCanisterId.includes("-")) {
      customTokenError = "Invalid canister ID format. Expected format: IC.xxxxx-xxxxx-xxxxx-xxxxx-xxx";
      return;
    }
    
    isAddingCustomToken = true;
    customTokenError = "";
    
    try {
      // Call the addToken API
      const tokenReply = await addToken(formattedCanisterId);
      
      if (tokenReply && 'IC' in tokenReply) {
        // Extract token details from the response
        const icTokenDetails = tokenReply.IC;
        
        // Create a token object from the response, ensuring all values are safe for JSON
        const newToken = {
          canister_id: icTokenDetails.canister_id,
          name: icTokenDetails.name,
          symbol: icTokenDetails.symbol,
          decimals: icTokenDetails.decimals,
          fee: typeof icTokenDetails.fee === 'bigint' ? icTokenDetails.fee.toString() : icTokenDetails.fee,
          chain: icTokenDetails.chain || 'ICP',
          token_type: 'IC',
          address: icTokenDetails.canister_id,
          logo_url: '',  // Will be set by DEFAULT_LOGOS in the store
          fee_fixed: '0',
          token: 'IC',
          pool_symbol: '',
          pools: [],
          token_id: typeof icTokenDetails.token_id === 'bigint' ? icTokenDetails.token_id.toString() : icTokenDetails.token_id,
          icrc1: icTokenDetails.icrc1,
          icrc2: icTokenDetails.icrc2,
          icrc3: icTokenDetails.icrc3,
          total_24h_volume: "0",
          balance: "0",
          metrics: {
            price: "0",
            volume_24h: "0",
            total_supply: "0",
            market_cap: "0",
            tvl: "0",
            updated_at: "0",
            price_change_24h: "0"
          }
        } as FE.Token;
        
        // Process the token object to ensure all BigInt values are converted to strings
        const safeToken = safeStringify(newToken) as FE.Token;
        
        // Enable the token in userTokens store
        userTokens.enableToken(safeToken);
        
        // Load balance for the newly enabled token if user is connected
        const authStore = get(auth);
        if (authStore?.isConnected && authStore?.account?.owner) {
          loadBalances(authStore.account.owner.toString(), { 
            tokens: [safeToken],
            forceRefresh: true 
          }).catch(e => console.error("Failed to load balances:", e));
        }
        
        // Dispatch event to parent
        dispatch('tokenAdded', safeToken);
        
        // Close the modal
        props.onClose();
      } else {
        customTokenError = "Failed to add token. Invalid response from server.";
      }
    } catch (error) {
      console.error('Error adding custom token:', error);
      customTokenError = error instanceof Error ? error.message : "Failed to add token. Please check the canister ID and try again.";
    } finally {
      isAddingCustomToken = false;
    }
  }
</script>

<Modal
  isOpen={props.isOpen}
  title="Add Custom Token"
  onClose={props.onClose}
  loading={isAddingCustomToken}
  width="450px"
  isPadded={true}
>
  <div class="custom-token-modal-content">
    <p class="text-sm text-kong-text-secondary mb-4">
      Enter the canister ID of the token you want to add. This should be in the format of "IC.xxxxx-xxxxx-xxxxx-xxxxx-xxx" for IC tokens.
    </p>
    
    <div class="form-group">
      <label for="canister-id" class="form-label">Canister ID</label>
      <input
        id="canister-id"
        type="text"
        bind:value={customTokenCanisterId}
        placeholder="e.g. IC.ryjl3-tyaaa-aaaaa-aaaba-cai"
        class="form-input {customTokenError ? 'error' : ''}"
        on:keydown={(e) => {
          if (e.key === 'Enter' && customTokenCanisterId.trim()) {
            handleAddCustomToken();
          }
        }}
      />
      {#if customTokenError}
        <p class="error-message">{customTokenError}</p>
      {/if}
    </div>
    
    <div class="modal-actions">
      <button 
        class="cancel-button" 
        on:click={props.onClose}
      >
        Cancel
      </button>
      <button 
        class="add-button" 
        disabled={!customTokenCanisterId.trim() || isAddingCustomToken}
        on:click={handleAddCustomToken}
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

  .form-input {
    @apply w-full px-3 py-2.5 bg-kong-bg-dark/70 border border-kong-border/40
           rounded-lg text-kong-text-primary placeholder-kong-text-secondary/70
           focus:outline-none focus:ring-1 focus:ring-kong-accent-blue/40;
  }

  .form-input.error {
    @apply border-kong-accent-red/70 focus:ring-kong-accent-red/40;
  }

  .error-message {
    @apply mt-1.5 text-sm text-kong-accent-red;
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
</style> 