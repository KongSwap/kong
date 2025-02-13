<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { AlertTriangle } from "lucide-svelte";
  import { formatBalance, toFixed } from "$lib/utils/numberFormatUtils";
  import CountdownTimer from "$lib/components/common/CountdownTimer.svelte";
  import { storedBalancesStore } from "$lib/services/tokens/tokenStore";
  import { KONG_LEDGER_CANISTER_ID } from "$lib/constants/canisterConstants";
  import { calculateMaxAmount } from "$lib/utils/tokenValidationUtils";

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

  // Subscribe to the storedBalancesStore to get KONG balance
  $: {
    const balances = $storedBalancesStore;
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

    if (outcomePool === 0) return 0; // Prevent division by zero

    // Calculate the total pool of other outcomes (the losing pool if you win)
    const otherOutcomesPool = selectedMarket.outcome_pools.reduce(
      (acc: number, pool: number, i: number) =>
        i === outcomeIndex ? acc : acc + Number(pool || 0),
      0,
    );

    // Your share of the outcome pool after your bet
    const yourShareOfPool = betAmountScaled / (outcomePool + betAmountScaled);

    // If you win, you get:
    // 1. Your bet back
    // 2. Your proportional share of the losing pool
    const potentialWin =
      betAmountScaled + Math.floor(yourShareOfPool * otherOutcomesPool);

    // For debugging
    console.log({
      betAmountScaled,
      currentTotalPool,
      outcomePool,
      otherOutcomesPool,
      yourShareOfPool,
      potentialWin,
    });

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
  title="Place Your Bet"
  width="500px"
  className="!rounded"
>
  {#if selectedMarket}
    <div class="px-4 pb-4">
      <div class="mb-6">
        <h3 class="text-xl font-bold mb-2">{selectedMarket.question}</h3>
        <div class="flex items-center justify-between">
          <div class="text-sm text-kong-text-secondary">
            Total Pool: {formatBalance(selectedMarket.total_pool, 8)} KONG
          </div>
          <div class="text-sm text-kong-text-secondary mt-1">
            Time Remaining: <CountdownTimer endTime={selectedMarket.end_time} />
          </div>
        </div>
      </div>

      <div class="space-y-4 mb-6">
        {#each selectedMarket.outcomes as outcome, i}
          <button
            class={`w-full p-4 rounded text-left relative transition-all ${selectedOutcome === i ? "bg-kong-accent-green/10 border-2 border-kong-accent-green" : "bg-kong-bg-light/50 border border-kong-border hover:border-kong-accent-green/50"}`}
            on:click={() => onOutcomeSelect(i)}
          >
            <div
              class="absolute top-0 left-0 h-full bg-kong-accent-green/20 rounded transition-all z-0"
              style:width={`${calculatePercentage(
                selectedMarket.outcome_pools[i],
                selectedMarket.outcome_pools.reduce(
                  (acc, pool) => acc + Number(pool || 0),
                  0,
                ),
              ).toFixed(1)}%`}
            ></div>
            <div class="relative flex justify-between items-center z-10">
              <div class="flex flex-col">
                <span class="font-medium">{outcome}</span>
                <div
                  class="relative text-sm text-kong-text-secondary mt-1 z-10"
                >
                  Current Pool: {formatBalance(
                    selectedMarket.outcome_pools[i],
                    8,
                  )} KONG
                </div>
              </div>
              <div class="flex flex-col items-end justify-center">
                <span class="text-kong-accent-green">
                  {calculatePercentage(
                    selectedMarket.outcome_pools[i],
                    selectedMarket.outcome_pools.reduce(
                      (acc, pool) => acc + Number(pool || 0),
                      0,
                    ),
                  ).toFixed(1)}%
                </span>

                <span class="text-kong-text-secondary">
                  Odds: {calculateOdds(i)}
                </span>
              </div>
            </div>
          </button>
        {/each}
      </div>

      <div class="mb-6">
        <div class="flex flex-col gap-1 mb-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-kong-text-secondary"
              >Bet Amount (KONG)</label
            >
            <div
              class="flex items-center gap-2 text-sm text-kong-text-secondary"
            >
              <span
                >Balance: <span class="font-medium"
                  >{kongBalance.toFixed(8)}</span
                ></span
              >
            </div>
          </div>
        </div>
        <input
          type="number"
          bind:value={betAmount}
          min="0"
          max={maxAmount}
          step="0.1"
          class="w-full p-3 bg-kong-bg-light rounded border border-kong-border focus:border-kong-accent-blue focus:ring-1 focus:ring-kong-accent-blue"
          placeholder="Enter amount"
        />
        <div class="grid grid-cols-4 gap-2 mt-2">
          <button
            class="px-2 py-1.5 text-sm bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-primary rounded transition-colors"
            on:click={() => setPercentage(25)}
            disabled={maxAmount <= 0}
          >
            25%
          </button>
          <button
            class="px-2 py-1.5 text-sm bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-primary rounded transition-colors"
            on:click={() => setPercentage(50)}
            disabled={maxAmount <= 0}
          >
            50%
          </button>
          <button
            class="px-2 py-1.5 text-sm bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-primary rounded transition-colors"
            on:click={() => setPercentage(75)}
            disabled={maxAmount <= 0}
          >
            75%
          </button>
          <button
            class="px-2 py-1.5 text-sm bg-kong-bg-light hover:bg-kong-bg-dark text-kong-text-primary rounded transition-colors"
            on:click={() => setPercentage(100)}
            disabled={maxAmount <= 0}
          >
            MAX
          </button>
        </div>
        {#if selectedOutcome !== null && betAmount > 0}
          <div class="mt-2 flex items-center justify-between text-sm">
            <span class="text-kong-text-secondary">Potential Win:</span>
            <span class="text-kong-accent-green font-medium">
              {formatBalance(potentialWin, 8)} KONG
            </span>
          </div>
          <div class="mt-1 text-xs text-kong-text-secondary/60 text-right">
            *Estimated based on current pool distribution
          </div>
        {/if}
      </div>

      {#if betError}
        <div
          class="mb-4 p-3 bg-kong-accent-red/20 border border-kong-accent-red/40 rounded text-kong-text-accent-red flex items-center gap-2"
        >
          <AlertTriangle class="w-5 h-5" />
          <span>{betError}</span>
        </div>
      {/if}

      <div class="flex gap-3">
        <button
          class="flex-1 px-4 py-3 bg-kong-bg-light text-kong-text-primary rounded font-bold hover:bg-kong-bg-dark transition-all"
          on:click={onClose}
          disabled={isBetting}
        >
          Cancel
        </button>
        <button
          class="flex-1 px-4 py-3 bg-kong-accent-green text-white rounded font-bold hover:bg-kong-accent-green-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          on:click={() => onBet(betAmount)}
          disabled={isBetting || selectedOutcome === null || !betAmount}
        >
          {#if isBetting}
            <div
              class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
            ></div>
            {#if isApprovingAllowance}
              Approving KONG...
            {:else}
              Placing Bet...
            {/if}
          {:else}
            Confirm Bet
          {/if}
        </button>
      </div>
    </div>
  {/if}
</Modal>
