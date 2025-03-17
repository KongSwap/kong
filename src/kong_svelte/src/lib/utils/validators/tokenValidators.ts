import BigNumber from "bignumber.js";
import { Principal } from "@dfinity/principal";

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
  if (!value) return { isValid: false, errorMessage: "Amount is required" };
  
  const numValue = parseFloat(value);
  if (isNaN(numValue) || numValue <= 0) {
    return { isValid: false, errorMessage: "Amount must be greater than 0" };
  }

  const maxAmount = calculateMaxAmount(balance, tokenDecimals, tokenFee);
  if (numValue > maxAmount) {
    return { isValid: false, errorMessage: "Insufficient balance for transfer + fee" };
  }

  return { isValid: true, errorMessage: "" };
}

export function isValidHex(str: string): boolean {
  const hexRegex = /^[0-9a-fA-F]+$/;
  return hexRegex.test(str);
}

export function detectAddressType(address: string): "principal" | "account" | null {
  if (!address) return null;

  // Check for Account ID (64 character hex string)
  if (address.length === 64 && isValidHex(address)) {
    return "account";
  }

  // Check for Principal ID
  try {
    Principal.fromText(address);
    return "principal";
  } catch {
    return null;
  }
}

export function validateAddress(
  address: string,
  tokenSymbol: string,
  tokenName: string
): { isValid: boolean; errorMessage: string; addressType: "principal" | "account" | null } {
  if (!address) {
    return { isValid: false, errorMessage: "Address is required", addressType: null };
  }

  const cleanAddress = address.trim();

  if (cleanAddress.length === 0) {
    return { isValid: false, errorMessage: "Address cannot be empty", addressType: null };
  }

  const addressType = detectAddressType(cleanAddress);

  if (addressType === "account" && tokenSymbol !== "ICP") {
    return { 
      isValid: false, 
      errorMessage: `Account ID can't be used with ${tokenName}`, 
      addressType 
    };
  }

  if (addressType === null) {
    return { isValid: false, errorMessage: "Invalid address format", addressType: null };
  }

  return { isValid: true, errorMessage: "", addressType };
}

export function formatTokenInput(
  value: string, 
  tokenDecimals: number
): string {
  let formattedValue = value.replace(/[^0-9.]/g, "");

  const parts = formattedValue.split(".");
  if (parts.length > 2) {
    formattedValue = `${parts[0]}.${parts[1]}`;
  }

  if (parts[1]?.length > tokenDecimals) {
    formattedValue = `${parts[0]}.${parts[1].slice(0, tokenDecimals)}`;
  }

  return formattedValue;
}

export function getInitialBalances(tokenSymbol: string): TokenBalances {
  return tokenSymbol === "ICP"
    ? { default: BigInt(0), subaccount: BigInt(0) }
    : { default: BigInt(0) };
} 