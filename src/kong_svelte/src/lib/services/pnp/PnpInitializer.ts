import { Principal } from "@dfinity/principal";
import { createPNP, type PNP } from "@windoge98/plug-n-play";
import {
  idlFactory as kongBackendIDL,
  canisterId as kongBackendCanisterId,
} from "../../../../../declarations/kong_backend";
import { idlFactory as kongFaucetIDL } from "../../../../../declarations/kong_faucet";
import { ICRC2_IDL as icrc2IDL } from "$lib/idls/icrc2.idl.js";
import { idlFactory as kongDataIDL } from "../../../../../declarations/kong_data";
import { idlFactory as icpIDL } from "$lib/idls/icp.idl.js";
import { idlFactory as predictionMarketsBackendIDL, canisterId as predictionMarketsBackendCanisterId } from "../../../../../declarations/prediction_markets_backend";
import { idlFactory as trollboxIDL, canisterId as trollboxCanisterId } from "../../../../../declarations/trollbox";
export type CanisterType =
  | "kong_backend"
  | "kong_faucet"
  | "icrc1"
  | "icrc2"
  | "kong_data"
  | "xrc"
  | "prediction_markets_backend"
  | "trollbox";

export const canisterIDLs = {
  kong_backend: kongBackendIDL,
  kong_faucet: kongFaucetIDL,
  icrc1: icrc2IDL,
  icrc2: icrc2IDL,
  kong_data: kongDataIDL,
  ICP: icpIDL,
  prediction_markets_backend: predictionMarketsBackendIDL,
  trollbox: trollboxIDL,
};

let globalPnp: PNP | null = null;

export function initializePNP(): PNP {
  try {
    if (globalPnp) {
      return globalPnp;
    }

    // Convert all canister IDs to Principal, but only if they are defined
    const delegationTargets = [
      kongBackendCanisterId ? Principal.fromText(kongBackendCanisterId) : undefined,
      predictionMarketsBackendCanisterId ? Principal.fromText(predictionMarketsBackendCanisterId) : undefined,
      trollboxCanisterId ? Principal.fromText(trollboxCanisterId) : undefined
    ].filter(Boolean) as Principal[];
    
    const derivationOrigin = () => {

      let httpPrefix = "https://";
      let icp0Suffix = ".icp0.io";
      if (process.env.DFX_NETWORK === "local") {
        httpPrefix = "http://";
        icp0Suffix = ".localhost:4943";
      }

      return httpPrefix + process.env.CANISTER_ID_KONG_SVELTE + icp0Suffix;
    };

    globalPnp = createPNP({
      hostUrl:
        process.env.DFX_NETWORK === "local"
          ? "http://localhost:4943"
          : "https://icp0.io",
      isDev: process.env.DFX_NETWORK === "local",
      whitelist: [kongBackendCanisterId, predictionMarketsBackendCanisterId, trollboxCanisterId],
      fetchRootKeys: process.env.DFX_NETWORK === "local",
      timeout: 1000 * 60 * 60 * 4, // 4 hours
      verifyQuerySignatures: process.env.DFX_NETWORK !== "local", 
      identityProvider:
        process.env.DFX_NETWORK !== "local"
          ? "https://identity.ic0.app"
          : "http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943",
      persistSession: true,
      derivationOrigin: derivationOrigin(),
      delegationTimeout: BigInt(86400000000000), // 30 days
      delegationTargets,
    });

    return globalPnp;
  } catch (error) {
    console.error("Error initializing PNP:", error);
    throw error;
  }
}

export function getPnpInstance(): PNP {
  if (!globalPnp) {
    return initializePNP();
  }
  return globalPnp;
}

export const pnp = getPnpInstance();
