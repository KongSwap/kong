import { writable } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';
import BigNumber from 'bignumber.js';

// Configure BigNumber
BigNumber.config({
  DECIMAL_PLACES: 36,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
  EXPONENTIAL_AT: [-50, 50]
});

interface SwapStatus {
    swapId: string;
    status: string;
    isProcessing: boolean;
    error: string | null;
    lastPayAmount?: BigNumber;
    expectedReceiveAmount?: BigNumber;
    minReceiveAmount?: BigNumber;
    payToken?: FE.Token;
    receiveToken?: FE.Token;
    payDecimals?: number;
    receiveDecimals?: number;
    lastQuote?: any;
    shouldRefreshQuote?: boolean;
    priceImpact?: BigNumber;
    timestamp: number;
    route?: string[];
    fees?: {
        gas: BigNumber;
        lp: BigNumber;
        token?: string;
    };
}

function createSwapStatusStore() {
    const { subscribe, set, update } = writable<Record<string, SwapStatus>>({});

    return {
        subscribe,
        addSwap: (swapDetails: {
            lastPayAmount?: string | number | BigNumber;
            expectedReceiveAmount?: string | number | BigNumber;
            minReceiveAmount?: string | number | BigNumber;
            payToken?: FE.Token;
            receiveToken?: FE.Token;
            payDecimals?: number;
            receiveDecimals?: number;
            priceImpact?: string | number | BigNumber;
            route?: string[];
            fees?: {
                gas: string | number | BigNumber;
                lp: string | number | BigNumber;
                token?: string;
            };
        }) => {
            const swapId = uuidv4();
            update(swaps => ({
                ...swaps,
                [swapId]: {
                    swapId,
                    status: '',
                    isProcessing: false,
                    error: null,
                    shouldRefreshQuote: false,
                    timestamp: Date.now(),
                    lastPayAmount: swapDetails.lastPayAmount ? new BigNumber(swapDetails.lastPayAmount) : undefined,
                    expectedReceiveAmount: swapDetails.expectedReceiveAmount ? new BigNumber(swapDetails.expectedReceiveAmount) : undefined,
                    minReceiveAmount: swapDetails.minReceiveAmount ? new BigNumber(swapDetails.minReceiveAmount) : undefined,
                    payToken: swapDetails.payToken,
                    receiveToken: swapDetails.receiveToken,
                    payDecimals: swapDetails.payDecimals,
                    receiveDecimals: swapDetails.receiveDecimals,
                    priceImpact: swapDetails.priceImpact ? new BigNumber(swapDetails.priceImpact) : undefined,
                    route: swapDetails.route,
                    fees: swapDetails.fees ? {
                        gas: new BigNumber(swapDetails.fees.gas),
                        lp: new BigNumber(swapDetails.fees.lp),
                        token: swapDetails.fees.token
                    } : undefined
                }
            }));
            return swapId;
        },

        updateSwap: (swapId: string, updates: Partial<{
            status: string;
            isProcessing: boolean;
            error: string | null;
            lastPayAmount: string | number | BigNumber;
            expectedReceiveAmount: string | number | BigNumber;
            minReceiveAmount: string | number | BigNumber;
            shouldRefreshQuote: boolean;
            lastQuote: any;
            priceImpact: string | number | BigNumber;
            fees: {
                gas: string | number | BigNumber;
                lp: string | number | BigNumber;
                token?: string;
            };
        }>) => {
            update(swaps => {
                const currentSwap = swaps[swapId];
                if (!currentSwap) return swaps;

                const updatedSwap = { ...currentSwap };

                // Convert numeric values to BigNumber
                if (updates.lastPayAmount !== undefined) {
                    updatedSwap.lastPayAmount = new BigNumber(updates.lastPayAmount);
                }
                if (updates.expectedReceiveAmount !== undefined) {
                    updatedSwap.expectedReceiveAmount = new BigNumber(updates.expectedReceiveAmount);
                }
                if (updates.minReceiveAmount !== undefined) {
                    updatedSwap.minReceiveAmount = new BigNumber(updates.minReceiveAmount);
                }
                if (updates.priceImpact !== undefined) {
                    updatedSwap.priceImpact = new BigNumber(updates.priceImpact);
                }
                if (updates.fees) {
                    updatedSwap.fees = {
                        gas: new BigNumber(updates.fees.gas),
                        lp: new BigNumber(updates.fees.lp),
                        token: updates.fees.token
                    };
                }

                // Update non-numeric values
                if (updates.status !== undefined) updatedSwap.status = updates.status;
                if (updates.isProcessing !== undefined) updatedSwap.isProcessing = updates.isProcessing;
                if (updates.error !== undefined) updatedSwap.error = updates.error;
                if (updates.shouldRefreshQuote !== undefined) updatedSwap.shouldRefreshQuote = updates.shouldRefreshQuote;
                if (updates.lastQuote !== undefined) updatedSwap.lastQuote = updates.lastQuote;

                return {
                    ...swaps,
                    [swapId]: updatedSwap
                };
            });
        },

        removeSwap: (swapId: string) => {
            update(swaps => {
                const { [swapId]: _, ...rest } = swaps;
                return rest;
            });
        },

        clearOldSwaps: (maxAgeMs: number = 1000 * 60 * 60) => {
            const now = Date.now();
            update(swaps => {
                return Object.fromEntries(
                    Object.entries(swaps).filter(([_, swap]) => 
                        now - swap.timestamp < maxAgeMs
                    )
                );
            });
        },

        getSwap: (swapId: string) => {
            let currentSwap: SwapStatus | null = null;
            update(swaps => {
                currentSwap = swaps[swapId] || null;
                return swaps;
            });
            return currentSwap;
        },

        // Helper method to get formatted amounts
        getFormattedAmounts: (swapId: string) => {
            const swap = this.getSwap(swapId);
            if (!swap) return null;

            return {
                payAmount: swap.lastPayAmount?.toFormat(swap.payDecimals || 8),
                receiveAmount: swap.expectedReceiveAmount?.toFormat(swap.receiveDecimals || 8),
                minReceiveAmount: swap.minReceiveAmount?.toFormat(swap.receiveDecimals || 8),
                priceImpact: swap.priceImpact?.toFormat(2),
                fees: swap.fees ? {
                    gas: swap.fees.gas.toFormat(swap.receiveDecimals || 8),
                    lp: swap.fees.lp.toFormat(swap.receiveDecimals || 8),
                    token: swap.fees.token
                } : undefined
            };
        }
    };
}

export const swapStatusStore = createSwapStatusStore(); 
