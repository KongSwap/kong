<script lang="ts">
  import Dialog from "$lib/components/common/Dialog.svelte";
  import {
    AlertTriangle,
    Coins,
    ArrowLeft,
    Clock,
    DollarSign,
    RefreshCw,
  } from "lucide-svelte";
  import {
    formatBalance,
    toFixed,
    formatToNonZeroDecimal,
  } from "$lib/utils/numberFormatUtils";
  import CountdownTimer from "$lib/components/common/CountdownTimer.svelte";
  import {
    currentUserBalancesStore,
    refreshSingleBalance,
  } from "$lib/stores/balancesStore";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { calculateMaxAmount } from "$lib/utils/validators/tokenValidators";
  import { auth } from "$lib/stores/auth";
  import { userTokens } from "$lib/stores/userTokens";
  import { estimateBetReturn } from "$lib/api/predictionMarket";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import BigNumber from "bignumber.js";
  import TokenImages from "$lib/components/common/TokenImages.svelte";

  interface BetModalState {
    show: boolean;
    market: any | null;
    amount: number;
    outcome: number | null;
    error: string | null;
    isBetting: boolean;
    isApprovingAllowance: boolean;
  }

  let {
    modalData,
    onClose = () => {},
    onBet = (amount: number) => {},
  } = $props<{
    modalData: BetModalState;
    onClose: () => void;
    onBet: (amount: number) => void;
  }>();
  
  // Local reference for the amount binding
  let betAmount = $state<number | null>(modalData.amount || null);
  
  // Sync betAmount back to modalData
  $effect(() => {
    modalData.amount = betAmount || 0;
  });
  
  // Check if market is inactive (not initialized)
  const isMarketInactive = $derived(() => {
    if (!modalData.market) return false;
    
    // Check if total_pool is 0 or if all bet_counts are 0
    const totalPool = Number(modalData.market.total_pool || 0);
    const betCounts = modalData.market.bet_counts?.map(Number) || [];
    const totalBets = betCounts.reduce((acc, curr) => acc + curr, 0);
    
    return totalPool === 0 || totalBets === 0;
  });

  const modalState = $state({
    tokenBalance: 0,
    maxAmount: 0,
    modalId: Math.random().toString(36).substr(2, 9),
    step: 1, // Track which step of the flow we're on: 1 = input, 2 = confirmation
    estimatedReturn: null,
    isLoadingEstimate: false,
    tokenSymbol: "KONG", // Default token symbol
    tokenId: KONG_LEDGER_CANISTER_ID, // Default token ID
    tokenPriceUsd: 0, // Token price in USD
    betAmountUsd: 0, // Bet amount in USD
    inputMode: "token", // 'token' or 'usd'
    usdInputValue: null, // Used when inputMode is 'usd'
  });

  // Reset modal state and fetch balance when modal is opened
  $effect(() => {
    // Always regenerate the modalId when modal state changes
    modalState.modalId = Math.random().toString(36).substr(2, 9);

    if (modalData.show) {
      modalState.step = 1;
      modalState.estimatedReturn = null;
      modalState.inputMode = "token";
      modalState.usdInputValue = null;
      betAmount = null;

      // Update token ID and symbol based on selected market
      if (modalData.market && modalData.market.token_id) {
        modalState.tokenId = modalData.market.token_id;
        updateTokenSymbol(modalData.market.token_id);
        updateTokenPrice(modalData.market.token_id);
      } else {
        modalState.tokenId = KONG_LEDGER_CANISTER_ID;
        modalState.tokenSymbol = "KONG";
        updateTokenPrice(KONG_LEDGER_CANISTER_ID);
      }

      // Fetch token balance when modal is opened
      if ($auth.isConnected) {
        refreshTokenBalance();
      }
    }
  });

  // Update token symbol and ID when market changes
  $effect(() => {
    if (modalData.market && modalData.market.token_id) {
      modalState.tokenId = modalData.market.token_id;
      updateTokenSymbol(modalData.market.token_id);
      updateTokenPrice(modalData.market.token_id);

      // Refresh balance when token changes
      if ($auth.isConnected) {
        refreshTokenBalance();
      }
    }
  });

  // Update USD value when bet amount or token price changes in token input mode
  $effect(() => {
    if (modalState.inputMode === "token" && betAmount !== null) {
      modalState.betAmountUsd = betAmount * modalState.tokenPriceUsd;

      // Also update USD input value to keep them in sync
      modalState.usdInputValue = modalState.betAmountUsd || null;
    } else if (modalState.inputMode === "token") {
      modalState.betAmountUsd = 0;
    }
  });

  // Update token amount when USD value changes in USD input mode
  $effect(() => {
    if (
      modalState.inputMode === "usd" &&
      modalState.tokenPriceUsd > 0 &&
      modalState.usdInputValue !== null
    ) {
      betAmount = Number(
        (modalState.usdInputValue / modalState.tokenPriceUsd).toFixed(8),
      );
      modalState.betAmountUsd = modalState.usdInputValue;
    } else if (modalState.inputMode === "usd") {
      betAmount = null;
    }
  });

  // Toggle between token and USD input modes
  function toggleInputMode() {
    if (modalState.inputMode === "token") {
      modalState.inputMode = "usd";
      modalState.usdInputValue =
        betAmount !== null ? betAmount * modalState.tokenPriceUsd : null;
    } else {
      modalState.inputMode = "token";
    }
  }

  // Function to update token symbol from token_id
  function updateTokenSymbol(tokenId: string) {
    try {
      const token = $userTokens.tokens.find(
        (token) => token.address === tokenId,
      );
      if (token) {
        modalState.tokenSymbol = token.symbol || "KONG";
      } else {
        modalState.tokenSymbol = "KONG"; // Default fallback
      }
    } catch (error) {
      console.error("Error getting token details:", error);
      modalState.tokenSymbol = "KONG"; // Default fallback on error
    }
  }

  // Function to update token price from token_id
  function updateTokenPrice(tokenId: string) {
    try {
      const token = $userTokens.tokens.find(
        (token) => token.address === tokenId,
      );
      if (token && token.metrics && token.metrics.price) {
        modalState.tokenPriceUsd = Number(token.metrics.price);
        console.log(
          `Updated token price: ${modalState.tokenPriceUsd} USD for ${token.symbol}`,
        );
      } else {
        modalState.tokenPriceUsd = 0; // Default fallback
      }
    } catch (error) {
      console.error("Error getting token price:", error);
      modalState.tokenPriceUsd = 0; // Default fallback on error
    }
  }

  // Function to refresh the token balance (improved with retries)
  function refreshTokenBalance() {
    if (!$auth.isConnected || !modalState.tokenId) return;

    const token = $userTokens.tokens.find(
      (token) => token.address === modalState.tokenId,
    );
    console.log(
      "Refreshing balance for token:",
      token?.symbol || modalState.tokenId,
    );

    if (token) {
      refreshSingleBalance(token, $auth.account?.owner || "", true);
    } else {
      console.warn(`Token with ID ${modalState.tokenId} not found in user tokens`);
    }
  }

  // Update balance when store changes
  $effect(() => {
    const balances = $currentUserBalancesStore;
    if ($auth.isConnected && balances) {
      if (balances[modalState.tokenId]) {
        const rawBalance = BigInt(balances[modalState.tokenId].in_tokens);
        // Get the correct decimals from the token data
        const token = $userTokens.tokens.find(
          (token) => token.address === modalState.tokenId,
        );
        const decimals = token?.decimals || 8; // Use token's decimals, fallback to 8
        const tokenFee = token?.fee_fixed;
        modalState.tokenBalance = Number(rawBalance) / Math.pow(10, decimals);
        modalState.maxAmount = calculateMaxAmount(
          rawBalance,
          decimals,
          BigInt(tokenFee),
        );
      } else {
        console.warn(`No balance found for token ID: ${modalState.tokenId}`);
        modalState.tokenBalance = 0;
        modalState.maxAmount = 0;

        // Force refresh balance since it wasn't found
        refreshTokenBalance();
      }
    } else {
      modalState.tokenBalance = 0;
      modalState.maxAmount = 0;
    }
  });

  // Format USD value with proper decimal places
  function formatUsd(value: number): string {
    if (value === 0 || !value) return "$0.00";

    if (value < 0.01) {
      return `< $0.01`; // Show "less than $0.01" for very small amounts
    } else if (value < 1) {
      return `$${value.toFixed(2)}`; // Show 2 decimal places for values less than $1
    } else if (value < 1000) {
      return `$${value.toFixed(2)}`; // Show 2 decimal places for normal values
    } else {
      return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`; // Use locale formatting for large numbers
    }
  }

  // Update estimated return when bet amount or selected outcome changes
  $effect(() => {
    if (
      modalData.market &&
      modalData.outcome !== null &&
      betAmount !== null &&
      betAmount > 0
    ) {
      updateEstimatedReturn();
    } else {
      modalState.estimatedReturn = null;
    }
  });

  // Get potential win from estimated return
  const potentialWin = $derived(
    modalState.estimatedReturn
      ? getBestScenarioReturn(modalState.estimatedReturn)
      : new BigNumber(0),
  );

  // Get the best scenario return from estimated return
  function getBestScenarioReturn(estimatedReturn) {
    if (
      !estimatedReturn ||
      !estimatedReturn.scenarios ||
      estimatedReturn.scenarios.length === 0
    ) {
      return new BigNumber(0);
    }

    // Find the scenario with the highest expected return
    const bestScenario = estimatedReturn.scenarios.reduce(
      (best, current) =>
        current.expected_return > best.expected_return ? current : best,
      estimatedReturn.scenarios[0],
    );

    const token = $userTokens.tokens.find(
      (token) => token.address === modalData.market.token_id,
    );

    return new BigNumber(bestScenario.expected_return).div(
      new BigNumber(10).pow(token.decimals),
    );
  }

  async function updateEstimatedReturn() {
    if (
      !modalData.market ||
      modalData.outcome === null ||
      betAmount === null ||
      betAmount <= 0
    )
      return;

    try {
      modalState.isLoadingEstimate = true;
      // Convert bet amount to token units (multiply by 10^8)
      const betAmountScaled = BigInt(toFixed(betAmount.toString(), 8));
      const marketId = BigInt(modalData.market.id);
      const outcomeIdx = BigInt(modalData.outcome);

      const estimation = await estimateBetReturn(
        marketId,
        outcomeIdx,
        betAmountScaled,
      );

      modalState.estimatedReturn = estimation;
    } catch (error) {
      console.error("Error estimating return:", error);
    } finally {
      modalState.isLoadingEstimate = false;
    }
  }

  function handleClose() {
    onClose();
  }

  function setPercentage(percentage: number) {
    // Use tokenBalance directly if maxAmount is negative or zero
    if (modalState.maxAmount <= 0 && modalState.tokenBalance > 0) {
      console.log(
        "Using tokenBalance instead of maxAmount for percentage calculation",
      );
      // Apply percentage to token balance but reserve some for fees (~10%)
      const reservedPercent = 10;
      const availablePercent = 100 - reservedPercent;
      const adjustedBalance = modalState.tokenBalance * (availablePercent / 100);
      const calculatedAmount = (adjustedBalance * percentage) / 100;
      betAmount = Number(calculatedAmount.toFixed(8));
      console.log(
        `Set bet amount to ${betAmount} (${percentage}% of ${adjustedBalance})`,
      );

      // Ensure USD mode is also updated
      if (modalState.inputMode === "usd" && modalState.tokenPriceUsd > 0) {
        modalState.usdInputValue = Number(
          (betAmount * modalState.tokenPriceUsd).toFixed(2),
        );
      }
    } else if (modalState.maxAmount > 0) {
      const calculatedAmount = (modalState.maxAmount * percentage) / 100;
      betAmount = Number(calculatedAmount.toFixed(8));
      console.log(
        `Set bet amount to ${betAmount} (${percentage}% of max ${modalState.maxAmount})`,
      );

      // Ensure USD mode is also updated
      if (modalState.inputMode === "usd" && modalState.tokenPriceUsd > 0) {
        modalState.usdInputValue = Number(
          (betAmount * modalState.tokenPriceUsd).toFixed(2),
        );
      }
    } else {
      console.warn(
        "Cannot set percentage: both maxAmount and tokenBalance are zero or negative",
      );
    }
  }

  function goToNextStep() {
    if (modalData.outcome !== null && betAmount !== null && betAmount > 0) {
      modalState.step = 2;
    }
  }

  function goBack() {
    modalState.step = 1;
  }
</script>

<Dialog
  open={modalData.show}
  transparent={true}
  onClose={handleClose}
  title={"Make Your Prediction"}
  showClose={false}
>
  {#if modalData.market}
    <!-- Step 1: Input Bet Amount -->
    {#if modalState.step === 1}
      <div
        class="px-3 pb-3 sm:px-4 space-y-3 sm:space-y-5 flex-1 overflow-y-auto"
      >
        <!-- Market Activation Notice -->
        {#if isMarketInactive()}
          <div
            class="bg-kong-accent-yellow/20 border-2 border-kong-accent-yellow p-4 rounded relative"
          >
            <div class="flex items-center gap-2 mb-2">
              <AlertTriangle class="w-5 h-5 text-kong-accent-yellow" />
              <p class="text-sm font-semibold text-kong-accent-yellow">Market Not Yet Active</p>
            </div>
            <p class="text-sm text-kong-text-secondary">
              This market requires an initial bet to become active. The market creator must place a minimum bet to activate it before others can participate.
            </p>
          </div>
        {/if}
        
        <!-- Simplified Betting Summary Section -->
        {#if modalData.outcome !== null}
          <div
            class="bg-kong-success/10 border-2 border-kong-success p-4 rounded relative"
          >
            <p class="text-sm">You are predicting this outcome:</p>

            <span class="font-bold text-base sm:text-lg flex justify-between">
              {modalData.market.outcomes[modalData.outcome]}
            </span>
            <div class="mt-2 text-kong-text-secondary text-sm">
              {#if modalData.market.uses_time_weighting}
                <div
                  class="flex items-center justify-end gap-1 mt-1 text-xs text-kong-success"
                >
                  <Clock class="w-3 h-3" />
                  <span
                    ><span class="font-medium"
                      >{modalState.estimatedReturn?.scenarios[0]?.time_weight
                        ? "Time-weight factor " +
                          (
                            Number(
                              modalState.estimatedReturn?.scenarios[0]?.time_weight,
                            ) * 100
                          ).toFixed(1) +
                          "%"
                        : ""}</span
                    ></span
                  >
                </div>
              {/if}
            </div>
          </div>

          <!-- Bet Amount Input -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <h4 class="text-sm font-medium text-kong-text-secondary">
                Prediction Amount
              </h4>
              <div
                class="flex items-center gap-1 text-xs sm:text-sm text-kong-text-secondary"
              >
                <TokenImages
                  tokens={[
                    $userTokens.tokens.find(
                      (token) => token.address === modalState.tokenId,
                    ),
                  ]}
                  size={14}
                />
                <span class="font-medium"
                  >{formatToNonZeroDecimal(modalState.tokenBalance)}
                  {modalState.tokenSymbol}</span
                >
              </div>
            </div>

            <!-- Token Input Mode -->
            {#if modalState.inputMode === "token"}
              <div class="relative">
                <input
                  type="number"
                  bind:value={betAmount}
                  min="0"
                  max={modalState.maxAmount}
                  step="0.1"
                  class="w-full p-2.5 sm:p-3 bg-kong-bg-secondary rounded border border-kong-border focus:border-kong-accent-blue focus:ring-1 focus:ring-kong-accent-blue mb-2 {isMarketInactive() ? 'opacity-50 cursor-not-allowed' : ''}"
                  placeholder="Enter token amount"
                  disabled={isMarketInactive()}
                />
                {#if modalState.tokenPriceUsd > 0 && betAmount !== null && betAmount > 0}
                  <div
                    class="absolute right-3 top-[43%] transform -translate-y-1/2 text-xs text-kong-text-secondary"
                  >
                    ≈ {formatUsd(modalState.betAmountUsd)}
                  </div>
                {/if}
              </div>

              <!-- USD Input Mode -->
            {:else}
              <div class="relative">
                <input
                  type="number"
                  bind:value={modalState.usdInputValue}
                  min="0"
                  step="0.01"
                  class="w-full p-2.5 sm:p-3 !pl-7 bg-kong-bg-secondary rounded border border-kong-border focus:border-kong-accent-blue focus:ring-1 focus:ring-kong-accent-blue mb-2 {isMarketInactive() ? 'opacity-50 cursor-not-allowed' : ''}"
                  placeholder="Enter USD amount"
                  disabled={isMarketInactive()}
                />
                <div
                  class="absolute left-3 top-[43%] transform -translate-y-1/2 text-kong-text-secondary"
                >
                  $
                </div>
                {#if modalState.usdInputValue !== null}
                  <div
                    class="absolute right-3 top-[43%] transform -translate-y-1/2 text-xs text-kong-text-secondary"
                  >
                    ≈ {betAmount !== null
                      ? formatToNonZeroDecimal(betAmount)
                      : ""}
                    {modalState.tokenSymbol}
                  </div>
                {/if}
              </div>
            {/if}

            <div class="grid grid-cols-4 gap-1.5 sm:gap-2">
              <ButtonV2
                label="25%"
                theme="secondary"
                variant="solid"
                size="xs"
                onclick={() => setPercentage(25)}
                isDisabled={!$auth.isConnected || modalState.tokenBalance <= 0 || isMarketInactive()}
                className="sm:text-sm"
              />
              <ButtonV2
                label="50%"
                theme="secondary"
                variant="solid"
                size="xs"
                onclick={() => setPercentage(50)}
                isDisabled={!$auth.isConnected || modalState.tokenBalance <= 0 || isMarketInactive()}
                className="sm:text-sm"
              />
              <ButtonV2
                label="75%"
                theme="secondary"
                variant="solid"
                size="xs"
                onclick={() => setPercentage(75)}
                isDisabled={!$auth.isConnected || modalState.tokenBalance <= 0 || isMarketInactive()}
                className="sm:text-sm"
              />
              <ButtonV2
                label="MAX"
                theme="secondary"
                variant="solid"
                size="xs"
                onclick={() => setPercentage(100)}
                isDisabled={!$auth.isConnected || modalState.tokenBalance <= 0 || isMarketInactive()}
                className="sm:text-sm"
              />
            </div>
            <!-- Token/USD Input Toggle -->
            {#if modalState.tokenPriceUsd > 0}
              <div class="flex justify-end mt-2">
                <button
                  class="flex items-center text-xs text-kong-text-secondary hover:text-kong-text-primary transition-colors"
                  onclick={toggleInputMode}
                >
                  <RefreshCw class="w-3 h-3 mr-1" />
                  Switch to {modalState.inputMode === "token" ? "USD" : "token"} input
                </button>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Error Message -->
        {#if modalData.error}
          <div
            class="p-2.5 sm:p-3 bg-kong-error/20 border border-kong-error/40 rounded text-kong-error flex items-center gap-2"
          >
            <AlertTriangle class="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span class="text-sm">{modalData.error}</span>
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
            onclick={handleClose}
            className="flex-1 font-bold sm:text-base"
          />
          <ButtonV2
            label="Next"
            theme="accent-green"
            variant="solid"
            size="lg"
            onclick={goToNextStep}
            isDisabled={modalData.outcome === null || !betAmount || isMarketInactive()}
            className="flex-1 font-bold sm:text-base"
          />
        </div>
      </div>

      <!-- Step 2: Confirmation Screen -->
    {:else if modalState.step === 2}
      <div class="px-3 pb-3 sm:px-4 flex-1 overflow-y-auto">
        <div class="py-6 flex flex-col items-center">
          <!-- Confirmation Message -->
          <div
            class="bg-kong-success/10 border-2 border-kong-success p-5 rounded-lg w-full max-w-md mt-3"
          >
            <h3 class="text-center text-lg font-medium mb-4">
              Confirm Your Bet
            </h3>

            <p class="text-center text-base leading-relaxed">
              You are placing <span class="font-bold"
                >{formatToNonZeroDecimal(betAmount)} {modalState.tokenSymbol}</span
              >
              {#if modalState.tokenPriceUsd > 0}
                <span class="text-kong-text-secondary"
                  >({formatUsd(modalState.betAmountUsd)})</span
                >
              {/if}
              on the outcome
              <span class="font-bold"
                >{modalData.market.outcomes[modalData.outcome]}</span
              >. The market ends in
              <span class="font-bold"
                ><CountdownTimer endTime={modalData.market.end_time} /></span
              >.
            </p>

            {#if modalState.isLoadingEstimate}
              <div class="text-center mt-4">
                <div
                  class="inline-block w-5 h-5 border-2 border-kong-success border-t-transparent rounded-full animate-spin"
                ></div>
                <p class="mt-2">Calculating potential return...</p>
              </div>
            {:else if modalState.estimatedReturn}
              <div class="text-center mt-4">
                <p class="text-base leading-relaxed">
                  If the market resolves to this outcome, you will receive
                  <span class="text-kong-success font-bold"
                    >{potentialWin.isZero()
                      ? "0"
                      : formatToNonZeroDecimal(potentialWin.toNumber())}
                    {modalState.tokenSymbol}</span
                  >
                  {#if modalState.tokenPriceUsd > 0}
                    <span class="text-kong-success"
                      >({formatUsd(
                        potentialWin.toNumber() * modalState.tokenPriceUsd,
                      )})</span
                    >
                  {/if}
                  based on the current pool size.
                </p>

                {#if modalData.market.uses_time_weighting && modalState.estimatedReturn.time_weight_alpha}
                  <div class="mt-3 text-sm bg-kong-bg-secondary p-2 rounded">
                    <div
                      class="flex items-center justify-center gap-1 text-kong-success mb-1"
                    >
                      <Clock class="w-4 h-4" />
                      <span class="font-medium">Time-Weighted Rewards</span>
                    </div>
                    <p class="text-kong-text-secondary">
                      Early betters receive higher rewards. <br />
                      {#if modalState.estimatedReturn.scenarios[0]?.time_weight}
                        Your time weight factor:
                        <span class="font-medium"
                          >{(
                            Number(
                              modalState.estimatedReturn.scenarios[0].time_weight,
                            ) * 100
                          ).toFixed(1)}%</span
                        >
                      {/if}
                    </p>
                  </div>
                {/if}
              </div>
            {:else}
              <p class="text-center text-base leading-relaxed mt-4">
                If the market resolves to this outcome, you will receive your
                winnings based on the current pool size.
              </p>
            {/if}
          </div>

          <!-- Warning or additional info can go here -->
          <div
            class="mt-4 text-sm text-kong-text-secondary text-center max-w-md"
          >
            <p>Once confirmed, your bet cannot be changed or canceled.</p>
          </div>
        </div>

        <!-- Error Message -->
        {#if modalData.error}
          <div
            class="p-2.5 sm:p-3 bg-kong-error/20 border border-kong-error/40 rounded text-kong-error flex items-center gap-2 mt-3"
          >
            <AlertTriangle class="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span class="text-sm">{modalData.error}</span>
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
            onclick={goBack}
            isDisabled={modalData.isBetting}
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
            onclick={() => onBet(betAmount)}
            isDisabled={modalData.isBetting}
            className="flex-1 font-bold sm:text-base flex items-center justify-center gap-2"
          >
            <div class="flex gap-1">
              {#if modalData.isBetting}
                <div
                  class="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                ></div>
                {#if modalData.isApprovingAllowance}
                  Approving...
                {:else}
                  Placing...
                {/if}
              {:else}
                Confirm
              {/if}
            </div>
          </ButtonV2>
        </div>
      </div>
    {/if}
  {/if}
</Dialog>

<style>
  /* Hide number input arrows */
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type="number"] {
    -moz-appearance: textfield; /* Firefox */
    appearance: textfield;
  }
</style>
