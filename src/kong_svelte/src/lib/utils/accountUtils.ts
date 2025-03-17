import { Principal } from "@dfinity/principal";
import { AccountIdentifier, SubAccount } from "@dfinity/ledger-icp";

export interface AccountIds {
  subaccount: string;
  main: string;
}

export function getAccountIds(
  principalStr: string,
  rawSubaccount: any
): AccountIds {
  try {
    const principal = Principal.fromText(principalStr);

    // Create account ID with provided subaccount
    const subAccount = convertToSubaccount(rawSubaccount);
    const subaccountId = AccountIdentifier.fromPrincipal({
      principal,
      subAccount,
    }).toHex();

    // Create account ID with main (zero) subaccount
    const mainAccountId = AccountIdentifier.fromPrincipal({
      principal,
      subAccount: undefined,
    }).toHex();

    return {
      subaccount: subaccountId,
      main: mainAccountId,
    };
  } catch (error) {
    console.error("Error creating account identifier:", error);
    return {
      subaccount: "",
      main: "",
    };
  }
}

function convertToSubaccount(raw: any): SubAccount | undefined {
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


export function getPrincipalString(principal: string | Principal): string {
  return typeof principal === "string" ? principal : principal?.toText?.() || "";
} 