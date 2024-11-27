import { Principal } from "@dfinity/principal";
import { createPNP, type PNP } from "@windoge98/plug-n-play";
import {
  idlFactory as kongBackendIDL,
  canisterId as kongBackendCanisterId,
} from "../../../../../declarations/kong_backend";
import { idlFactory as kongFaucetIDL } from "../../../../../declarations/kong_faucet";
import { idlFactory as icrc1idl } from "../../../../../declarations/ckbtc_ledger";
import { idlFactory as icrc2idl } from "../../../../../declarations/ckusdt_ledger";

export type CanisterType = "kong_backend" | "kong_faucet" | "icrc1" | "icrc2";
export const canisterIDLs = {
  kong_backend: kongBackendIDL,
  kong_faucet: kongFaucetIDL,
  icrc1: icrc1idl,
  icrc2: icrc2idl,
};

let globalPnp: PNP | null = null;

export function initializePNP(principals?: Principal[]): PNP {
  try {
    if (globalPnp) {
      return globalPnp;
    }

    // Convert all canister IDs to Principal
    const delegationTargets = [
      kongBackendCanisterId,
    ].map(id => Principal.fromText(id));

    if (principals) {
      delegationTargets.push(...principals);
    }

    globalPnp = createPNP({
      hostUrl: process.env.DFX_NETWORK !== "ic" ? "http://localhost:4943" : "https://icp0.io",
      isDev: process.env.DFX_NETWORK !== "ic",
      whitelist: [kongBackendCanisterId],
      fetchRootKeys: process.env.DFX_NETWORK !== "ic",
      timeout: 1000 * 60 * 60 * 24, // 1 hour timeout for requests
      verifyQuerySignatures: process.env.DFX_NETWORK === "ic",
      identityProvider: process.env.DFX_NETWORK !== "ic" ? "http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943" : "https://identity.ic0.app",
      persistSession: true,
      delegationTimeout: BigInt(Date.now()) + BigInt(1000 * 60 * 60 * 24 * 30), // 24 hour delegation timeout
      delegationTargets,
    });

    return globalPnp;
  } catch (error) {
    console.error('Error initializing PNP:', error);
    throw error;
  }
}

export function getPnpInstance(): PNP {
  if (!globalPnp) {
    return initializePNP();
  }
  return globalPnp;
}
