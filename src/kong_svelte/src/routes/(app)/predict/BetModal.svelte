<script lang="ts">
  import Dialog from "$lib/components/common/Dialog.svelte";
  import { AlertTriangle, Coins, ArrowLeft, Clock } from "lucide-svelte";
  import { formatBalance, toFixed } from "$lib/utils/numberFormatUtils";
  import CountdownTimer from "$lib/components/common/CountdownTimer.svelte";
  import { currentUserBalancesStore, refreshSingleBalance } from "$lib/stores/balancesStore";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { calculateMaxAmount } from "$lib/utils/validators/tokenValidators";
  import { auth } from "$lib/stores/auth";
  import { userTokens } from "$lib/stores/userTokens";
  import { estimateBetReturn } from "$lib/api/predictionMarket";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";

  let {
    showBetModal = false,
    selectedMarket = null,
    isBetting = false,
    isApprovingAllowance = false,
    betError = null,
    selectedOutcome = null,
    betAmount = $bindable(0),
    onClose = () => {},
    onBet = (amount: number) => {}
  } = $props<{
    showBetModal: boolean;
    selectedMarket: any;
    isBetting: boolean;
    isApprovingAllowance: boolean;
    betError: string | null;
    selectedOutcome: number | null;
    betAmount: number;
    onClose: () => void;
    onBet: (amount: number) => void;
  }>();

  const state = $state({
    kongBalance: 0,
    maxAmount: 0,
    modalId: Math.random().toString(36).substr(2, 9),
    step: 1, // Track which step of the flow we're on: 1 = input, 2 = confirmation
    estimatedReturn: null,
    isLoadingEstimate: false
  });
  
  // Reset modal state and fetch balance when modal is opened
  $effect(() => {
    // Always regenerate the modalId when showBetModal changes
    state.modalId = Math.random().toString(36).substr(2, 9);
    
    if (showBetModal) {
      state.step = 1;
      state.estimatedReturn = null;
      
      // Fetch KONG balance when modal is opened
      if ($auth.isConnected) {
        const kongToken = $userTokens.tokens.find(token => token.address === KONG_LEDGER_CANISTER_ID);
        if (kongToken) {
          refreshSingleBalance(kongToken, $auth.account?.owner || "", true);
        }
      }
    }
  });

  // Update balance when store changes
  $effect(() => {
    const balances = $currentUserBalancesStore;
    if ($auth.isConnected && balances && balances[KONG_LEDGER_CANISTER_ID]) {
      const rawBalance = BigInt(balances[KONG_LEDGER_CANISTER_ID].in_tokens);
      state.kongBalance = Number(rawBalance) / 1e8;
      // Calculate max amount considering the token fee
      state.maxAmount = calculateMaxAmount(rawBalance, 8, BigInt(10000));
    }
  });

  // Update estimated return when bet amount or selected outcome changes
  $effect(() => {
    if (selectedMarket && selectedOutcome !== null && betAmount > 0) {
      updateEstimatedReturn();
    } else {
      state.estimatedReturn = null;
    }
  });

  // Get potential win from estimated return
  const potentialWin = $derived(
    state.estimatedReturn 
      ? getBestScenarioReturn(state.estimatedReturn)
      : 0
  );

  // Get the best scenario return from estimated return
  function getBestScenarioReturn(estimatedReturn) {
    if (!estimatedReturn || !estimatedReturn.scenarios || estimatedReturn.scenarios.length === 0) {
      return 0;
    }
    
    // Find the scenario with the highest expected return
    const bestScenario = estimatedReturn.scenarios.reduce(
      (best, current) => current.expected_return > best.expected_return ? current : best, 
      estimatedReturn.scenarios[0]
    );
    
    return Number(bestScenario.expected_return);
  }

  async function updateEstimatedReturn() {
    if (!selectedMarket || selectedOutcome === null || betAmount <= 0) return;
    
    try {
      state.isLoadingEstimate = true;
      // Convert bet amount to token units (multiply by 10^8)
      const betAmountScaled = BigInt(toFixed(betAmount, 8));
      const marketId = BigInt(selectedMarket.id);
      const outcomeIdx = BigInt(selectedOutcome);
      
      const estimation = await estimateBetReturn(
        marketId,
        outcomeIdx,
        betAmountScaled
      );
      
      state.estimatedReturn = estimation;
    } catch (error) {
      console.error("Error estimating return:", error);
    } finally {
      state.isLoadingEstimate = false;
    }
  }

  function handleClose() {
    onClose();
  }

  function setPercentage(percentage: number) {
    if (state.maxAmount > 0) {
      betAmount = Number((state.maxAmount * (percentage / 100)).toFixed(8));
    }
  }

  function goToNextStep() {
    if (selectedOutcome !== null && betAmount > 0) {
      state.step = 2;
    }
  }
  
  function goBack() {
    state.step = 1;
  }
</script>

<Dialog
  open={showBetModal}
  transparent={true}
  onClose={handleClose}
  title={selectedMarket?.question || "Place Your Bet"}
  showClose={false}
>
  {#if selectedMarket}
    <!-- Step 1: Input Bet Amount -->
    {#if state.step === 1}
      <div class="px-3 pb-3 sm:px-4 space-y-3 sm:space-y-5 flex-1 overflow-y-auto">
        <!-- Simplified Betting Summary Section -->
        {#if selectedOutcome !== null}
          <div class="bg-kong-accent-green/10 border-2 border-kong-accent-green p-4 rounded relative">
            <span class="font-bold text-base sm:text-lg">
              {selectedMarket.outcomes[selectedOutcome]}
            </span>
            <div class="mt-2 text-kong-text-secondary text-sm">
              <p>You are predicting this outcome.</p>
              {#if selectedMarket.uses_time_weighting}
                <div class="flex items-center gap-1 mt-1 text-xs text-kong-text-accent-green">
                  <Clock class="w-3 h-3" />
                  <span>Time-weighted rewards active</span>
                </div>
              {/if}
            </div>
          </div>

          <!-- Bet Amount Input -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <h4 class="text-sm font-medium text-kong-text-secondary">Prediction Amount</h4>
              <div class="flex items-center gap-2 text-xs sm:text-sm text-kong-text-secondary">
                <Coins class="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Balance: <span class="font-medium">{state.kongBalance.toFixed(8)} KONG</span></span>
              </div>
            </div>
            <input
              type="number"
              bind:value={betAmount}
              min="0"
              max={state.maxAmount}
              step="0.1"
              class="w-full p-2.5 sm:p-3 bg-kong-bg-light rounded border border-kong-border focus:border-kong-accent-blue focus:ring-1 focus:ring-kong-accent-blue mb-2"
              placeholder="Enter amount"
            />
            <div class="grid grid-cols-4 gap-1.5 sm:gap-2 mb-4">
              <ButtonV2
                label="25%"
                theme="secondary"
                variant="solid"
                size="xs"
                on:click={() => setPercentage(25)}
                isDisabled={state.maxAmount <= 0}
                className="sm:text-sm"
              />
              <ButtonV2
                label="50%"
                theme="secondary"
                variant="solid"
                size="xs"
                on:click={() => setPercentage(50)}
                isDisabled={state.maxAmount <= 0}
                className="sm:text-sm"
              />
              <ButtonV2
                label="75%"
                theme="secondary"
                variant="solid"
                size="xs"
                on:click={() => setPercentage(75)}
                isDisabled={state.maxAmount <= 0}
                className="sm:text-sm"
              />
              <ButtonV2
                label="MAX"
                theme="secondary"
                variant="solid"
                size="xs"
                on:click={() => setPercentage(100)}
                isDisabled={state.maxAmount <= 0}
                className="sm:text-sm"
              />
            </div>
          </div>
        {/if}

        <!-- Error Message -->
        {#if betError}
          <div
            class="p-2.5 sm:p-3 bg-kong-accent-red/20 border border-kong-accent-red/40 rounded text-kong-text-accent-red flex items-center gap-2"
          >
            <AlertTriangle class="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span class="text-sm">{betError}</span>
          </div>
        {/if}
      </div>

      <!-- Action Buttons for Step 1 -->
      <div class="p-3 sm:px-4 bg-kong-bg mt-auto">
        <div class="flex gap-2 sm:gap-3">
          <ButtonV2
            label="Cancel"
            theme="secondary"
            variant="solid"
            size="lg"
            on:click={handleClose}
            className="flex-1 font-bold sm:text-base"
          />
          <ButtonV2
            label="Next"
            theme="accent-green"
            variant="solid"
            size="lg"
            on:click={goToNextStep}
            isDisabled={selectedOutcome === null || !betAmount}
            className="flex-1 font-bold sm:text-base"
          />
        </div>
      </div>
    
    <!-- Step 2: Confirmation Screen -->
    {:else if state.step === 2}
      <div class="px-3 pb-3 sm:px-4 flex-1 overflow-y-auto">
        <div class="py-6 flex flex-col items-center">
          <!-- Confirmation Message -->
          <div class="bg-kong-accent-green/10 border-2 border-kong-accent-green p-5 rounded-lg w-full max-w-md mt-3">
            <h3 class="text-center text-lg font-medium mb-4">Confirm Your Bet</h3>
            
            <p class="text-center text-base leading-relaxed">
              You are placing <span class="font-bold">{betAmount} KONG</span> on the outcome 
              <span class="font-bold">{selectedMarket.outcomes[selectedOutcome]}</span>. 
              The market ends in <span class="font-bold"><CountdownTimer endTime={selectedMarket.end_time} /></span>.
            </p>
            
            {#if state.isLoadingEstimate}
              <div class="text-center mt-4">
                <div class="inline-block w-5 h-5 border-2 border-kong-accent-green border-t-transparent rounded-full animate-spin"></div>
                <p class="mt-2">Calculating potential return...</p>
              </div>
            {:else if state.estimatedReturn}
              <div class="text-center mt-4">
                <p class="text-base leading-relaxed">
                  If the market resolves to this outcome, you will receive 
                  <span class="text-kong-text-accent-green font-bold">{formatBalance(potentialWin, 8)} KONG</span> 
                  based on the current pool size.
                </p>
                
                {#if selectedMarket.uses_time_weighting && state.estimatedReturn.time_weight_alpha}
                  <div class="mt-3 text-sm bg-kong-bg-light p-2 rounded">
                    <div class="flex items-center justify-center gap-1 text-kong-text-accent-green mb-1">
                      <Clock class="w-4 h-4" />
                      <span class="font-medium">Time-Weighted Rewards</span>
                    </div>
                    <p class="text-kong-text-secondary">
                      Early betters receive higher rewards. <br/>
                      {#if state.estimatedReturn.scenarios[0]?.time_weight}
                        Your time weight factor: 
                        <span class="font-medium">{(Number(state.estimatedReturn.scenarios[0].time_weight) * 100).toFixed(1)}%</span>
                      {/if}
                    </p>
                  </div>
                {/if}
              </div>
            {:else}
              <p class="text-center text-base leading-relaxed mt-4">
                If the market resolves to this outcome, you will receive your winnings
                based on the current pool size.
              </p>
            {/if}
          </div>
          
          <!-- Warning or additional info can go here -->
          <div class="mt-4 text-sm text-kong-text-secondary text-center max-w-md">
            <p>Once confirmed, your bet cannot be changed or canceled.</p>
          </div>
        </div>
        
        <!-- Error Message -->
        {#if betError}
          <div
            class="p-2.5 sm:p-3 bg-kong-accent-red/20 border border-kong-accent-red/40 rounded text-kong-text-accent-red flex items-center gap-2 mt-3"
          >
            <AlertTriangle class="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span class="text-sm">{betError}</span>
          </div>
        {/if}
      </div>
      
      <!-- Action Buttons for Step 2 -->
      <div class="p-3 sm:px-4 bg-kong-bg mt-auto">
        <div class="flex gap-2 sm:gap-3">
          <ButtonV2
            theme="secondary"
            variant="solid"
            size="lg"
            on:click={goBack}
            isDisabled={isBetting}
            className="flex-1 font-bold sm:text-base flex items-center justify-center"
          >
            <div class="flex items-center justify-center gap-2">
              <ArrowLeft class="w-4 h-4 mr-1" />
              Back
            </div>
          </ButtonV2>
          <ButtonV2
            theme="accent-green"
            variant="solid"
            size="lg"
            on:click={() => onBet(betAmount)}
            isDisabled={isBetting}
            className="flex-1 font-bold sm:text-base flex items-center justify-center gap-2"
          >
            {#if isBetting}
              <div
                class="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
              ></div>
              {#if isApprovingAllowance}
                Approving...
              {:else}
                Placing...
              {/if}
            {:else}
              Confirm
            {/if}
          </ButtonV2>
        </div>
      </div>
    {/if}
  {/if}
</Dialog>
