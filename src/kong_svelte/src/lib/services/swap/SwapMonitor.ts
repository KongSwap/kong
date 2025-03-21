import { toastStore } from "$lib/stores/toastStore";
import { swapStatusStore } from "$lib/stores/swapStore";
import { get } from "svelte/store";
import { loadBalances } from "$lib/stores/tokenStore";
import { auth } from "$lib/stores/auth";
import { SwapService } from "./SwapService";
import { swapState } from "./SwapStateService";
import { userTokens } from "$lib/stores/userTokens";

interface SwapStatus {
  status: string;
  pay_amount: bigint;
  pay_symbol: string;
  receive_amount: bigint;
  receive_symbol: string;
}

interface SwapResponse {
  Swap: SwapStatus;
}

interface RequestStatus {
  reply: SwapResponse;
  statuses: string[];
}

interface RequestResponse {
  Ok: RequestStatus[];
}

export class SwapMonitor {
  private static FAST_POLLING_INTERVAL = 100; // 100ms polling interval
  private static MAX_ATTEMPTS = 200; // 30 seconds total monitoring time
  private static pollingInterval: NodeJS.Timeout | null = null;
  private static startTime: number;

  public static async monitorTransaction(requestId: bigint, swapId: string, toastId: string) {
    this.stopPolling();
    this.startTime = Date.now();
    let attempts = 0;
    let shownStatuses = new Set<string>();

    const poll = async () => {
      if (attempts >= this.MAX_ATTEMPTS) {
        this.stopPolling();
        swapStatusStore.updateSwap(swapId, {
          status: "Timeout",
          isProcessing: false,
          error: "Swap timed out",
        });
        toastStore.error("Swap timed out");
        return;
      }

      try {
        const status: RequestResponse = await SwapService.requests([requestId]);

        if (status.Ok?.[0]?.reply) {
          const res: RequestStatus = status.Ok[0];

          // Only show toast for new status updates
          if (res.statuses && res.statuses.length > 0) {            
            for (const status of res.statuses) {
              if (!shownStatuses.has(status)) {
                shownStatuses.add(status);
                
                if (status.toLowerCase() === "swap success") {
                  toastStore.dismiss(toastId);
                  const state = get(swapState);
                  const token0 = state.payToken;
                  const token1 = state.receiveToken;
                  toastStore.success(`Swap of  ${token0?.symbol} for ${token1?.symbol} completed successfully`);
                  swapState.setShowSuccessModal(true);
                } else if (status === "Success") {
                  toastStore.info(`Balances updated!`);
                } else if (status.toLowerCase().includes("failed")) {
                  toastStore.dismiss(toastId);
                  toastStore.error(`${status}`);
                }
              }
            }
          }

          if (res.statuses.find((s) => s.includes("Failed"))) {
            this.stopPolling();
            swapStatusStore.updateSwap(swapId, {
              status: "Error",
              isProcessing: false,
              error: res.statuses.find((s) => s.includes("Failed")),
            });
            toastStore.dismiss(toastId);
            toastStore.error(res.statuses.find((s) => s.includes("Failed")));
            return;
          }

          if ("Swap" in res.reply) {
            const swapStatus: SwapStatus = res.reply.Swap;
            swapStatusStore.updateSwap(swapId, {
              status: swapStatus.status,
              isProcessing: true,
              error: null,
            });

            if (swapStatus.status === "Success") {
              this.stopPolling();
              const token0 = get(userTokens).tokens.find(
                (t) => t.symbol === swapStatus.pay_symbol,
              );
              const token1 = get(userTokens).tokens.find(
                (t) => t.symbol === swapStatus.receive_symbol,
              );

              const formattedPayAmount = SwapService.fromBigInt(
                swapStatus.pay_amount,
                token0?.decimals || 0,
              );
              const formattedReceiveAmount = SwapService.fromBigInt(
                swapStatus.receive_amount,
                token1?.decimals || 0,
              );

              swapStatusStore.updateSwap(swapId, {
                status: "Success",
                isProcessing: false,
                shouldRefreshQuote: true,
                lastQuote: null,
                details: {
                  payAmount: formattedPayAmount,
                  payToken: token0,
                  receiveAmount: formattedReceiveAmount,
                  receiveToken: token1,
                },
              });

              // Load updated balances
              const tokens = get(userTokens).tokens;
              const payToken = tokens.find(
                (t) => t.symbol === swapStatus.pay_symbol,
              );
              const receiveToken = tokens.find(
                (t) => t.symbol === swapStatus.receive_symbol,
              );
              const walletId = auth?.pnp?.account?.owner?.toString();

              if (!payToken || !receiveToken || !walletId) {
                console.error("Missing token or wallet info for balance update");
                return;
              }

              try {
                await loadBalances(
                  [payToken, receiveToken],
                  walletId.toString(),
                  true
                );
              } catch (error) {
                console.error("Error updating balances:", error);
              }

              return;
            } else if (swapStatus.status === "Failed") {
              this.stopPolling();
              swapStatusStore.updateSwap(swapId, {
                status: "Failed",
                isProcessing: false,
                error: "Swap failed",
              });
              toastStore.error("Swap failed");
              return;
            }
          }
        }

        attempts++;
        this.pollingInterval = setTimeout(poll, this.FAST_POLLING_INTERVAL);
      } catch (error) {
        console.error("Error monitoring swap:", error);
        this.stopPolling();
        swapStatusStore.updateSwap(swapId, {
          status: "Error",
          isProcessing: false,
          error: "Failed to monitor swap status",
        });
        toastStore.error("Failed to monitor swap status");
        return;
      }
    };

    // Start polling
    poll();
  }

  private static stopPolling() {
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Clean up method to be called when component unmounts
  public static cleanup() {
    this.stopPolling();
  }
}
