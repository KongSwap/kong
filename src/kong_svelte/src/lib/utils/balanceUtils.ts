import { Principal } from "@dfinity/principal";
import { AccountIdentifier, SubAccount } from "@dfinity/ledger-icp";

export function isValidHex(str: string): boolean {
  const hexRegex = /^[0-9a-fA-F]+$/;
  return hexRegex.test(str);
}

export function detectAddressType(address: string): "principal" | "account" | null {
  if (!address) return null;

  if (address.length === 64 && isValidHex(address)) {
    return "account";
  }

  try {
    Principal.fromText(address);
    return "principal";
  } catch {
    return null;
  }
}

export function validateAddress(address: string): { isValid: boolean; errorMessage: string } {
  if (!address) return { isValid: false, errorMessage: "Address cannot be empty" };

  const cleanAddress = address.trim();
  const addressType = detectAddressType(cleanAddress);

  if (addressType === null) {
    return { isValid: false, errorMessage: "Invalid address format" };
  }

  if (addressType === "account") {
    if (cleanAddress.length !== 64 || !isValidHex(cleanAddress)) {
      return { isValid: false, errorMessage: "Invalid Account ID format" };
    }
    return { isValid: true, errorMessage: "" };
  }

  try {
    const principal = Principal.fromText(cleanAddress);
    if (principal.isAnonymous()) {
      return { isValid: false, errorMessage: "Cannot send to anonymous principal" };
    }
  } catch {
    return { isValid: false, errorMessage: "Invalid Principal ID format" };
  }

  return { isValid: true, errorMessage: "" };
}

export function convertToSubaccount(raw: any): SubAccount | undefined {
  try {
    if (!raw) return undefined;

    if (raw instanceof SubAccount) return raw;

    let bytes: Uint8Array;
    if (raw instanceof Uint8Array) {
      bytes = raw;
    } else if (Array.isArray(raw)) {
      bytes = new Uint8Array(raw);
    } else if (typeof raw === "number") {
      bytes = new Uint8Array(32).fill(0);
      bytes[31] = raw;
    } else {
      return undefined;
    }

    if (bytes.length !== 32) {
      const paddedBytes = new Uint8Array(32).fill(0);
      paddedBytes.set(bytes.slice(0, 32));
      bytes = paddedBytes;
    }

    const subAccountResult = SubAccount.fromBytes(bytes);
    if (subAccountResult instanceof Error) {
      throw subAccountResult;
    }
    return subAccountResult;
  } catch (error) {
    console.error("Error converting subaccount:", error);
    return undefined;
  }
} 