import { Principal } from "@dfinity/principal";
import { AccountIdentifier } from "@dfinity/ledger-icp";
import { convertToSubaccount } from "./balanceUtils";

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

export function getPrincipalString(principal: string | Principal): string {
  return typeof principal === "string" ? principal : principal?.toText?.() || "";
} 