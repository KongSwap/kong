import { BigNumber } from "bignumber.js";
import { liquidityStore } from "$lib/services/liquidity/liquidityStore";

interface PoolAmounts {
  amount0: string;
  amount1: string;
  displayValue0: string;
  displayValue1: string;
}

export function calculatePoolAmounts(
  firstAmount: string,
  initialPrice: string,
  displayValue0: string,
  displayValue1: string
): PoolAmounts {
  if (!firstAmount || !initialPrice) {
    return {
      amount0: firstAmount,
      amount1: "0",
      displayValue0,
      displayValue1: "0"
    };
  }
  
  const price = new BigNumber(initialPrice);
  if (price.isZero()) {
    return {
      amount0: firstAmount,
      amount1: "0",
      displayValue0,
      displayValue1: "0"
    };
  }
  
  const cleanAmount0 = firstAmount.replace(/[,_]/g, "");
  const amount1 = price.times(cleanAmount0).toString();

  return {
    amount0: firstAmount,
    amount1,
    displayValue0,
    displayValue1: amount1
  };
}

export function handleInitialPriceInput(
  event: Event & { currentTarget: EventTarget & HTMLInputElement },
  amount0: string,
  displayValue0: string,
  displayValue1: string
): PoolAmounts | null {
  const value = event.currentTarget.value;
  if (!value || isNaN(parseFloat(value))) return null;
  
  liquidityStore.setInitialPrice(value);
  return calculatePoolAmounts(amount0, value, displayValue0, displayValue1);
} 