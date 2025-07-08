import { get } from "svelte/store";
import { toastStore } from "$lib/stores/toastStore";
import { walletProviderStore } from "$lib/stores/walletProviderStore";
import { auth } from "$lib/stores/auth";
import { placeBet } from "$lib/api/predictionMarket";
import { toScaledAmount } from "$lib/utils/numberFormatUtils";
import { marketStore } from "$lib/stores/marketStore";

interface BetModalState {
  show: boolean;
  market: any | null;
  amount: number;
  outcome: number | null;
  error: string | null;
  isBetting: boolean;
  isApprovingAllowance: boolean;
}

export function useBetModal(kongToken: Kong.Token | null) {
  let state = $state<BetModalState>({
    show: false,
    market: null,
    amount: 0,
    outcome: null,
    error: null,
    isBetting: false,
    isApprovingAllowance: false
  });

  // Store pending market/outcome for post-auth handling
  let pendingMarket: any = null;
  let pendingOutcome: number | null = null;

  function open(market: any, outcomeIndex?: number) {
    const authState = get(auth);
    if (!authState.isConnected) {
      pendingMarket = market;
      pendingOutcome = outcomeIndex !== undefined ? outcomeIndex : 0;
      walletProviderStore.open(handleWalletLogin);
      return;
    }

    state = {
      show: true,
      market,
      amount: 0,
      outcome: outcomeIndex !== undefined ? outcomeIndex : 0,
      error: null,
      isBetting: false,
      isApprovingAllowance: false
    };
  }

  function close() {
    state.show = false;
  }

  function handleWalletLogin() {
    if (pendingMarket) {
      open(pendingMarket, pendingOutcome ?? undefined);
      pendingMarket = null;
      pendingOutcome = null;
    }
  }

  async function placeBetHandler(amount: number) {
    if (!state.market || state.outcome === null) return;

    try {
      state.isBetting = true;
      state.error = null;

      if (!kongToken) {
        throw new Error("Failed to fetch KONG token information");
      }

      const scaledAmount = toScaledAmount(amount.toString(), kongToken.decimals);

      await placeBet(
        kongToken,
        BigInt(state.market.id),
        BigInt(state.outcome),
        scaledAmount,
      );

      toastStore.add({
        title: "Bet Placed",
        message: `You bet ${amount} KONG on ${state.market.outcomes[state.outcome]}`,
        type: "success",
      });

      close();
      await marketStore.refreshMarkets();
    } catch (e) {
      console.error("Bet error:", e);
      state.error = e instanceof Error ? e.message : "Failed to place bet";
    } finally {
      state.isBetting = false;
    }
  }

  return {
    state,
    open,
    close,
    placeBet: placeBetHandler
  };
}