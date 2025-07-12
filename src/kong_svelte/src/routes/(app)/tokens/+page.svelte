<script lang="ts">
  import { goto } from "$app/navigation";
  import { auth, swapActor } from "$lib/stores/auth";
  import { loadBalances } from "$lib/stores/balancesStore";
  import { userTokens } from "$lib/stores/userTokens";
  import { toastStore } from "$lib/stores/toastStore";
  import { debounce } from "$lib/utils/debounce";
  import { fade, fly, scale } from "svelte/transition";
  import BigNumber from "bignumber.js";
  import { fetchTokenMetadata } from "$lib/api/tokens/TokenApiClient";
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { Check, AlertCircle, Search, Info, Copy } from "lucide-svelte";
  import Card from "$lib/components/common/Card.svelte";

  // State
  let customTokenCanisterId = $state("");
  let isAddingCustomToken = $state(false);
  let customTokenError = $state("");
  let isLoadingPreview = $state(false);
  let previewToken = $state<Kong.Token | null>(null);
  let lastPreviewedCanisterId = $state("");
  let showSuccessState = $state(false);
  let copiedCanisterId = $state(false);

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
    if (!forceRefresh && canisterId === lastPreviewedCanisterId && previewToken !== null) {
      return;
    }
    
    isLoadingPreview = true;
    customTokenError = "";
    
    try {
      const token = await fetchTokenMetadata(canisterId);      
      if (token) {
        previewToken = token;
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
    if (lastPreviewedCanisterId && newCanisterId) {
      const strippedNew = newCanisterId.replace(/[^a-zA-Z0-9]/g, '');
      const strippedLast = lastPreviewedCanisterId.replace(/[^a-zA-Z0-9]/g, '');
      
      if (strippedNew !== strippedLast) {
        previewToken = null;
        lastPreviewedCanisterId = "";
      }
    }
  }

  // Watch for changes to the canister ID and trigger preview
  $effect(() => {
    if (customTokenCanisterId.trim()) {
      resetPreviewIfNeeded(customTokenCanisterId);
      debouncedPreview();
    } else {
      previewToken = null;
      customTokenError = "";
    }
  });

  // Handle adding a custom token
  async function handleAddNewToken() {
    
    if (!customTokenCanisterId.trim()) {
      customTokenError = "Please enter a valid canister ID";
      return;
    }
    
    const formattedCanisterId = formatCanisterId(customTokenCanisterId);
    
    if (!formattedCanisterId) {
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
        const kongBackendActor = swapActor({anon: true, requiresSigning: false});
        const addTokenResult = await kongBackendActor.add_token({ token: formattedCanisterId });
        
        if ('Err' in addTokenResult) {
          throw new Error(`Failed to add token: ${addTokenResult.Err}`);
        }
      } catch (canisterError) {
        console.warn("Error calling add_token canister function:", canisterError);
      }
      
      let tokenToAdd: Kong.Token;
      
      if (previewToken) {
        tokenToAdd = previewToken;
      } else {
        console.error("No preview token available and backend call failed");
        throw new Error("Failed to get token information. Please try again.");
      }
      
      userTokens.enableToken(tokenToAdd);
      
      // Refresh token data to ensure the token is properly loaded
      await userTokens.refreshTokenData();
      
      if ($auth.account?.owner) {
        loadBalances([tokenToAdd], $auth.account.owner, true)
          .catch(e => console.error("Failed to load balances:", e));
      }
      
      toastStore.success(`${tokenToAdd.symbol} has been added to your tokens`);
      
      // Show success state
      showSuccessState = true;
      
      // Wait a bit then redirect to add liquidity page
      setTimeout(() => {
        goto(`/pools/add?token=${tokenToAdd.address}`);
      }, 2000);
      
    } catch (error) {
      console.error('Error adding custom token:', error);
      customTokenError = error instanceof Error ? error.message : "Failed to add token. Please check the canister ID and try again.";
      toastStore.error(customTokenError);
    } finally {
      isAddingCustomToken = false;
    }
  }

  // Copy canister ID to clipboard
  async function copyCanisterId(canisterId: string) {
    try {
      await navigator.clipboard.writeText(canisterId);
      copiedCanisterId = true;
      setTimeout(() => copiedCanisterId = false, 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  }
</script>

<svelte:head>
  <title>Add New Token | KongSwap</title>
</svelte:head>

<div class="min-h-screen container mx-auto !max-w-xl px-4 pb-12">
  <div class="flex items-center gap-4 mb-8 pt-8">
    <button 
      class="p-2 hover:bg-kong-bg-primary/50 {$panelRoundness} transition-all hover:scale-105"
      onclick={() => goto("/swap")}
      aria-label="Go back"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5"></path>
        <path d="M12 19l-7-7 7-7"></path>
      </svg>
    </button>
    <h1 class="text-3xl font-bold text-kong-text-primary">Add New Token</h1>
  </div>

  {#if showSuccessState}
    <div class="flex flex-col items-center justify-center py-16" in:scale={{ duration: 300 }}>
      <div class="mb-6 p-4 bg-kong-success/20 rounded-full">
        <Check size={48} class="text-kong-success" />
      </div>
      <h2 class="text-2xl font-bold text-kong-text-primary mb-2">Token Added Successfully!</h2>
      <p class="text-kong-text-secondary">Redirecting to add liquidity...</p>
    </div>
  {:else}
    <div class="max-w-2xl mx-auto space-y-6">
      <!-- Main Input Section -->
      <Card isPadded={true} className="shadow-lg">
        <div class="flex items-center gap-2 mb-4">
          <Search size={20} class="text-kong-primary" />
          <h2 class="text-lg font-semibold text-kong-text-primary">Enter Token Canister ID</h2>
        </div>
        
        <div class="relative">
          <input
            id="canister-id"
            type="text"
            bind:value={customTokenCanisterId}
            placeholder="e.g. ryjl3-tyaaa-aaaaa-aaaba-cai"
            class="w-full px-4 py-4 pr-12 bg-kong-bg-primary/70 border border-kong-border/40 {$panelRoundness} text-kong-text-primary placeholder-kong-text-secondary/70 focus:outline-none focus:ring-2 focus:ring-kong-primary/40 focus:border-kong-primary/40 transition-all text-lg {customTokenError ? 'border-kong-error/70 focus:ring-kong-error/40' : ''}"
            onkeydown={(e) => {
              if (e.key === 'Enter' && customTokenCanisterId.trim() && previewToken) {
                handleAddNewToken();
              }
            }}
          />
          {#if isLoadingPreview}
            <div class="absolute right-4 top-1/2 transform -translate-y-1/2" in:fade={{ duration: 150 }}>
              <div class="w-5 h-5 border-2 border-kong-primary/30 border-t-kong-primary rounded-full animate-spin"></div>
            </div>
          {:else if previewToken}
            <div class="absolute right-4 top-1/2 transform -translate-y-1/2" in:scale={{ duration: 150 }}>
              <Check size={20} class="text-kong-success" />
            </div>
          {/if}
        </div>
        
        {#if customTokenError}
          <div class="mt-3 flex items-start gap-2 text-sm text-kong-error" in:fly={{ y: -10, duration: 200 }}>
            <AlertCircle size={16} class="mt-0.5 flex-shrink-0" />
            <span>{customTokenError}</span>
          </div>
        {/if}
      </Card>

      <!-- Tips Section -->
      <Card isPadded={true} className="bg-kong-bg-primary/50">
        <div class="flex items-center gap-2 mb-4">
          <Info size={20} class="text-kong-info" />
          <h3 class="text-lg font-semibold text-kong-text-primary">How to Add a Token</h3>
        </div>
        
        <ol class="space-y-3 text-sm text-kong-text-secondary">
          <li class="flex gap-3">
            <span class="flex-shrink-0 w-6 h-6 bg-kong-primary/20 text-kong-primary rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <span>Enter the canister ID of the ICRC token you want to add</span>
          </li>
          <li class="flex gap-3">
            <span class="flex-shrink-0 w-6 h-6 bg-kong-primary/20 text-kong-primary rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <span>We'll automatically fetch the token metadata and show a preview</span>
          </li>
          <li class="flex gap-3">
            <span class="flex-shrink-0 w-6 h-6 bg-kong-primary/20 text-kong-primary rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <span>Review the token details and click "Add Token" to confirm</span>
          </li>
        </ol>
      </Card>

      <!-- Token Preview -->
      {#if previewToken}
        <div in:fly={{ y: 20, duration: 300 }}>
          <Card isPadded={true} className="shadow-lg">
            <h3 class="text-lg font-semibold text-kong-text-primary mb-4 flex items-center gap-2">
            <span>Token Preview</span>
            <div class="ml-auto text-xs text-kong-success bg-kong-success/20 px-2 py-1 rounded-full">
              Verified
            </div>
          </h3>
          
          <div class="flex items-start gap-4 mb-6">
            <div class="flex-shrink-0">
              {#if previewToken.logo_url}
                <img 
                  src={previewToken.logo_url} 
                  alt={previewToken.symbol} 
                  class="w-16 h-16 rounded-full object-cover bg-kong-bg-primary/30 ring-2 ring-kong-border/30"
                />
              {:else}
                <div class="w-16 h-16 rounded-full bg-gradient-to-br from-kong-primary/30 to-kong-primary/10 flex items-center justify-center font-bold text-lg text-kong-primary ring-2 ring-kong-border/30">
                  {previewToken.symbol.substring(0, 2)}
                </div>
              {/if}
            </div>
            <div class="flex-1">
              <h4 class="text-xl font-bold text-kong-text-primary">{previewToken.symbol}</h4>
              <p class="text-sm text-kong-text-secondary">{previewToken.name}</p>
            </div>
          </div>
          
          <div class="space-y-4">
            <div>
              <label class="text-xs text-kong-text-secondary uppercase tracking-wider">Canister ID</label>
              <div class="flex items-center gap-2 mt-1">
                <code class="text-sm text-kong-text-primary font-mono bg-kong-bg-primary/50 px-2 py-1 rounded flex-1 truncate">
                  {previewToken.address}
                </code>
                <button
                  class="p-1.5 hover:bg-kong-bg-primary/50 rounded transition-colors"
                  onclick={() => copyCanisterId(previewToken.address)}
                  title="Copy canister ID"
                >
                  {#if copiedCanisterId}
                    <Check size={16} class="text-kong-success" />
                  {:else}
                    <Copy size={16} class="text-kong-text-secondary" />
                  {/if}
                </button>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-xs text-kong-text-secondary uppercase tracking-wider">Decimals</label>
                <p class="text-sm text-kong-text-primary mt-1 font-medium">{previewToken.decimals}</p>
              </div>
              <div>
                <label class="text-xs text-kong-text-secondary uppercase tracking-wider">Transfer Fee</label>
                <p class="text-sm text-kong-text-primary mt-1 font-medium">
                  {BigNumber(previewToken.fee.toString()).div(BigNumber(10).pow(previewToken.decimals)).toFormat()} {previewToken.symbol}
                </p>
              </div>
            </div>
            
            <div>
              <label class="text-xs text-kong-text-secondary uppercase tracking-wider">Standards</label>
              <div class="flex gap-2 mt-2">
                {#each previewToken.standards as standard}
                  <span class="text-xs bg-kong-primary/20 text-kong-primary px-2 py-1 rounded-full">
                    {standard}
                  </span>
                {/each}
              </div>
            </div>
          </div>

          <div class="mt-6 pt-6 border-t border-kong-border/20">
            <button 
              class="w-full flex items-center justify-center gap-2 px-6 py-3 bg-kong-primary text-white {$panelRoundness} hover:bg-kong-primary-hover transition-all disabled:opacity-70 disabled:cursor-not-allowed font-medium text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              disabled={isAddingCustomToken || !previewToken}
              onclick={handleAddNewToken}
            >
              {#if isAddingCustomToken}
                <div class="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                <span>Adding Token...</span>
              {:else}
                <Check size={20} />
                <span>Add Token</span>
              {/if}
            </button>
          </div>
          </Card>
        </div>
      {:else if !customTokenCanisterId.trim() && !isLoadingPreview}
        <Card isPadded={true} className="bg-kong-bg-secondary/50 p-12 text-center">
          <Search size={48} class="text-kong-text-secondary/30 mx-auto mb-4" />
          <p class="text-kong-text-secondary">Enter a canister ID to preview token details</p>
        </Card>
      {/if}

      {#if !$auth.isConnected}
        <div in:fly={{ y: 10, duration: 200 }}>
          <Card isPadded={true} className="bg-kong-warning/10 border-kong-warning/30">
            <div class="flex gap-3">
              <AlertCircle size={20} class="text-kong-warning flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm font-medium text-kong-warning">Wallet Connection Required</p>
                <p class="text-sm text-kong-text-secondary mt-1">
                  Please connect your wallet to add tokens to your personal list.
                </p>
              </div>
            </div>
          </Card>
        </div>
      {/if}
    </div>
  {/if}
</div>