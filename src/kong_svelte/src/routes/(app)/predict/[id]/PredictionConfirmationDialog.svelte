<script lang="ts">
  import Dialog from "$lib/components/common/Dialog.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { AlertCircle, TrendingUp } from "lucide-svelte";
  import { currentUserBalancesStore, loadBalances } from "$lib/stores/balancesStore";
  import { auth } from "$lib/stores/auth";
  import { estimateBetReturn } from "$lib/api/predictionMarket";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import { AllowancePrecheck } from "$lib/services/icrc/AllowancePrecheck";
  import { canisters } from "$lib/config/auth.config";

  let {
    open = $bindable(false),
    outcome,
    outcomeIndex,
    percentage,
    token,
    marketId,
    onSubmit,
    isSubmitting = false
  } = $props<{
    open: boolean;
    outcome: string;
    outcomeIndex: number;
    percentage: number;
    token: any;
    marketId: bigint;
    onSubmit: (amount: number, needsAllowance: boolean) => Promise<void>;
    isSubmitting?: boolean;
  }>();

  let selectedPercentage = $state<number | null>(null);
  const percentageOptions = [25, 50, 75, 100];
  let loadingBalance = $state(false);
  let manualAmount = $state('');
  let estimatedReturn = $state<any>(null);
  let loadingEstimate = $state(false);
  let needsAllowance = $state(false);
  
  // Default token info if not provided
  const defaultDecimals = 8;
  
  // Check allowance when dialog opens (without requesting approval)
  $effect(() => {
    if (open && token && $auth.isConnected && token.standards?.includes("ICRC-2")) {
      const largeAllowance = token.metrics?.total_supply ? BigInt(token.metrics.total_supply) : BigInt(10 ** 18);
      
      AllowancePrecheck.checkAllowanceOnly({
        token,
        amount: largeAllowance,
        spender: canisters.predictionMarkets.canisterId,
      }).then(hasAllowance => {
        needsAllowance = !hasAllowance;
      }).catch(error => {
        console.error("Failed to check allowance:", error);
        needsAllowance = true; // Assume we need it if check fails
      });
    } else if (!token?.standards?.includes("ICRC-2")) {
      needsAllowance = false; // Non-ICRC-2 tokens don't need allowance
    }
  });
  
  // Fetch balance when token or auth changes
  $effect(() => {
    if (token && $auth.isConnected && $auth.account?.owner) {
      loadingBalance = true;
      loadBalances([token], $auth.account.owner, true)
        .catch(error => {
          console.error('Failed to load balance:', error);
        })
        .finally(() => {
          loadingBalance = false;
        });
    }
  });
  
  // Get user's token balance
  let userBalance = $derived(() => {
    if (!token || !token.address) return 0;
    const balance = $currentUserBalancesStore[token.address];
    if (!balance) return 0;
    // Convert from smallest unit to actual tokens
    const decimals = token.decimals ?? defaultDecimals;
    return Number(balance.in_tokens) / Math.pow(10, decimals);
  });
  
  // Calculate amount based on percentage or manual input
  let amount = $derived(() => {
    if (manualAmount) {
      return parseFloat(manualAmount) || 0;
    }
    if (selectedPercentage !== null) {
      const balance = userBalance();
      return (balance * selectedPercentage) / 100;
    }
    return 0;
  });
  
  // Debounce timer for API calls
  let estimateDebounceTimer: NodeJS.Timeout | null = null;
  
  // Fetch estimated return from API
  $effect(() => {
    // Clear any pending timer
    if (estimateDebounceTimer) {
      clearTimeout(estimateDebounceTimer);
    }
    
    if (amount() > 0 && marketId && outcomeIndex >= 0 && token) {
      // Debounce API calls to avoid too many requests
      estimateDebounceTimer = setTimeout(async () => {
        loadingEstimate = true;
        try {
          const decimals = token?.decimals ?? defaultDecimals;
          const betAmountInSmallestUnit = BigInt(Math.floor(amount() * Math.pow(10, decimals)));
          
          const estimate = await estimateBetReturn(
            marketId,
            BigInt(outcomeIndex),
            betAmountInSmallestUnit,
            BigInt(Date.now()) * 1000000n,
            token?.address
          );
          
          console.log('Estimate response:', estimate);
          estimatedReturn = estimate;
        } catch (error) {
          console.error('Failed to estimate return:', error);
          estimatedReturn = null;
        } finally {
          loadingEstimate = false;
        }
      }, 300); // 300ms debounce
    } else {
      estimatedReturn = null;
      loadingEstimate = false;
      console.log('Skipping estimate - missing required data:', {
        amount: amount(),
        marketId: marketId?.toString(),
        outcomeIndex,
        hasToken: !!token,
        token
      });
    }
    
    // Cleanup function
    return () => {
      if (estimateDebounceTimer) {
        clearTimeout(estimateDebounceTimer);
      }
    };
  });
  
  // Get the expected return scenario (win scenario)
  let winScenario = $derived(() => {
    if (!estimatedReturn?.scenarios) {
      console.log('No scenarios in estimatedReturn:', estimatedReturn);
      return null;
    }
    
    // Log all scenarios to debug
    console.log('All scenarios:', estimatedReturn.scenarios);
    
    // Try different ways to find the win scenario
    const win = estimatedReturn.scenarios.find((s: any) => 
      s.scenario === "Win" || 
      s.scenario === "win" || 
      s.scenario?.toLowerCase() === "win" ||
      s.scenario?.includes("Win") ||
      s.scenario?.includes("win")
    );
    
    if (!win && estimatedReturn.scenarios.length > 0) {
      // If no "Win" scenario found, log what we have
      console.log('No Win scenario found. Available scenarios:', 
        estimatedReturn.scenarios.map((s: any) => s.scenario)
      );
      // Try to use the first scenario as fallback
      const firstScenario = estimatedReturn.scenarios[0];
      console.log('Using first scenario as fallback:', firstScenario);
      return firstScenario;
    }
    
    console.log('Win scenario:', win);
    return win;
  });
  
  // Calculate potential return and profit from API response
  let potentialReturn = $derived(() => {
    if (winScenario()) {
      const decimals = token?.decimals ?? defaultDecimals;
      const expectedReturn = winScenario().expected_return;
  
      return Number(expectedReturn) / Math.pow(10, decimals);
    }
    return 0;
  });
  
  let potentialProfit = $derived(() => {
    return potentialReturn() - amount();
  });
  
  // Get platform fee from estimate
  let platformFee = $derived(() => {
    if (!estimatedReturn || !estimatedReturn.estimated_platform_fee || estimatedReturn.estimated_platform_fee.length === 0) {
      return 0;
    }
    const decimals = token?.decimals ?? defaultDecimals;
    // estimated_platform_fee is an optional array, so we need to check if it has a value
    const feeValue = estimatedReturn.estimated_platform_fee[0];
    if (!feeValue) return 0;
    return Number(feeValue) / Math.pow(10, decimals);
  });

  function handleClose() {
    open = false;
    // Reset state
    selectedPercentage = null;
    manualAmount = '';
  }

  async function handleSubmit() {
    if (amount() > 0) {
      await onSubmit(amount(), needsAllowance);
      handleClose();
    }
  }
</script>

<Dialog
  bind:open
  title="Confirm Prediction"
  showClose={false}
  onClose={handleClose}
>
  {#snippet children()}
    <div class="space-y-4">
      <!-- Selected outcome display -->
      <div class="p-4 rounded-lg bg-gradient-to-br from-kong-bg-secondary/50 to-kong-bg-secondary/30 border border-kong-border/50">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-kong-text-secondary mb-1">Predicting on</p>
            <p class="text-lg font-semibold text-kong-text-primary">{outcome}</p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold bg-gradient-to-r from-kong-accent-blue to-kong-accent-green bg-clip-text text-transparent">{percentage.toFixed(1)}%</p>
            <p class="text-xs text-kong-text-secondary">current chance</p>
          </div>
        </div>
      </div>
      
      <!-- Amount Input Section -->
      <div class="space-y-4">
        <!-- Manual Amount Input -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-kong-text-secondary">
              Enter amount ({token?.symbol})
            </label>
            <span class="text-sm font-medium text-kong-text-primary">
              {#if loadingBalance}
                <span class="animate-pulse">Loading...</span>
              {:else}
                Balance: {formatToNonZeroDecimal(userBalance())} {token?.symbol}
              {/if}
            </span>
          </div>
          <input
            type="number"
            bind:value={manualAmount}
            placeholder="0.00"
            min="0"
            step="any"
            class="w-full px-4 py-3 bg-kong-bg-primary border border-kong-border rounded-lg text-kong-text-primary placeholder-kong-text-secondary/50 focus:outline-none focus:border-kong-primary transition-colors"
            oninput={() => selectedPercentage = null}
          />
        </div>
        
        <!-- Percentage Selector -->
        <div>
          <div class="grid grid-cols-4 gap-2">
            {#each percentageOptions as percent}
              <button
                class="relative py-3 px-2 text-sm border rounded-lg transition-all duration-200
                  {selectedPercentage === percent 
                    ? 'bg-kong-accent-green/20 border-kong-accent-green text-kong-accent-green font-semibold shadow-lg' 
                    : 'border-kong-border hover:bg-kong-bg-secondary/50 hover:border-kong-primary/50'}"
                onclick={async () => {
                  selectedPercentage = percent;
                  const balance = userBalance();
                  let calculatedAmount = (balance * percent) / 100;
                  
                  // For 100%, we need to account for the platform fee
                  // The fee is typically a percentage of the bet amount
                  // We need to calculate the max bet amount such that bet + fee = balance
                  if (percent === 100) {
                    // First, we need to get the fee percentage from the backend
                    try {
                      const decimals = token?.decimals ?? defaultDecimals;
                      // Use a small test amount to get the fee percentage
                      const testAmount = BigInt(Math.floor(1 * Math.pow(10, decimals)));
                      const testEstimate = await estimateBetReturn(
                        marketId,
                        BigInt(outcomeIndex),
                        testAmount,
                        BigInt(Date.now()) * 1000000n,
                        token?.address
                      );
                      
                      if (testEstimate?.platform_fee_percentage) {
                        // platform_fee_percentage is in basis points (e.g., 250 = 2.5%)
                        const feePercentage = Number(testEstimate.platform_fee_percentage) / 10000;
                        // Calculate max bet amount: balance / (1 + fee_percentage)
                        calculatedAmount = balance / (1 + feePercentage);
                        // Round down slightly to ensure we don't exceed balance
                        calculatedAmount = Math.floor(calculatedAmount * 10000) / 10000;
                      }
                    } catch (error) {
                      console.error('Failed to estimate fee for 100% calculation:', error);
                      // Fall back to slightly less than 100% to be safe
                      calculatedAmount = balance * 0.97;
                    }
                  }
                  
                  // Format to a reasonable number of decimal places (max 4)
                  manualAmount = calculatedAmount.toFixed(Math.min(4, token?.decimals ?? defaultDecimals));
                }}
              >
                {percent}%
                {#if selectedPercentage === percent}
                  <div class="absolute -top-1 -right-1 w-2 h-2 bg-kong-accent-green rounded-full animate-pulse"></div>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      </div>
      
      <!-- Potential return info -->
      {#if amount() > 0}
        <div class="p-4 bg-gradient-to-br from-kong-bg-primary/50 to-kong-bg-secondary/30 rounded-lg border border-kong-border/50">
          <div class="flex items-center gap-2 mb-3">
            <TrendingUp class="w-4 h-4 text-kong-accent-green" />
            <h4 class="text-sm font-medium text-kong-text-primary">Potential Returns</h4>
          </div>
          {#if loadingEstimate}
            <div class="space-y-3">
              <div class="h-4 bg-kong-bg-light rounded animate-pulse"></div>
              <div class="h-4 bg-kong-bg-light rounded animate-pulse w-3/4"></div>
              <div class="h-6 bg-kong-bg-light rounded animate-pulse w-1/2"></div>
            </div>
          {:else if estimatedReturn && winScenario()}
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-kong-text-secondary">Your prediction</span>
                <span class="text-sm font-medium text-kong-text-primary">
                  {formatToNonZeroDecimal(amount())} {token?.symbol}
                </span>
              </div>
              {#if platformFee() > 0}
                <div class="flex items-center justify-between">
                  <span class="text-sm text-kong-text-secondary">Platform fee</span>
                  <span class="text-sm text-kong-text-secondary">
                    -{formatToNonZeroDecimal(platformFee())} {token?.symbol}
                  </span>
                </div>
              {/if}
              <div class="flex items-center justify-between">
                <span class="text-sm text-kong-text-secondary">If you win</span>
                <span class="text-sm font-medium text-kong-text-primary">
                  {formatToNonZeroDecimal(potentialReturn())} {token?.symbol}
                </span>
              </div>
              <div class="flex items-center justify-between pt-3 border-t border-kong-border/50">
                <span class="text-sm text-kong-text-secondary">Potential profit</span>
                <div class="flex items-center gap-2">
                  <span class="text-lg font-bold {potentialProfit() >= 0 ? 'text-kong-success' : 'text-kong-error'}">
                    {formatToNonZeroDecimal(potentialProfit())}
                  </span>
                  <span class="text-sm {potentialProfit() >= 0 ? 'text-kong-success' : 'text-kong-error'}">{token?.symbol}</span>
                </div>
              </div>
              {#if estimatedReturn?.uses_time_weighting}
                <div class="text-xs text-kong-text-secondary/70 italic">
                  *Returns include time-weighted bonus for early predictions
                </div>
              {/if}
              <div class="text-xs text-kong-text-secondary/70 italic">
                *Final returns depend on market outcome probabilities at resolution
              </div>
            </div>
          {:else}
            <div class="text-sm text-kong-text-secondary">
              Unable to calculate returns. Please enter an amount.
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Alerts -->
      {#if amount() > userBalance()}
        <div class="flex items-start gap-2 p-3 rounded-lg bg-kong-error/10 border border-kong-error/20">
          <AlertCircle class="w-4 h-4 text-kong-error mt-0.5 flex-shrink-0" />
          <div class="text-xs text-kong-error">
            <p>Insufficient balance. You need {formatToNonZeroDecimal(Math.max(0, amount() - userBalance()))} more {token?.symbol}.</p>
          </div>
        </div>
      {/if}
      
      <!-- Action buttons -->
      <div class="flex gap-3">
        <ButtonV2
          theme="secondary"
          variant="outline"
          fullWidth
          size="lg"
          onclick={handleClose}
          disabled={isSubmitting}
        >
          Cancel
        </ButtonV2>
        <ButtonV2
          theme="accent-green"
          variant="solid"
          fullWidth
          size="lg"
          onclick={handleSubmit}
          disabled={isSubmitting || amount() <= 0 || amount() > userBalance()}
        >
          {isSubmitting ? 'Placing Prediction...' : 'Place Prediction'}
        </ButtonV2>
      </div>
    </div>
  {/snippet}
</Dialog>