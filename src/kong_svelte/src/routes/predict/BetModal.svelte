<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { AlertTriangle, CircleHelp, Clock, Coins } from "lucide-svelte";
  import { formatBalance, toFixed } from "$lib/utils/numberFormatUtils";
  import CountdownTimer from "$lib/components/common/CountdownTimer.svelte";
  import { currentUserBalancesStore } from "$lib/stores/tokenStore";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { calculateMaxAmount } from "$lib/utils/validators/tokenValidators";

  export let showBetModal: boolean;
  export let selectedMarket: any;
  export let isBetting: boolean;
  export let isApprovingAllowance: boolean;
  export let betError: string | null;
  export let selectedOutcome: number | null;
  export let betAmount: number;

  export let onClose: () => void;
  export let onBet: (amount: number) => void;
  export let onOutcomeSelect: (index: number) => void;

  let kongBalance = 0;
  let maxAmount = 0;

  // Subscribe to the currentUserBalancesStore to get KONG balance
  $: {
    const balances = $currentUserBalancesStore;
    if (balances && balances[KONG_LEDGER_CANISTER_ID]) {
      const rawBalance = BigInt(balances[KONG_LEDGER_CANISTER_ID].in_tokens);
      kongBalance = Number(rawBalance) / 1e8;
      // Calculate max amount considering the token fee
      maxAmount = calculateMaxAmount(rawBalance, 8, BigInt(10000));
    }
  }

  function setPercentage(percentage: number) {
    if (maxAmount > 0) {
      betAmount = Number((maxAmount * (percentage / 100)).toFixed(8));
    }
  }

  function calculatePercentage(
    amount: number | undefined,
    total: number | undefined,
  ): number {
    const amountNum = Number(amount || 0);
    const totalNum = Number(total || 0);
    if (isNaN(amountNum) || isNaN(totalNum)) return 0;
    if (totalNum === 0) return amountNum > 0 ? 100 : 0;
    return (amountNum / totalNum) * 100;
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

  $: potentialWin =
    selectedOutcome !== null
      ? calculatePotentialWin(selectedOutcome, betAmount)
      : 0;
</script>

<Modal
  isOpen={showBetModal}
  variant="transparent"
  on:close={onClose}
  title={selectedMarket?.question || "Place Your Bet"}
  width="min(95vw, 500px)"
  className="!rounded max-h-[90vh] flex flex-col"
>
  {#if selectedMarket}
    <div class="px-3 pb-3 sm:px-4 space-y-2 sm:space-y-4 flex-1 overflow-y-auto">
      <!-- Market Stats Section -->
      <div class="grid grid-cols-2 gap-3 sm:gap-4">
        <div class="bg-kong-bg-light/50 rounded p-2.5 sm:p-3 flex items-center gap-2">
          <Coins class="w-4 h-4 text-kong-text-secondary" />
          <div>
            <div class="text-xs text-kong-text-secondary">Total Pool</div>
            <div class="text-sm sm:text-base font-medium">{formatBalance(selectedMarket.total_pool, 8)} KONG</div>
          </div>
        </div>
        <div class="bg-kong-bg-light/50 rounded p-2.5 sm:p-3 flex items-center gap-2">
          <Clock class="w-4 h-4 text-kong-text-secondary" />
          <div>
            <div class="text-xs text-kong-text-secondary">Time Remaining</div>
            <div class="text-sm sm:text-base font-medium"><CountdownTimer endTime={selectedMarket.end_time} /></div>
          </div>
        </div>
      </div>

      <!-- Outcomes Selection Section -->
      <div class="space-y-2 sm:space-y-3">
        {#each selectedMarket.outcomes as outcome, i}
          <button
            class={`w-full p-3 sm:p-4 rounded text-left relative transition-all ${selectedOutcome === i ? "bg-kong-accent-green/10 border-2 border-kong-accent-green" : "bg-kong-bg-light/50 border border-kong-border hover:border-kong-accent-green/50"}`}
            on:click={() => onOutcomeSelect(i)}
          >
            <div
              class="absolute top-0 left-0 h-full bg-kong-text-accent-green/20 rounded transition-all z-0"
              style:width={`${calculatePercentage(
                selectedMarket.outcome_pools[i],
                selectedMarket.outcome_pools.reduce(
                  (acc, pool) => acc + Number(pool || 0),
                  0,
                ),
              ).toFixed(1)}%`}
            ></div>
            <div class="relative flex justify-between items-center z-10">
              <div class="flex flex-col flex-1 min-w-0">
                <span class="font-medium text-sm sm:text-base truncate">{outcome}</span>
                <div class="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-kong-text-secondary mt-1">
                  <div class="flex items-center gap-1 min-w-0">
                    <Coins class="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span class="truncate">{formatBalance(selectedMarket.outcome_pools[i], 8)} KONG</span>
                  </div>
                </div>
              </div>
              <div class="flex flex-col items-end justify-center ml-3">
                <span class="text-kong-text-accent-green font-medium text-sm sm:text-base whitespace-nowrap">
                  {calculatePercentage(
                    selectedMarket.outcome_pools[i],
                    selectedMarket.outcome_pools.reduce(
                      (acc, pool) => acc + Number(pool || 0),
                      0,
                    ),
                  ).toFixed(1)}%
                </span>
                <span class="text-xs sm:text-sm text-kong-text-secondary whitespace-nowrap">
                  {calculateOdds(i)}x payout
                </span>
              </div>
            </div>
          </button>
        {/each}
      </div>

      <!-- Bet Amount Section -->
      <div>
        <div class="flex sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-2 sm:mb-3">
          <h4 class="text-sm font-medium text-kong-text-secondary">Bet Amount</h4>
          <div class="flex items-center gap-2 text-xs sm:text-sm text-kong-text-secondary">
            <Coins class="w-3 h-3 sm:w-4 sm:h-4" />
            <span>Balance: <span class="font-medium">{kongBalance.toFixed(8)} KONG</span></span>
          </div>
        </div>
        <input
          type="number"
          bind:value={betAmount}
          min="0"
          max={maxAmount}
          step="0.1"
          class="w-full p-2.5 sm:p-3 bg-kong-bg-light rounded border border-kong-border focus:border-kong-accent-blue focus:ring-1 focus:ring-kong-accent-blue mb-2"
          placeholder="Enter amount"
        />
        <div class="grid grid-cols-4 gap-1.5 sm:gap-2">
          <button
            class="px-2 py-1.5 text-xs sm:text-sm bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-primary rounded transition-colors"
            on:click={() => setPercentage(25)}
            disabled={maxAmount <= 0}
          >
            25%
          </button>
          <button
            class="px-2 py-1.5 text-xs sm:text-sm bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-primary rounded transition-colors"
            on:click={() => setPercentage(50)}
            disabled={maxAmount <= 0}
          >
            50%
          </button>
          <button
            class="px-2 py-1.5 text-xs sm:text-sm bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-primary rounded transition-colors"
            on:click={() => setPercentage(75)}
            disabled={maxAmount <= 0}
          >
            75%
          </button>
          <button
            class="px-2 py-1.5 text-xs sm:text-sm bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-primary rounded transition-colors"
            on:click={() => setPercentage(100)}
            disabled={maxAmount <= 0}
          >
            MAX
          </button>
        </div>
      </div>

      <!-- Potential Win Section -->
      {#if selectedOutcome !== null && betAmount > 0}
        <div class="bg-kong-bg-light/50 rounded p-3 sm:p-4">
          <div class="space-y-2">
            <div class="flex justify-between items-center text-sm">
              <span class="text-kong-text-secondary">Selected Outcome</span>
              <span class="font-medium truncate ml-4">{selectedMarket.outcomes[selectedOutcome]}</span>
            </div>
            <div class="flex justify-between items-center text-sm">
              <span class="text-kong-text-secondary">Bet Amount</span>
              <span class="font-medium">{betAmount} KONG</span>
            </div>
            <div class="flex justify-between items-center text-sm">
              <span class="text-kong-text-secondary">Potential Win</span>
              <span class="text-kong-text-accent-green font-medium">
                {formatBalance(potentialWin, 8)} KONG
              </span>
            </div>
          </div>
          <div class="mt-2 text-xs text-kong-text-secondary/60 text-center">
            *Estimated based on current pool distribution
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

    <!-- Action Buttons - Now in a separate div outside the scrollable content -->
    <div class="p-3 sm:px-4 border-t border-kong-border bg-kong-bg mt-auto">
      <div class="flex gap-2 sm:gap-3">
        <button
          class="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-kong-bg-light text-kong-text-primary rounded font-bold hover:bg-kong-bg-dark transition-all text-sm sm:text-base"
          on:click={onClose}
          disabled={isBetting}
        >
          Cancel
        </button>
        <button
          class="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-kong-accent-green text-white rounded font-bold hover:bg-kong-accent-green-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
          on:click={() => onBet(betAmount)}
          disabled={isBetting || selectedOutcome === null || !betAmount}
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
            Confirm Bet
          {/if}
        </button>
      </div>
    </div>
  {/if}
</Modal>

<style>
  /* Add any additional styles here */
</style>
