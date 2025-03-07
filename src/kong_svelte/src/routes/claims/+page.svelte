<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/services/auth';
  import { canisterIDLs } from '$lib/config/auth.config';
  import { KONG_BACKEND_CANISTER_ID } from '$lib/constants/canisterConstants';
  import { toastStore } from '$lib/stores/toastStore';
  import ButtonV2 from '$lib/components/common/ButtonV2.svelte';
  import LoadingIndicator from '$lib/components/common/LoadingIndicator.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import { formatBalance } from '$lib/utils/numberFormatUtils';
  import { Loader2 } from "lucide-svelte";
  import { DEFAULT_LOGOS, getTokenLogo } from "$lib/services/tokens";
  import { fetchTokensByCanisterId } from "$lib/api/tokens/TokenApiClient";

  // Types
  interface Claim {
    claim_id: bigint;
    status: string;
    chain: string;
    symbol: string;
    amount: bigint;
    fee: bigint;
    to_address: string;
    desc: string;
    ts: bigint;
    logo_url?: string; // Added for token logo
    decimals?: number; // Added for proper formatting
  }

  // State
  let claims: Claim[] = [];
  let isLoading = true;
  let isProcessing = false;
  let processingClaimId: bigint | null = null;
  let isProcessingAll = false; // Added for Claim All functionality
  let error: string | null = null;
  const DEFAULT_IMAGE = "/tokens/not_verified.webp";
  let tokenDetailsMap: Record<string, FE.Token> = {};

  // Create a mapping from token symbols to canister IDs
  const SYMBOL_TO_CANISTER_ID: Record<string, string> = {
    'ICP': 'ryjl3-tyaaa-aaaaa-aaaba-cai',
    'GHOST': '4c4fd-caaaa-aaaaq-aaa3a-cai',
    'KINIC': '73mez-iiaaa-aaaaq-aaasq-cai',
    'CHAT': '2ouva-viaaa-aaaaq-aaamq-cai',
    'CTZ': 'uf2wh-taaaa-aaaaq-aabna-cai',
    'ICS': 'ss2fx-dyaaa-aaaaq-aaova-cai',
    'BIL': 'vtrom-gqaaa-aaaaq-aabia-cai'
  };

  // Function to get logo URL for a token symbol
  function getLogoUrlForSymbol(symbol: string): string {
    // First check if we have a canister ID mapping for this symbol
    const canisterId = SYMBOL_TO_CANISTER_ID[symbol];
    if (canisterId && DEFAULT_LOGOS[canisterId]) {
      return DEFAULT_LOGOS[canisterId];
    }
    
    // If not, try to use the symbol directly (in case it's added to DEFAULT_LOGOS in the future)
    if (DEFAULT_LOGOS[symbol]) {
      return DEFAULT_LOGOS[symbol];
    }
    
    // Fall back to default image
    return DEFAULT_IMAGE;
  }

  // Log DEFAULT_LOGOS to check if it's properly set up
  console.log("DEFAULT_LOGOS:", DEFAULT_LOGOS);
  console.log("SYMBOL_TO_CANISTER_ID:", SYMBOL_TO_CANISTER_ID);
  
  // Check if the default image path is valid
  if (typeof window !== 'undefined') {
    const img = new Image();
    img.onload = () => console.log("Default image path is valid:", DEFAULT_IMAGE);
    img.onerror = () => console.error("Default image path is invalid:", DEFAULT_IMAGE);
    img.src = DEFAULT_IMAGE;
    
    // Test a specific token logo
    const testTokenLogo = new Image();
    testTokenLogo.onload = () => console.log("ICP logo path is valid:", DEFAULT_LOGOS.ICP);
    testTokenLogo.onerror = () => console.error("ICP logo path is invalid:", DEFAULT_LOGOS.ICP);
    if (DEFAULT_LOGOS.ICP) {
      testTokenLogo.src = DEFAULT_LOGOS.ICP;
    }
  }

  // Fetch claims
  async function fetchClaims() {
    isLoading = true;
    error = null;
    
    try {
      if (!$auth.isConnected) {
        error = "Please connect your wallet to view claims";
        isLoading = false;
        return;
      }

      try {
        const actor = auth.getActor(
          KONG_BACKEND_CANISTER_ID,
          canisterIDLs.kong_backend
        );

        const principalId = $auth.account?.owner.toString();
        if (!principalId) {
          throw new Error("Principal ID not found");
        }

        const result = await actor.claims(principalId);
        console.log("Claims result:", result);
        
        if ('Ok' in result) {
          // Get the claims from the result
          const fetchedClaims = result.Ok;
          
          // Get unique token identifiers from claims
          const tokenIdentifiers = fetchedClaims
            .map(claim => {
              // For IC tokens, we can try to extract the canister ID
              if (claim.chain === 'IC') {
                // Try to extract canister ID from the token identifier
                const parts = claim.symbol.split('.');
                if (parts.length > 1) {
                  return parts[1]; // Return the canister ID part
                }
              }
              return null;
            })
            .filter(Boolean) as string[];
          
          console.log("Token identifiers:", tokenIdentifiers);
          
          // Fetch token details if we have any canister IDs
          if (tokenIdentifiers.length > 0) {
            try {
              const tokens = await fetchTokensByCanisterId(tokenIdentifiers);
              console.log("Fetched tokens:", tokens);
              
              // Create maps for token details by both symbol and canister ID
              tokenDetailsMap = tokens.reduce((acc, token) => {
                // Map by symbol
                acc[token.symbol] = token;
                // Also map by canister ID for more reliable lookup
                if (token.canister_id) {
                  acc[token.canister_id] = token;
                }
                return acc;
              }, {} as Record<string, FE.Token>);
              
              console.log("Token details map:", tokenDetailsMap);
            } catch (tokenError) {
              console.error("Error fetching token details:", tokenError);
              // Continue with default logos if token fetching fails
            }
          }
          
          // Enhance claims with logo URLs and decimals
          const enhancedClaims = fetchedClaims.map(claim => {
            // Try to get token details from our map
            let tokenDetails: FE.Token | undefined;
            
            // First try to match by canister ID if it's in the symbol
            const parts = claim.symbol.split('.');
            if (parts.length > 1 && tokenDetailsMap[parts[1]]) {
              tokenDetails = tokenDetailsMap[parts[1]];
            } 
            // Then try by symbol
            else if (tokenDetailsMap[claim.symbol]) {
              tokenDetails = tokenDetailsMap[claim.symbol];
            }
            
            console.log(`Token details for ${claim.symbol}:`, tokenDetails);
            
            if (tokenDetails) {
              return { 
                ...claim, 
                logo_url: tokenDetails.logo_url || getLogoUrlForSymbol(claim.symbol),
                decimals: tokenDetails.decimals || 8
              };
            } else {
              // Fallback to default logos
              const logoUrl = getLogoUrlForSymbol(claim.symbol);
              console.log(`Using default logo for ${claim.symbol}:`, logoUrl);
              
              return { 
                ...claim, 
                logo_url: logoUrl,
                decimals: 8 // Default decimals
              };
            }
          });
          
          claims = enhancedClaims;
          console.log("Enhanced claims:", claims);
        } else if ('Err' in result) {
          error = result.Err;
        }
      } catch (apiError) {
        console.error("API error when fetching claims:", apiError);
        
        // Check if it's a JSON parsing error
        if (apiError instanceof SyntaxError && apiError.message.includes("JSON Parse")) {
          error = "The server returned an invalid response. Please try again later or contact support.";
        } else {
          error = apiError.message || "Failed to fetch claims";
        }
        
        // If there's a database error, show a more specific message
        if (apiError.message && apiError.message.includes("Database")) {
          error = "Database error occurred. Please try again later.";
        }
      }
    } catch (err) {
      console.error("Error fetching claims:", err);
      error = err.message || "Failed to fetch claims";
    } finally {
      isLoading = false;
    }
  }

  // Process a claim
  async function processClaim(claimId: bigint) {
    if (isProcessing) return;
    
    isProcessing = true;
    processingClaimId = claimId;
    
    try {
      const actor = auth.getActor(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend
      );
      
      const result = await actor.claim(claimId);
      
      if ('Ok' in result) {
        toastStore.success("Claim processed successfully!");
        // Refresh claims list
        await fetchClaims();
      } else if ('Err' in result) {
        toastStore.error(`Failed to process claim: ${result.Err}`);
      }
    } catch (err) {
      console.error("Error processing claim:", err);
      toastStore.error(err.message || "Failed to process claim");
    } finally {
      isProcessing = false;
      processingClaimId = null;
    }
  }

  // Process all claims
  async function processAllClaims() {
    if (isProcessingAll || isProcessing || claims.length === 0) return;
    
    isProcessingAll = true;
    
    try {
      const actor = auth.getActor(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend
      );
      
      let successCount = 0;
      let failureCount = 0;
      
      for (const claim of claims) {
        processingClaimId = claim.claim_id;
        try {
          const result = await actor.claim(claim.claim_id);
          
          if ('Ok' in result) {
            successCount++;
          } else if ('Err' in result) {
            failureCount++;
            console.error(`Failed to process claim ${claim.claim_id}: ${result.Err}`);
          }
        } catch (err) {
          failureCount++;
          console.error("Error processing claim:", err);
        }
      }
      
      if (successCount > 0 && failureCount === 0) {
        toastStore.success(`Successfully processed ${successCount} claims!`);
      } else if (successCount > 0 && failureCount > 0) {
        toastStore.warning(`Processed ${successCount} claims, but ${failureCount} failed.`);
      } else if (failureCount > 0) {
        toastStore.error(`Failed to process all ${failureCount} claims.`);
      }
      
      // Refresh claims list
      await fetchClaims();
    } catch (err) {
      console.error("Error processing all claims:", err);
      toastStore.error(err.message || "Failed to process claims");
    } finally {
      isProcessingAll = false;
      processingClaimId = null;
    }
  }

  // Format timestamp to readable date
  function formatTimestamp(timestamp: bigint): string {
    return new Date(Number(timestamp) / 1_000_000).toLocaleString();
  }

  // Handle image error
  function handleImageError(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    img.src = DEFAULT_IMAGE;
  }

  onMount(() => {
    fetchClaims();
  });
  
  $: $auth.isConnected ? fetchClaims() : null;
</script>

<div class="container mx-auto px-4 py-8">
  <div class="mb-8 flex justify-between items-center">
    <div>
      <h1 class="text-3xl font-bold mb-2">Claims</h1>
      <p class="text-gray-600 dark:text-gray-400">
        View and process your claimable tokens
      </p>
    </div>
    {#if $auth.isConnected && !isLoading && !error && claims.length > 0}
      <div class="flex space-x-3">
        <!-- Claim All button -->
        <ButtonV2 
          theme="accent-green" 
          variant={isProcessingAll ? "solid" : "outline"} 
          size="sm"
          on:click={processAllClaims}
          isDisabled={isProcessingAll || isProcessing}
        >
          <div class="flex items-center">
            {#if isProcessingAll}
              <Loader2 class="animate-spin mr-2" size={16} />
              <span>Processing...</span>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Claim All
            {/if}
          </div>
        </ButtonV2>
        
        <!-- Refresh button -->
        <ButtonV2 
          theme="secondary" 
          variant="outline" 
          size="sm"
          on:click={fetchClaims}
          isDisabled={isLoading || isProcessingAll}
        >
          <div class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </div>
        </ButtonV2>
      </div>
    {/if}
  </div>

  {#if !$auth.isConnected}
    <Panel variant="solid" type="main">
      <div class="p-6 text-center">
        <p class="mb-4">Please connect your wallet to view your claims</p>
        <ButtonV2 theme="accent-blue" on:click={() => auth.initialize()}>Connect Wallet</ButtonV2>
      </div>
    </Panel>
  {:else if isLoading}
    <div class="flex justify-center items-center py-12">
      <LoadingIndicator text="Loading claims..." />
    </div>
  {:else if error}
    <Panel variant="solid" type="main">
      <div class="p-6 text-center">
        <p class="text-red-500 mb-4">{error}</p>
        <ButtonV2 theme="primary" on:click={fetchClaims}>Try Again</ButtonV2>
      </div>
    </Panel>
  {:else if claims.length === 0}
    <Panel variant="solid" type="main">
      <div class="p-6 text-center">
        <p>You don't have any claimable tokens at the moment</p>
      </div>
    </Panel>
  {:else}
    <div class="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {#each claims as claim (claim.claim_id)}
        <Panel variant="solid" type="main" className="h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
          <div class="p-6 flex flex-col h-full">
            <!-- Token info header with status -->
            <div class="flex justify-between items-center mb-4">
              <div class="flex items-center">
                <div class="w-12 h-12 mr-3 rounded-full overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700 bg-kong-bg-light shadow-sm">
                  <img 
                    src={claim.logo_url} 
                    alt={claim.symbol} 
                    class="w-full h-full object-cover"
                    on:error={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      console.error(`Failed to load image: ${img.src}`);
                      img.src = DEFAULT_IMAGE;
                    }}
                  />
                </div>
                <div>
                  <div class="flex items-center">
                    <h3 class="text-lg font-bold mr-2">
                      {claim.symbol}
                    </h3>
                    <span class="text-xs px-2 py-0.5 rounded-full bg-kong-text-accent-green/20 text-kong-text-accent-green">
                      {claim.chain}
                    </span>
                  </div>
                  <p class="text-2xl font-bold text-kong-text-primary mt-1">
                    {formatBalance(claim.amount, claim.decimals)}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <div class="text-xs text-kong-text-secondary mb-1">
                  Created
                </div>
                <div class="text-sm font-medium">
                  {new Date(Number(claim.ts) / 1_000_000).toLocaleDateString()}
                </div>
                <div class="text-xs text-gray-500">
                  {new Date(Number(claim.ts) / 1_000_000).toLocaleTimeString()}
                </div>
              </div>
            </div>
            
            <!-- Divider -->
            <div class="border-t border-kong-border mb-4"></div>
            
            <!-- Claim details in a more organized format -->
            <div class="flex-grow space-y-3 mb-5">
              {#if claim.desc}
                <div class="rounded-md bg-kong-bg-light p-3">
                  <div class="text-xs font-medium text-kong-text-secondary mb-1">Description</div>
                  <p class="text-sm text-kong-text-secondary">{claim.desc}</p>
                </div>
              {/if}
              
              <div class="flex justify-between gap-2">
                <div>
                  <div class="text-xs font-medium text-kong-text-secondary mb-1">Recipient Address</div>
                  <div class="flex items-center">
                    <p class="text-sm font-mono text-kong-text-secondary truncate" title={claim.to_address}>
                      {claim.to_address.slice(0, 5)}...{claim.to_address.slice(-7)}
                    </p>
                  </div>
                </div>
                
                <div>
                  <div class="text-xs font-medium text-kong-text-secondary mb-1">Claim ID</div>
                  <p class="text-sm font-mono text-kong-text-secondary">
                    {claim.claim_id.toString()}
                  </p>
                </div>
              </div>
            </div>
            
            <!-- Claim button -->
            <div class="mt-auto">
              <ButtonV2 
                theme="accent-green"
                variant={isProcessing && processingClaimId === claim.claim_id ? "solid" : "shine"}
                fullWidth={true}
                isDisabled={isProcessing || isProcessingAll}
                animationIterations={1}
                on:click={() => processClaim(claim.claim_id)}
              >
                {#if isProcessing && processingClaimId === claim.claim_id}
                  <div class="flex items-center justify-center">
                    <Loader2 class="animate-spin mr-2" size={16} />
                    <span>Processing...</span>
                  </div>
                {:else if isProcessingAll}
                  <div class="flex items-center justify-center">
                    {#if processingClaimId === claim.claim_id}
                      <Loader2 class="animate-spin mr-2" size={16} />
                      <span>Processing...</span>
                    {:else}
                      <span>Waiting...</span>
                    {/if}
                  </div>
                {:else}
                  Claim Tokens
                {/if}
              </ButtonV2>
            </div>
          </div>
        </Panel>
      {/each}
    </div>
  {/if}
</div>
