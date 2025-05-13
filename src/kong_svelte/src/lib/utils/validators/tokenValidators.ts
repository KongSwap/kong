import BigNumber from "bignumber.js";
import { decodeIcrcAccount } from "@dfinity/ledger-icrc";

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

export function detectAddressType(address: string): "principal" | "account" | "icrc1" | null {
  if (!address) return null;

  try {
    const decoded = decodeIcrcAccount(address);
    // If subaccount exists or checksum included, it's explicitly ICRC1 format
    if (decoded.subaccount || address.includes('-')) {
        return "icrc1";
    }
    // Otherwise, it successfully decoded as a Principal
    return "principal"; 
  } catch {
    // Ignore decoding error, try legacy account ID
  }

  // Check for legacy ICP Account ID (64 character hex string)
  if (address.length === 64 && isValidHex(address)) {
    return "account";
  }

  return null; // Failed all checks
}

export function validateAddress(
  address: string,
  tokenSymbol: string,
  tokenName: string
): { isValid: boolean; errorMessage: string; addressType: "principal" | "account" | "icrc1" | null } {
  if (!address) {
    return { isValid: false, errorMessage: "Address is required", addressType: null };
  }

  const cleanAddress = address.trim();

  if (cleanAddress.length === 0) {
    return { isValid: false, errorMessage: "Address cannot be empty", addressType: null };
  }

  // Try decoding using ICRC standard first
  try {
    decodeIcrcAccount(cleanAddress);
    // If decode succeeds, it's a valid Principal or ICRC1 account format
    // We still need detectAddressType for specific UI feedback and ICP account restriction
    const addressType = detectAddressType(cleanAddress);
    if (addressType === "account" && tokenSymbol !== "ICP") {
      // This case should technically not be hit if decodeIcrcAccount succeeded
      // but kept for robustness and explicit ICP Account ID handling.
      return { 
         isValid: false, 
         errorMessage: `Ledger Account ID can only be used for ICP transfers. Use the Principal ID or ICRC1 Account format for ${tokenName}.`, 
         addressType 
       };
    }
    // If decode succeeded and it's not a wrongly used Account ID, it's valid.
    return { isValid: true, errorMessage: "", addressType };
  } catch (e) {
    // If decodeIcrcAccount failed, check if it's a legacy ICP account ID
    if (tokenSymbol === "ICP" && cleanAddress.length === 64 && isValidHex(cleanAddress)) {
      return { isValid: true, errorMessage: "", addressType: "account" };
    }
    // If it failed decoding and isn't a valid ICP account ID, it's invalid
    return { isValid: false, errorMessage: "Invalid address format", addressType: null };
  }
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
