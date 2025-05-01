<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { AlertTriangle, Coins, ArrowLeft } from "lucide-svelte";
  import { formatBalance, toFixed } from "$lib/utils/numberFormatUtils";
  import CountdownTimer from "$lib/components/common/CountdownTimer.svelte";
  import { currentUserBalancesStore, refreshSingleBalance } from "$lib/stores/balancesStore";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { calculateMaxAmount } from "$lib/utils/validators/tokenValidators";
  import { auth } from "$lib/stores/auth";
  import { userTokens } from "$lib/stores/userTokens";

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
    step: 1 // Track which step of the flow we're on: 1 = input, 2 = confirmation
  });
  
  // Reset modal state and fetch balance when modal is opened
  $effect(() => {
    // Always regenerate the modalId when showBetModal changes
    state.modalId = Math.random().toString(36).substr(2, 9);
    
    if (showBetModal) {
      state.step = 1;
      
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

  // Calculate potential win based on selected outcome and bet amount
  const potentialWin = $derived(
    selectedOutcome !== null 
      ? calculatePotentialWin(selectedOutcome, betAmount)
      : 0
  );

  function handleClose() {
    onClose();
  }

  function setPercentage(percentage: number) {
    if (state.maxAmount > 0) {
      betAmount = Number((state.maxAmount * (percentage / 100)).toFixed(8));
    }
  }

  function calculatePotentialWin(
    outcomeIndex: number,
    betAmount: number,
  ): number {
    if (!selectedMarket || betAmount <= 0) return 0;

    // Convert bet amount to token units (multiply by 10^8)
    const betAmountScaled = toFixed(betAmount, 8);
    const currentTotalPool = Number(selectedMarket.total_pool);
    const outcomePool = Number(selectedMarket.outcome_pools[outcomeIndex] || 0);

    // Calculate the total pool of other outcomes (the losing pool if you win)
    const otherOutcomesPool = selectedMarket.outcome_pools.reduce(
      (acc: number, pool: number, i: number) =>
        i === outcomeIndex ? acc : acc + Number(pool || 0),
      0,
    );

    // Your share of the outcome pool after your bet
    // When outcomePool is 0, you'll get 100% of your outcome's pool (which is just your bet)
    const yourShareOfPool = outcomePool === 0 ? 1 : betAmountScaled / (outcomePool + betAmountScaled);

    // If you win, you get:
    // 1. Your bet back
    // 2. Your proportional share of the losing pool
    const potentialWin =
      betAmountScaled + Math.floor(yourShareOfPool * otherOutcomesPool);

    return potentialWin;
  }

  // Calculate odds as (total_pool - outcome_pool) / outcome_pool + 1
  // This represents how much you win for every 1 token bet
  function calculateOdds(i: number): string {
    if (!selectedMarket) return "";
    const totalPool = Number(selectedMarket.total_pool);
    const outcomePool = Number(selectedMarket.outcome_pools[i] || 0);
    if (outcomePool === 0) return "N/A";

    const otherOutcomesPool = selectedMarket.outcome_pools.reduce(
      (acc: number, pool: number, idx: number) =>
        idx === i ? acc : acc + Number(pool || 0),
      0,
    );

    return (otherOutcomesPool / outcomePool + 1).toFixed(2);
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

<Modal
  isOpen={showBetModal}
  variant="transparent"
  on:close={handleClose}
  modalKey={state.modalId + (showBetModal ? "-open" : "-closed")}
  title={selectedMarket?.question || "Place Your Bet"}
  width="min(95vw, 500px)"
  className="!rounded max-h-[90vh] flex flex-col"
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
              <button
                class="px-2 py-1.5 text-xs sm:text-sm bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-primary rounded transition-colors"
                on:click={() => setPercentage(25)}
                disabled={state.maxAmount <= 0}
              >
                25%
              </button>
              <button
                class="px-2 py-1.5 text-xs sm:text-sm bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-primary rounded transition-colors"
                on:click={() => setPercentage(50)}
                disabled={state.maxAmount <= 0}
              >
                50%
              </button>
              <button
                class="px-2 py-1.5 text-xs sm:text-sm bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-primary rounded transition-colors"
                on:click={() => setPercentage(75)}
                disabled={state.maxAmount <= 0}
              >
                75%
              </button>
              <button
                class="px-2 py-1.5 text-xs sm:text-sm bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-primary rounded transition-colors"
                on:click={() => setPercentage(100)}
                disabled={state.maxAmount <= 0}
              >
                MAX
              </button>
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
          <button
            class="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-kong-bg-light text-kong-text-primary rounded font-bold hover:bg-kong-bg-light/70 transition-all text-sm sm:text-base"
            on:click={handleClose}
          >
            Cancel
          </button>
          <button
            class="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-kong-accent-green text-kong-bg-dark rounded font-bold hover:bg-kong-accent-green-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            on:click={goToNextStep}
            disabled={selectedOutcome === null || !betAmount}
          >
            Next
          </button>
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
            
            <p class="text-center text-base leading-relaxed mt-4">
              If the market resolves to this outcome, you will receive 
              <span class="text-kong-text-accent-green font-bold">{formatBalance(potentialWin, 8)} KONG</span> 
              based on the current pool size.
            </p>
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
          <button
            class="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-kong-bg-light text-kong-text-primary rounded font-bold hover:bg-kong-bg-light/70 transition-all text-sm sm:text-base flex items-center justify-center"
            on:click={goBack}
            disabled={isBetting}
          >
            <ArrowLeft class="w-4 h-4 mr-1" />
            Back
          </button>
          <button
            class="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-kong-accent-green text-kong-bg-dark rounded font-bold hover:bg-kong-accent-green-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
            on:click={() => onBet(betAmount)}
            disabled={isBetting}
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
          </button>
        </div>
      </div>
    {/if}
  {/if}
</Modal>
