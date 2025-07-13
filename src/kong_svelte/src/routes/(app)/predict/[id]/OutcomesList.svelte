<script lang="ts">
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import Card from "$lib/components/common/Card.svelte";
  import BigNumber from "bignumber.js";
  import { BarChart3, Trophy, AlertCircle, CheckCircle } from "lucide-svelte";
  import { userTokens } from "$lib/stores/userTokens";
  import { formatBalance, toScaledAmount } from "$lib/utils/numberFormatUtils";
  import { auth } from "$lib/stores/auth";
  import { walletProviderStore } from "$lib/stores/walletProviderStore";
  import { modalFactory } from "$lib/services/modalFactory";
  import { formatToNonZeroDecimal } from "$lib/utils/liquidityUtils";
  
  // Format token amounts that are already in token units
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

  let { market, onPlacePrediction, marketBets = [], isAdmin = false } = $props<{
    market: any;
    onPlacePrediction: (outcomeIndex: number, amount: number, needsAllowance?: boolean) => Promise<void>;
    marketBets?: any[];
    isAdmin?: boolean;
  }>();

  // Group market-related derived data
  let marketData = $derived({
    token: market 
      ? $userTokens.tokens.find((t) => t.address === market.token_id)
      : null,
    outcomes: market?.outcomes || [],
    outcomePercentages: market?.outcome_percentages || [],
    betCountPercentages: market?.bet_count_percentages || [],
    betCounts: market?.bet_counts?.map(Number) || [],
    winningOutcomes: market?.status?.Closed || [],
    maxPercentage: Math.max(...(market?.outcome_percentages || [0]))
  });
  
  // Calculate user's bets per outcome
  let userBetsPerOutcome = $derived(() => {
    if (!$auth.isConnected || !$auth.account?.owner || !marketBets.length) {
      return {};
    }
    
    const userPrincipal = $auth.account.owner;
    const userBets = marketBets.filter(bet => bet.bettor === userPrincipal);
    
    // Sum bets by outcome index
    const betsByOutcome: Record<number, number> = {};
    userBets.forEach(bet => {
      const outcomeIndex = Number(bet.outcome_index);
      const amount = Number(bet.amount) / Math.pow(10, marketData.token?.decimals || 8);
      betsByOutcome[outcomeIndex] = (betsByOutcome[outcomeIndex] || 0) + amount;
    });
    
    return betsByOutcome;
  });

  // Check if current user is the market creator
  let isCreator = $derived(
    $auth.isConnected && 
    $auth.account?.owner && 
    market?.creator?.toText() === $auth.account.owner
  );
  
  // Group market status derived data  
  let marketStatus = $derived({
    isClosed: market?.status?.Closed !== undefined,
    isVoided: market?.status?.Voided !== undefined,
    endTime: market?.end_time ? Number(market.end_time) / 1_000_000 : null,
    get isResolved() { return this.isClosed; },
    get isPendingResolution() {
      return !this.isResolved && 
             !this.isVoided && 
             this.endTime && 
             this.endTime < Date.now();
    }
  });
  
  // Determine if circles should be shown
  let showSelectionCircles = $derived(
    !marketStatus.isClosed && 
    (!marketStatus.isPendingResolution || isAdmin || isCreator)
  );
  
  // Group UI state
  let uiState = $state({
    selectedOutcome: null as number | null,
    placingPrediction: false
  });
  
  async function handleSelectOutcome(index: number) {
    if (!$auth.isConnected) {
      walletProviderStore.open();
      return;
    }
    
    // Get the outcome details
    const outcome = marketData.outcomes[index];
    const percentage = marketData.outcomePercentages[index];
    
    try {
      // Use the new modal system for prediction betting
      const result = await modalFactory.prediction.bet(
        market, 
        outcome, 
        index, 
        percentage,
        marketData.token
      );
      
      if (result) {
        await handlePlacePrediction(index, result.amount, result.needsAllowance);
      }
    } catch (error) {
      // User cancelled or error occurred
      console.log('Prediction bet cancelled or failed:', error);
    }
  }
  
  async function handlePlacePrediction(outcomeIndex: number, amount: number, needsAllowance: boolean) {
    uiState.placingPrediction = true;
    try {
      await onPlacePrediction(outcomeIndex, amount, needsAllowance);
    } catch (error) {
      console.error('Prediction error:', error);
      throw error;
    } finally {
      uiState.placingPrediction = false;
    }
  }
</script>

<Card className="p-4 bg-kong-bg-primary/80 backdrop-blur-sm border-kong-border/10 animate-fadeIn">
  <div class="space-y-4">
      <!-- Header for outcomes list -->
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-lg bg-kong-primary/20">
          <BarChart3 class="w-6 h-6 text-kong-primary" />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-kong-text-primary">
            Make Your Prediction
          </h2>
          <p class="text-sm text-kong-text-secondary">
            {#if !marketStatus.isResolved && !marketStatus.isPendingResolution}
              {$auth.isConnected ? 'Select an outcome and place your prediction' : 'Connect wallet to participate'}
            {:else}
              View market outcomes
            {/if}
          </p>
        </div>
      </div>
      
      <!-- Outcomes Section -->
      <div class="space-y-3">
        {#each marketData.outcomes as outcome, i}
          {@const isWinner = marketStatus.isClosed && marketData.winningOutcomes.some((w) => Number(w) === i)}
          {@const poolAmount = new BigNumber(market.outcome_pools[i]).div(10 ** (marketData.token?.decimals))}
          {@const isLeading = marketData.outcomePercentages[i] === marketData.maxPercentage && marketData.maxPercentage > 0}
          
          <ButtonV2
            theme={isWinner && marketStatus.isClosed ? "accent-green" : uiState.selectedOutcome === i ? "primary" : "secondary"}
            variant={isWinner && marketStatus.isClosed ? "solid" : uiState.selectedOutcome === i ? "outline" : "outline"}
            size="lg"
            fullWidth
            onclick={() => !marketStatus.isClosed && !marketStatus.isPendingResolution && handleSelectOutcome(i)}
            disabled={marketStatus.isClosed || marketStatus.isPendingResolution || uiState.placingPrediction}
            className="!justify-start !text-left group {isWinner && marketStatus.isClosed ? '!bg-kong-success/70 !border-kong-success' : marketStatus.isClosed && !isWinner ? 'opacity-40 grayscale' : uiState.selectedOutcome === i ? '!bg-kong-primary/10' : ''}"
          >
            <div class="flex items-center justify-between w-full">
              <div class="flex items-center gap-3">
                {#if showSelectionCircles}
                  {#if uiState.selectedOutcome === i}
                    <CheckCircle class="w-5 h-5 flex-shrink-0" />
                  {:else}
                    <div class="w-5 h-5 rounded-full border-2 border-kong-text-secondary flex-shrink-0"></div>
                  {/if}
                {/if}
                <div class="flex-1">
                  <span class="font-medium {isWinner && marketStatus.isClosed ? 'text-kong-text-primary' : ''}">{outcome}</span>
                  <div class="flex items-center gap-2 mt-0.5 text-xs {isWinner && marketStatus.isClosed ? 'text-kong-text-primary/90' : 'opacity-70'}">
                    <span>{marketData.outcomePercentages[i].toFixed(1)}%</span>
                    <span>•</span>
                    <span>{marketData.betCounts[i]} predictions</span>
                    {#if marketData.token}
                      <span>•</span>
                      <span>{formatTokenAmount(poolAmount.toNumber())} {marketData.token.symbol}</span>
                    {/if}
                  </div>
                  {#if userBetsPerOutcome()[i] > 0}
                    <div class="mt-1 text-xs text-kong-accent-green font-medium">
                      Your bet: {formatToNonZeroDecimal(userBetsPerOutcome()[i])} {marketData.token?.symbol || 'KONG'}
                    </div>
                  {/if}
                </div>
              </div>
              {#if isWinner && marketStatus.isClosed}
                <div class="flex items-center gap-2 font-semibold text-kong-text-primary">
                  <Trophy class="w-5 h-5 text-kong-text-primary" /> Winner
                </div>
              {/if}
            </div>
          </ButtonV2>
        {/each}
        
        <!-- Continue Button -->
        {#if uiState.selectedOutcome !== null && !marketStatus.isClosed && !marketStatus.isPendingResolution}
          <div class="mt-4">
            <ButtonV2
              theme="accent-green"
              variant="solid"
              fullWidth
              size="lg"
              onclick={() => handleSelectOutcome(uiState.selectedOutcome!)}
              disabled={uiState.placingPrediction}
            >
              Continue with "{marketData.outcomes[uiState.selectedOutcome]}"
            </ButtonV2>
          </div>
        {/if}
      </div>
  </div>
</Card>


<style>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
