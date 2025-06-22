<script lang="ts">
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { Activity, TrendingUp, DollarSign } from "lucide-svelte";
  import { fade } from "svelte/transition";
  import { userTokens } from "$lib/stores/userTokens";
  import { onMount } from "svelte";
  import { transparentSwapPanel } from "$lib/stores/derivedThemeStore";
  import { app } from "$lib/state/app.state.svelte";
  import Panel from "$lib/components/common/Panel.svelte";

  let {
    payToken = null,
    payAmount = "",
    receiveToken = null,
    receiveAmount = "",
    priceImpact = 0,
    gasFees = [],
    lpFees = [],
    isLoading = false,
  } = $props<{
    payToken: Kong.Token | null;
    payAmount: string;
    receiveToken: Kong.Token | null;
    receiveAmount: string;
    priceImpact: number;
    gasFees: Array<{ amount: string; token: string }>;
    lpFees: Array<{ amount: string; token: string }>;
    isLoading?: boolean;
  }>();

  let isMobile = $derived(app.isMobile);

  // Calculate exchange rate
  const exchangeRate = $derived(() => {
    if (!payAmount || !receiveAmount || !payToken || !receiveToken) return null;
    
    const payValue = parseFloat(payAmount);
    const receiveValue = parseFloat(receiveAmount);
    
    if (payValue && receiveValue) {
      const rate = receiveValue / payValue;
      // Use more compact format for very small numbers
      if (rate < 0.0001) {
        return rate.toExponential(3);
      }
      return formatToNonZeroDecimal(rate);
    }
    return null;
  });

  // Track tokens that need to be fetched and their results
  let tokenFetchPromises = $state<Map<string, Promise<Kong.Token | null>>>(new Map());
  let fetchedTokens = $state<Map<string, Kong.Token>>(new Map());
  
  // Common intermediate tokens that should be pre-loaded
  const COMMON_INTERMEDIATE_TOKENS = [
    "ryjl3-tyaaa-aaaaa-aaaba-cai", // ICP
  ];
  
  // Pre-load common intermediate tokens on mount
  onMount(() => {
    COMMON_INTERMEDIATE_TOKENS.forEach(tokenId => {
      userTokens.getTokenDetails(tokenId).then(token => {
        if (token) {
          fetchedTokens.set(tokenId, token);
          fetchedTokens = new Map(fetchedTokens);
        }
      });
    });
  });

  // Calculate total fees in USD
  const totalFeesUsd = $derived(() => {
    let total = 0;
    
    // Check if we have any fees
    if (!gasFees?.length && !lpFees?.length) {
      return 0;
    }
    
    // Get token data map from the user tokens store for efficient lookup
    const tokenDataMap = $userTokens.tokenData;
    
    // Helper function to find token by address or symbol
    const findToken = (tokenIdentifier: string) => {
      // First check if it matches our pay or receive token by address
      if (payToken?.address === tokenIdentifier || payToken?.canister_id === tokenIdentifier) return payToken;
      if (receiveToken?.address === tokenIdentifier || receiveToken?.canister_id === tokenIdentifier) return receiveToken;
      
      // Then check if it matches by symbol (backward compatibility)
      if (payToken?.symbol === tokenIdentifier) return payToken;
      if (receiveToken?.symbol === tokenIdentifier) return receiveToken;
      
      // Check if we've already fetched this token
      const fetchedToken = fetchedTokens.get(tokenIdentifier);
      if (fetchedToken) return fetchedToken;
      
      // Look up in the token data map by address (which is the canister_id)
      const tokenByAddress = tokenDataMap.get(tokenIdentifier);
      if (tokenByAddress) return tokenByAddress;
      
      // Special case for ICP ledger canister
      if (tokenIdentifier === "ryjl3-tyaaa-aaaaa-aaaba-cai") {
        // Look for ICP token by symbol
        for (const [_, token] of tokenDataMap) {
          if (token.symbol === "ICP") {
            return token;
          }
        }
      }
      
      // If not found by address, search by symbol in all tokens
      // This is a fallback for backward compatibility
      for (const [_, token] of tokenDataMap) {
        if (token.symbol === tokenIdentifier) {
          return token;
        }
      }
      
      return null;
    };
    
    // Helper to fetch missing tokens
    const fetchMissingToken = async (tokenId: string) => {
      if (!tokenFetchPromises.has(tokenId)) {
        const promise = userTokens.getTokenDetails(tokenId);
        tokenFetchPromises.set(tokenId, promise);
      }
      return tokenFetchPromises.get(tokenId);
    };
    
    // Calculate gas fees
    if (gasFees && gasFees.length > 0) {
      gasFees.forEach((fee: { amount: string; token: string }) => {
        if (!fee || !fee.amount || !fee.token) return;
        
        let token = findToken(fee.token);
        
        // If token not found and it looks like a canister ID, try to fetch it
        if (!token && fee.token.length > 10 && !fee.token.includes(' ')) {
          // Trigger async fetch for next render
          fetchMissingToken(fee.token).then(fetchedToken => {
            if (fetchedToken) {
              // Store the fetched token and trigger re-render
              fetchedTokens.set(fee.token, fetchedToken);
              fetchedTokens = new Map(fetchedTokens);
            }
          });
        }
        
        if (token?.metrics?.price && fee.amount) {
          const feeValue = Number(fee.amount) * Number(token.metrics.price);
          if (!isNaN(feeValue)) {
            total += feeValue;
          }
        }
      });
    }
    
    // Calculate LP fees  
    if (lpFees && lpFees.length > 0) {
      lpFees.forEach((fee: { amount: string; token: string }) => {
        if (!fee || !fee.amount || !fee.token) return;
        
        let token = findToken(fee.token);
        
        // If token not found and it looks like a canister ID, try to fetch it
        if (!token && fee.token.length > 10 && !fee.token.includes(' ')) {
          // Trigger async fetch for next render
          fetchMissingToken(fee.token).then(fetchedToken => {
            if (fetchedToken) {
              // Store the fetched token and trigger re-render
              fetchedTokens.set(fee.token, fetchedToken);
              fetchedTokens = new Map(fetchedTokens);
            }
          });
        }
        
        if (token?.metrics?.price && fee.amount) {
          const feeValue = Number(fee.amount) * Number(token.metrics.price);
          if (!isNaN(feeValue)) {
            total += feeValue;
          }
        }
      });
    }
    
    return total;
  });

  // Always show the info display
  const showDisplay = $derived(true);

  // Get warning level for price impact
  const priceImpactLevel = $derived(() => {
    if (priceImpact > 5) return 'critical';
    if (priceImpact > 2) return 'warning';
    return 'normal';
  });
</script>

{#snippet loadingDots()}
  <div class="loading-dots">
    <span></span>
    <span></span>
    <span></span>
  </div>
{/snippet}

{#snippet infoValue(content, additionalClass = "")}
  <div class="info-value {additionalClass}">
    {#if isLoading}
      {@render loadingDots()}
    {:else if content !== null && content !== undefined}
      {@html content}
    {:else}
      <span class="text-kong-text-secondary/50">-</span>
    {/if}
  </div>
{/snippet}

{#if showDisplay}
    <Panel
      variant={$transparentSwapPanel ? "transparent" : "solid"}
      type="secondary"
      className="info-panel"
      transition="fade"
      transitionParams={{ duration: 200 }}
    >
      {#snippet children()}
        <div class="info-grid">
          <!-- Exchange Rate -->
          {#if !isMobile}
            <div class="info-item">
              <div class="info-label">
                <TrendingUp size={14} class="info-icon" />
                <span>Rate</span>
              </div>
              {@render infoValue(
                exchangeRate() && payToken && receiveToken 
                  ? `<span class="rate-text">1 ${payToken.symbol} = ${exchangeRate()} ${receiveToken.symbol}</span>`
                  : null,
                "rate-value"
              )}
            </div>
          {/if}
          
          <!-- Price Impact -->
          <div class="info-item">
            <div class="info-label">
              <Activity size={14} class="info-icon" />
              <span>Price Impact</span>
            </div>
            {@render infoValue(
              payToken && receiveToken && payAmount && receiveAmount && payAmount !== "0" && receiveAmount !== "0"
                ? `<span>${priceImpact.toFixed(2)}%</span>`
                : null,
              `impact-${priceImpactLevel()}`
            )}
          </div>

          <!-- Total Fees -->
          <div class="info-item">
            <div class="info-label">
              <DollarSign size={14} class="info-icon" />
              <span>Total Fees</span>
            </div>
            {@render infoValue(
              totalFeesUsd() > 0 ? `<span>$${formatToNonZeroDecimal(totalFeesUsd())}</span>` : null
            )}
          </div>
        </div>
      {/snippet}
    </Panel>
{/if}

<style lang="postcss" scoped>
  .swap-info-display {
    @apply w-full sm:px-2 md:px-0;
  }

  .info-grid {
    @apply grid grid-cols-2 md:grid-cols-3 gap-4;
  }

  .info-label {
    @apply flex items-center gap-1.5 text-xs text-kong-text-secondary font-medium justify-center;
  }

  .info-icon {
    @apply opacity-80;
  }

  .info-value {
    @apply text-sm font-semibold text-kong-text-primary text-center
           min-h-[1.25rem] flex items-center justify-center;
  }

  /* Rate value specific styling */
  .rate-value {
    @apply w-full;
  }

  .rate-text {
    @apply block text-xs whitespace-nowrap overflow-hidden text-ellipsis;
    max-width: 100%;
  }

  /* Price impact color coding */
  .impact-normal {
    @apply text-kong-text-primary;
  }

  .impact-warning {
    @apply text-kong-warning;
  }

  .impact-critical {
    @apply text-kong-error;
  }

  /* Loading animation */
  .loading-dots {
    @apply inline-flex gap-0.5 items-center justify-center;
  }

  .loading-dots span {
    @apply w-1 h-1 rounded-full bg-kong-text-primary/40;
    animation: loading-bounce 1.4s ease-in-out infinite both;
  }

  .loading-dots span:nth-child(1) {
    animation-delay: -0.32s;
  }

  .loading-dots span:nth-child(2) {
    animation-delay: -0.16s;
  }

  .loading-dots span:nth-child(3) {
    animation-delay: 0s;
  }

  @keyframes loading-bounce {
    0%, 80%, 100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Mobile optimization */
  @media (max-width: 640px) {
    .info-grid {
      @apply gap-3 p-3;
    }

    .info-label {
      @apply text-[11px];
    }

    .info-value {
      @apply text-xs min-h-[1rem];
    }

    .info-icon {
      @apply w-3 h-3;
    }

    .rate-text {
      @apply text-[10px];
    }
  }
</style> 