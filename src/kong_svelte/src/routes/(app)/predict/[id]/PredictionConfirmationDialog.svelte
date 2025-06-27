<script lang="ts">
  import Dialog from "$lib/components/common/Dialog.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import { ArrowLeft, AlertCircle, Wallet, TrendingUp } from "lucide-svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import { currentUserBalancesStore, loadBalances } from "$lib/stores/balancesStore";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { auth } from "$lib/stores/auth";
  
  // Format token amounts that are already in token units (not smallest unit)
  function formatTokenAmount(amount: number, maxDecimals: number = 4): string {
    if (amount === 0) return "0";
    
    // For very small values, show more decimals
    if (amount < 0.0001) {
      return amount.toFixed(8).replace(/\.?0+$/, "");
    }
    
    // For small values, show up to 6 decimals
    if (amount < 0.01) {
      return amount.toFixed(6).replace(/\.?0+$/, "");
    }
    
    // For normal values, show up to maxDecimals
    return amount.toFixed(maxDecimals).replace(/\.?0+$/, "");
  }

  let {
    open = $bindable(false),
    outcome,
    outcomeIndex,
    percentage,
    token,
    onSubmit,
    isSubmitting = false
  } = $props<{
    open: boolean;
    outcome: string;
    outcomeIndex: number;
    percentage: number;
    token: any;
    onSubmit: (amount: number) => Promise<void>;
    isSubmitting?: boolean;
  }>();

  let selectedPercentage = $state<number | null>(null);
  const percentageOptions = [25, 50, 75, 100];
  let loadingBalance = $state(false);
  let manualAmount = $state('');
  
  // Default token info if not provided
  const defaultDecimals = 8;
  const defaultSymbol = 'KONG';
  
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
  
  // Calculate potential return
  let potentialReturn = $derived(() => {
    try {
      if (amount() <= 0 || percentage <= 0) return 0;
      return amount() / (percentage / 100);
    } catch (e) {
      return 0;
    }
  });
  
  let potentialProfit = $derived(() => {
    try {
      return potentialReturn() - amount();
    } catch (e) {
      return 0;
    }
  });

  function handleClose() {
    open = false;
    // Reset state
    selectedPercentage = null;
    manualAmount = '';
  }

  async function handleSubmit() {
    if (amount() > 0) {
      await onSubmit(amount());
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
              Enter amount ({token?.symbol || defaultSymbol})
            </label>
            <span class="text-sm font-medium text-kong-text-primary">
              {#if loadingBalance}
                <span class="animate-pulse">Loading...</span>
              {:else}
                Balance: {formatTokenAmount(userBalance())} {token?.symbol || defaultSymbol}
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
                onclick={() => {
                  selectedPercentage = percent;
                  const balance = userBalance();
                  const calculatedAmount = (balance * percent) / 100;
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
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-kong-text-secondary">Your prediction</span>
              <span class="text-sm font-medium text-kong-text-primary">
                {formatTokenAmount(amount())} {token?.symbol || defaultSymbol}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-kong-text-secondary">If you win</span>
              <span class="text-sm font-medium text-kong-text-primary">
                ~{formatTokenAmount(potentialReturn())} {token?.symbol || defaultSymbol}
              </span>
            </div>
            <div class="flex items-center justify-between pt-3 border-t border-kong-border/50">
              <span class="text-sm text-kong-text-secondary">Potential profit</span>
              <div class="flex items-center gap-2">
                <span class="text-lg font-bold text-kong-success">
                  +{formatTokenAmount(potentialProfit())}
                </span>
                <span class="text-sm text-kong-success">{token?.symbol || defaultSymbol}</span>
              </div>
            </div>
            <div class="text-xs text-kong-text-secondary/70 italic">
              *Returns depend on final market probabilities
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Alerts -->
      {#if amount() > userBalance()}
        <div class="flex items-start gap-2 p-3 rounded-lg bg-kong-error/10 border border-kong-error/20">
          <AlertCircle class="w-4 h-4 text-kong-error mt-0.5 flex-shrink-0" />
          <div class="text-xs text-kong-error">
            <p>Insufficient balance. You need {formatTokenAmount(Math.max(0, amount() - userBalance()))} more {token?.symbol || defaultSymbol}.</p>
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