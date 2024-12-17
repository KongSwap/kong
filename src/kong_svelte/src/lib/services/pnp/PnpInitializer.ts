import { Principal } from "@dfinity/principal";
import { createPNP, type PNP } from "@windoge98/plug-n-play";
import {
  idlFactory as kongBackendIDL,
  canisterId as kongBackendCanisterId,
} from "../../../../../declarations/kong_backend";
import { idlFactory as kongFaucetIDL } from "../../../../../declarations/kong_faucet";
import { idlFactory as icrc1idl } from "../../../../../declarations/ckbtc_ledger";
import { idlFactory as icrc2idl } from "../../../../../declarations/ckusdt_ledger";
import { 
  idlFactory as kongDataIDL,
  canisterId as kongDataCanisterId,
} from "../../../../../declarations/kong_data";

export type CanisterType = "kong_backend" | "kong_faucet" | "icrc1" | "icrc2" | "kong_data" | "xrc";
export const canisterIDLs = {
  kong_backend: kongBackendIDL,
  kong_faucet: kongFaucetIDL,
  icrc1: icrc1idl,
  icrc2: icrc2idl,
  kong_data: kongDataIDL,
};

let globalPnp: PNP | null = null;

export function initializePNP(): PNP {
  try {
    if (globalPnp) {
      return globalPnp;
    }

    // Convert all canister IDs to Principal, but only if they are defined
    const delegationTargets = [
      Principal.fromText(kongBackendCanisterId),
    ]

    const isDev = import.meta.env.DEV;
    const derivationOrigin = () => {
      if (process.env.DFX_NETWORK === "local" || isDev) {
        return "http://localhost:5173";
      } else if (process.env.DFX_NETWORK === "staging") {
        return null;
      }
      return "https://" + process.env.CANISTER_ID_KONG_SVELTE + ".icp0.io";
    }

    globalPnp = createPNP({
      hostUrl: process.env.DFX_NETWORK === "local" ? "http://localhost:4943" : "https://icp0.io",
      isDev: process.env.DFX_NETWORK === "local",
      whitelist: [kongBackendCanisterId],
      fetchRootKeys: process.env.DFX_NETWORK === "local",
      timeout: 1000 * 60 * 60 * 4, // 4 hours
      verifyQuerySignatures: process.env.DFX_NETWORK !== "local",
      identityProvider: process.env.DFX_NETWORK !== "local" ? "https://identity.ic0.app" : "http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943",
      persistSession: true,
      derivationOrigin: derivationOrigin(),
      delegationTimeout: BigInt(86400000000000), // 30 days
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
