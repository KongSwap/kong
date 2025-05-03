import type { PNPConfig } from '@windoge98/plug-n-play';
import { createPNP, type PNP } from "@windoge98/plug-n-play";

// Canister Imports
import { idlFactory as kongFaucetIDL } from "../../../../declarations/kong_faucet";
import { idlFactory as kongDataIDL } from "../../../../declarations/kong_data";
import { ICRC2_IDL as icrc2IDL } from "$lib/idls/icrc2.idl.js";
import { idlFactory as icpIDL } from "$lib/idls/icp.idl.js";
import {
  canisterId as predictionMarketsBackendCanisterId,
  idlFactory as predictionMarketsBackendIDL,
} from "../../../../declarations/prediction_markets_backend";
import {
  canisterId as kongBackendCanisterId,
  idlFactory as kongBackendIDL,
} from "../../../../declarations/kong_backend";
import {
  canisterId as trollboxCanisterId,
  idlFactory as trollboxIDL,
} from "../../../../declarations/trollbox";
import {
  canisterId as siwsProviderCanisterId,
} from "../../../../declarations/ic_siws_provider";
import {
  idlFactory as launchpadIDL,
} from "../../../../declarations/launchpad";
import {
  idlFactory as minerIDL,
} from "../../../../declarations/miner"; // Added miner IDL import

// --- Types ---
export type CanisterType =
  | "kong_backend"
  | "kong_faucet"
  | "icrc1"
  | "icrc2"
  | "kong_data"
  | "xrc" // Assuming 'xrc' might be used elsewhere, keeping it. ICP IDL is imported.
  | "prediction_markets_backend"
  | "trollbox"
  | "launchpad" // Added launchpad type
  | "miner"; // Added miner type

// --- Canister IDLs ---
export const canisterIDLs = {
  kong_backend: kongBackendIDL,
  kong_faucet: kongFaucetIDL,
  icrc1: icrc2IDL,
  icrc2: icrc2IDL,
  kong_data: kongDataIDL,
  ICP: icpIDL,
  prediction_markets_backend: predictionMarketsBackendIDL,
  trollbox: trollboxIDL,
  launchpad: launchpadIDL, // Added launchpad IDL
  miner: minerIDL, // Added miner IDL
};

// --- PNP Initialization ---
let globalPnp: PNP | null = null;

const delegationTargets = [
  kongBackendCanisterId,
  predictionMarketsBackendCanisterId,
  trollboxCanisterId
]

export function initializePNP(): PNP {
  if (globalPnp) {
    return globalPnp;
  }
  try {
    const isDev = process.env.DFX_NETWORK === "local";
    const kongSvelteCanisterId = process.env.CANISTER_ID_KONG_SVELTE;

    globalPnp = createPNP({
      dfxNetwork: isDev ? "local" : "ic",
      hostUrl: isDev ? "http://localhost:4943" : "https://icp0.io",
      fetchRootKeys: isDev,
      verifyQuerySignatures: !isDev,
      derivationOrigin: (() => {
        if (isDev) {
          return undefined; // Let createPNP handle local derivation (uses window.location by default)
        } else {
          if (!kongSvelteCanisterId) {
            console.warn(
              "CANISTER_ID_KONG_SVELTE is not set for production derivation origin."
            );
            return undefined;
          }
          return `https://${kongSvelteCanisterId}.icp0.io`;
        }
      })(),
      delegationTimeout: BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000), // 30 days
      delegationTargets,
      siwsProviderCanisterId,
      adapters: {
        ii: {
          enabled: true,
          identityProvider: isDev
            ? "http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943"
            : "https://identity.ic0.app",
        },
        plug: {
          enabled: true,
        },
        nfid: {
          enabled: true,
          rpcUrl: "https://nfid.one/rpc",
        },
        oisy: {
          enabled: true,
          signerUrl: "https://oisy.com/sign",
        },
        phantomSiws: {
          enabled: true,
        },
        solflareSiws: {
          enabled: true,
        }
      },
      localStorageKey: "kongSwapPnpState",
    } as PNPConfig);

    return globalPnp;
  } catch (error) {
    console.error("Error initializing PNP:", error);
    throw error;
  }
}

export function getPnpInstance(): PNP {
  // Ensures initialization happens if called before explicit initialization
  if (!globalPnp) {
    return initializePNP();
  }
  return globalPnp;
}

// --- Exported PNP Instance ---
export const pnp = getPnpInstance();
