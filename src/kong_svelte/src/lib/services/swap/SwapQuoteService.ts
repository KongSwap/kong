import type { Writable } from "svelte/store";
import type { SwapState } from "./SwapStateService";
import { SwapService } from "./SwapService";

export class SwapQuoteService {
    static async updateQuote(
        state: SwapState,
        hasValidPool: boolean,
        swapState: Writable<SwapState>
    ) {
        if (
            !state.payToken ||
            !state.receiveToken ||
            !hasValidPool ||
            !state.payAmount ||
            state.payAmount === "0"
        ) {
            swapState.update((s) => ({
                ...s,
                receiveAmount: "0",
                swapSlippage: 0,
            }));
            return;
        }

        try {
            const quote = await SwapService.getSwapQuote(
                state.payToken,
                state.receiveToken,
                state.payAmount
            );

            swapState.update((s) => ({
                ...s,
                receiveAmount: quote.receiveAmount,
                swapSlippage: quote.slippage,
            }));
        } catch (error) {
            console.error("Error getting quote:", error);
            swapState.update((s) => ({
                ...s,
                receiveAmount: "0",
                swapSlippage: 0,
                error: "Failed to get quote",
            }));
        }
    }
} 