import { get } from 'svelte/store';
import { currentUserBalancesStore } from '$lib/stores/balancesStore';
import { refreshBalances } from '$lib/stores/balancesStore';
import { userTokens } from '$lib/stores/userTokens';
import { fetchTokensByCanisterId } from '$lib/api/tokens';
import type { Principal } from '@dfinity/principal';

export function useBalanceCheck() {
  let insufficientFunds = $state(false);

  async function getTokenDecimals(address: string): Promise<number> {
    const tokens = get(userTokens);
    const token =
      tokens.tokens.find((t) => t.address === address) ||
      (await fetchTokensByCanisterId([address]))[0];
    return token?.decimals || 0;
  }

  async function checkBalance(
    authOwner: Principal | undefined,
    payToken: Kong.Token | null,
    payAmount: string
  ): Promise<boolean> {
    if (!authOwner || !payToken?.address || !payAmount || payAmount === "0") {
      insufficientFunds = false;
      return false;
    }

    const balances = get(currentUserBalancesStore);
    const balanceData = balances?.[payToken.address];
    
    if (!balanceData) {
      // Refresh balances if we don't have data
      refreshBalances([payToken], authOwner.toString(), true);
      insufficientFunds = false;
      return false;
    }

    try {
      const payAmountNum = parseFloat(payAmount);
      const balanceBigInt = balanceData.in_tokens;
      const decimals = await getTokenDecimals(payToken.address);
      const divisor = Math.pow(10, Number(decimals) || 8);
      const balanceAsNumber = Number(balanceBigInt) / divisor;

      insufficientFunds = payAmountNum > balanceAsNumber;
      return insufficientFunds;
    } catch (error) {
      console.error("Error calculating balance:", error);
      insufficientFunds = false;
      return false;
    }
  }

  return {
    insufficientFunds: () => insufficientFunds,
    checkBalance,
    getTokenDecimals
  };
} 