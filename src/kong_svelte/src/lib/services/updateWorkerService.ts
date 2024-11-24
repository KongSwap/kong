import { browser } from "$app/environment";
import { tokenStore } from "./tokens/tokenStore";
import { poolStore } from "./pools/poolStore";
import { get } from "svelte/store";
import { auth } from "./auth";
import * as Comlink from "comlink";
import { swapActivityStore } from "$lib/stores/swapActivityStore";
import { formatTokenAmount, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

class UpdateWorkerService {
  private worker: Worker | null = null;
  private workerApi: any = null;
  private isInitialized = false;

  initialize() {
    if (!browser || this.isInitialized) return;

    try {
      this.worker = new Worker(
        new URL("../workers/updateWorker.ts", import.meta.url),
        { type: "module" },
      );

      // Create proxy to worker
      this.workerApi = Comlink.wrap(this.worker);
      this.isInitialized = true;

      // Create instance of worker class
      this.startUpdates();
    } catch (error) {
      console.error("Failed to initialize update worker:", error);
    }
  }

  private async startUpdates() {
    if (!this.workerApi) return;

    const instance = await new this.workerApi();

    // Create callback proxies
    const callbacks = Comlink.proxy({
      onTokenUpdate: async () => {
        const wallet = get(auth);
        const walletId = wallet?.account?.owner?.toString();
        if (walletId) {
          Promise.all([
            tokenStore.loadBalances(walletId),
          ]);
        }
      },
      onPoolUpdate: async () => {
        await poolStore.loadPools(true);
        const wallet = get(auth);
        const walletId = wallet?.account?.owner?.toString();
        if (walletId) {
          Promise.all([
            poolStore.loadPools(),
            poolStore.loadUserPoolBalances(),
          ]);
        }
      },
      onSwapActivityUpdate: async () => {
        try {
          const response = await fetch('http://18.170.224.113:8080/api/dexscreener_swap');
          const data = await response.json();
          
          // Add each new swap to the store
          if (Array.isArray(data)) {
            const swaps = get(swapActivityStore);
            const uniqueSwaps = data.filter(swap => 
              !swaps.some(existingSwap => existingSwap.txnId === swap.txnId)
            );
            
            if (uniqueSwaps.length > 0) {
              uniqueSwaps.forEach(swap => {
                swapActivityStore.addSwap(swap);
              });
            }
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            // Ignore abort errors
            return;
          }
          console.error('Error fetching swap data:', error);
        }
      },
      onPriceUpdate: async () => {
        try {
          const currentStore = get(tokenStore);
          if (!currentStore.tokens) return;

          const prices = await tokenStore.loadPrices();
          if (prices) {
            // After prices are loaded, update USD values in balances
            const balances = { ...currentStore.balances };
            for (const token of currentStore.tokens) {
              if (balances[token.canister_id]) {
                const price = prices[token.canister_id] || 0;
                const balance = balances[token.canister_id].in_tokens;
                const amount = parseFloat(formatTokenAmount(balance.toString(), token.decimals));
                balances[token.canister_id].in_usd = formatToNonZeroDecimal(amount * price);
              }
            }

            // Update the store with new balances that include updated USD values
            tokenStore.update(s => ({
              ...s,
              balances,
              prices
            }));
          }
        } catch (error) {
          console.error('Error updating prices:', error);
        }
      }
    });

    // Start updates with callbacks
    await instance.startUpdates(callbacks);
  }

  async destroy() {
    if (this.workerApi) {
      const instance = await new this.workerApi();
      await instance.stopUpdates();
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerApi = null;
      this.isInitialized = false;
    }
  }
}

export const updateWorkerService = new UpdateWorkerService();
