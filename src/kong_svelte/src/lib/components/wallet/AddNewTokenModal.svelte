<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import { auth, swapActor } from "$lib/stores/auth";
  import { loadBalances } from "$lib/stores/tokenStore";
  import { userTokens } from "$lib/stores/userTokens";
  import { toastStore } from "$lib/stores/toastStore";
  import { debounce } from "$lib/utils/debounce";
  import { fade } from "svelte/transition";
  import BigNumber from "bignumber.js";
  import { fetchTokenMetadata } from "$lib/api/tokens/TokenApiClient";

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
  let previewToken = $state<Kong.Token | null>(null);
  let lastPreviewedCanisterId = $state("");

  const dispatch = createEventDispatcher<{
    tokenAdded: Kong.Token;
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
    if (!customTokenCanisterId.trim()) {
      customTokenError = "";
      previewToken = null;
      return;
    }
    
    const formattedCanisterId = formatCanisterId(customTokenCanisterId);
    
    if (!formattedCanisterId) {
      console.warn("Invalid canister ID format");
      customTokenError = "Invalid canister ID format. Expected format: xxxxx-xxxxx-xxxxx-xxxxx-xxx";
      previewToken = null;
      return;
    }
    
    // Extract the actual canister ID without the IC. prefix
    const canisterId = formattedCanisterId.startsWith("IC.") 
      ? formattedCanisterId.substring(3) 
      : formattedCanisterId;
        
    // Skip if we've already previewed this canister ID AND we have a preview token
    // This prevents skipping when we have an error but the lastPreviewedCanisterId is set
    if (!forceRefresh && canisterId === lastPreviewedCanisterId && previewToken !== null) {
      return;
    }
    
    isLoadingPreview = true;
    customTokenError = "";
    
    try {
      const token = await fetchTokenMetadata(canisterId);      
      if (token) {
        previewToken = token;
        // Only update lastPreviewedCanisterId after a successful API call
        lastPreviewedCanisterId = canisterId;
      } else {
        console.warn("No token metadata returned");
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
        previewToken = null;
        lastPreviewedCanisterId = "";
      }
    }
  }

  // Watch for changes to the canister ID and trigger preview
  $effect(() => {
    if (customTokenCanisterId.trim()) {
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
    
    if (!customTokenCanisterId.trim()) {
      console.warn("Empty canister ID, showing error");
      customTokenError = "Please enter a valid canister ID";
      return;
    }
    
    // Format the canister ID if needed
    const formattedCanisterId = formatCanisterId(customTokenCanisterId);
    
    if (!formattedCanisterId) {
      console.warn("Invalid canister ID format");
      customTokenError = "Invalid canister ID format. Expected format: xxxxx-xxxxx-xxxxx-xxxxx-xxx";
      return;
    }
    
    if (!$auth.isConnected) {
      customTokenError = "You need to be logged in to add a token";
      toastStore.error("Please connect your wallet to add a token");
      return;
    }
    
    isAddingCustomToken = true;
    customTokenError = "";
    
    try {
      try {
        // Call the add_token canister function directly
        const kongBackendActor = swapActor({anon: true, requiresSigning: false});
        const addTokenResult = await kongBackendActor.add_token({ token: formattedCanisterId });
        
        if ('Err' in addTokenResult) {
          throw new Error(`Failed to add token: ${addTokenResult.Err}`);
        }
      } catch (canisterError) {
        console.warn("Error calling add_token canister function:", canisterError);
        // Continue with the process even if the canister call fails
        // This allows users to still add tokens to their local list
      }
      
      // If we have a preview token, use it for the UI
      let tokenToAdd: Kong.Token;
      
      if (previewToken) {
        tokenToAdd = previewToken;
      } else {
        // If we don't have a preview token, we can't proceed
        console.error("No preview token available and backend call failed");
        throw new Error("Failed to get token information. Please try again.");
      }
      
      userTokens.enableToken(tokenToAdd);
      
      // Load balance for the newly enabled token if user is connected
      if ($auth.account?.owner) {
        loadBalances([tokenToAdd], $auth.account.owner, true)
          .catch(e => console.error("Failed to load balances:", e));
      }
      
      // Dispatch event to parent
      dispatch('tokenAdded', tokenToAdd);
      toastStore.success(`Token ${tokenToAdd.name} added successfully`);
      
      // Close the modal
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
  variant="solid"
>
  <div class="flex flex-col px-2">
    <p class="text-sm text-kong-text-secondary mb-4">
      Enter the canister ID of the token you want to add. Token details will be automatically previewed.
    </p>
    
    <div class="mb-6">
      <label for="canister-id" class="block text-sm font-medium text-kong-text-primary mb-2">Canister ID</label>
      <div class="relative">
        <input
          id="canister-id"
          type="text"
          bind:value={customTokenCanisterId}
          placeholder="e.g. ryjl3-tyaaa-aaaaa-aaaba-cai"
          class="w-full px-3 py-2.5 bg-kong-bg-primary/70 border border-kong-border/40 rounded-lg text-kong-text-primary placeholder-kong-text-secondary/70 focus:outline-none focus:ring-1 focus:ring-kong-accent-blue/40 {customTokenError ? 'border-kong-error/70 focus:ring-kong-error/40' : ''}"
          onkeydown={(e) => {
            if (e.key === 'Enter' && customTokenCanisterId.trim()) {
              handleAddNewToken();
            }
          }}
        />
        {#if isLoadingPreview}
          <div class="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div class="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          </div>
        {:else if customTokenCanisterId.trim()}
          <button 
            class="absolute right-3 top-1/2 transform -translate-y-1/2 text-kong-text-secondary hover:text-kong-text-primary p-1 rounded-full hover:bg-kong-bg-secondary/20 transition-colors"
            title="Refresh token preview"
            aria-label="Refresh token preview"
            onclick={() => loadTokenPreview(true)}
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
        <p class="mt-1.5 text-sm text-kong-error">{customTokenError}</p>
      {/if}
    </div>
    
    {#if previewToken}
        <div class="flex items-center gap-4 bg-kong-bg-primary p-3 mb-4 rounded-lg border border-kong-border/20" transition:fade={{ duration: 200 }}>
          <div class="flex-shrink-0">
            {#if previewToken.logo_url}
              <img src={previewToken.logo_url} alt={previewToken.symbol} class="w-12 h-12 rounded-full object-cover bg-kong-bg-secondary/30" />
            {:else}
              <div class="w-12 h-12 rounded-full bg-kong-primary/20 text-kong-primary flex items-center justify-center font-bold text-lg">{previewToken.symbol.substring(0, 2)}</div>
            {/if}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <span class="font-bold text-kong-text-primary">{previewToken.symbol}</span>
              <span class="text-sm text-kong-text-secondary truncate">{previewToken.name}</span>
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2">
              <div class="flex flex-col">
                <span class="text-xs text-kong-text-secondary">Canister ID</span>
                <span class="text-sm text-kong-text-primary truncate">{previewToken.address}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-xs text-kong-text-secondary">Decimals</span>
                <span class="text-sm text-kong-text-primary truncate">{previewToken.decimals}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-xs text-kong-text-secondary">Fee</span>
                <span class="text-sm text-kong-text-primary truncate">{BigNumber(previewToken.fee.toString()).div(BigNumber(10).pow(previewToken.decimals))}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-xs text-kong-text-secondary">Standards</span>
                <span class="text-sm text-kong-text-primary truncate">
                  {[
                    previewToken.standards.includes('ICRC-1') ? 'ICRC-1' : '',
                    previewToken.standards.includes('ICRC-2') ? 'ICRC-2' : '',
                    previewToken.standards.includes('ICRC-3') ? 'ICRC-3' : ''
                  ].filter(Boolean).join(', ') || 'None'}
                </span>
              </div>
            </div>
          </div>
        </div>
    {/if}
    
    <div class="flex justify-end gap-3 mt-4">
      <button 
        class="px-4 py-2 bg-kong-bg-primary/70 text-kong-text-primary rounded-md hover:bg-kong-bg-primary/90 transition-colors"
        onclick={props.onClose}
      >
        Cancel
      </button>
      <button 
        class="flex items-center gap-2 px-4 py-2 bg-kong-primary text-white rounded-md hover:bg-kong-primary-hover transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        disabled={isAddingCustomToken || isLoadingPreview || (!previewToken && !!customTokenError)}
        onclick={() => {
          handleAddNewToken();
        }}
      >
        {#if isAddingCustomToken}
          <div class="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          <span>Adding...</span>
        {:else}
          <span>Add Token</span>
        {/if}
      </button>
    </div>
  </div>
</Modal> 