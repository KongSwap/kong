import BigNumber from "bignumber.js";

export function calculateMaxAmount(
  balance: bigint,
  tokenDecimals: number,
  tokenFee: bigint = BigInt(10000)
): number {
  return new BigNumber(balance.toString())
    .dividedBy(new BigNumber(10).pow(tokenDecimals))
    .minus(
      new BigNumber(tokenFee.toString()).dividedBy(
        new BigNumber(10).pow(tokenDecimals)
      )
    )
    .toNumber();
}

export function validateTokenAmount(
  value: string,
  balance: bigint,
  tokenDecimals: number,
  tokenFee: bigint = BigInt(10000)
): { isValid: boolean; errorMessage: string } {
  if (!value) return { isValid: false, errorMessage: "" };
  
  const numValue = parseFloat(value);
  if (isNaN(numValue) || numValue <= 0) {
    return { isValid: false, errorMessage: "Amount must be greater than 0" };
  }

  const maxAmount = calculateMaxAmount(balance, tokenDecimals, tokenFee);
  if (numValue > maxAmount) {
    return { isValid: false, errorMessage: "Insufficient balance" };
  }

  return { isValid: true, errorMessage: "" };
}

export function formatTokenInput(value: string, decimals: number): string {
  let formattedValue = value.replace(/[^0-9.]/g, "");
  const parts = formattedValue.split(".");
  
  if (parts.length > 2) {
    formattedValue = `${parts[0]}.${parts[1]}`;
  }

  if (parts[1]?.length > decimals) {
    formattedValue = `${parts[0]}.${parts[1].slice(0, decimals)}`;
  }

  return formattedValue;
}

export function convertToTokenAmount(amount: string, decimals: number): bigint {
  return BigInt(Math.floor(Number(amount) * 10 ** decimals).toString());
}

export interface TokenBalances {
  default: bigint;
  subaccount?: bigint;
}

export function getInitialBalances(tokenSymbol: string): TokenBalances {
  return tokenSymbol === "ICP"
    ? { default: BigInt(0), subaccount: BigInt(0) }
    : { default: BigInt(0) };
} 