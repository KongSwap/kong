import type { GlobalPnpConfig } from "@windoge98/plug-n-play";
import { createPNP, type PNP } from "@windoge98/plug-n-play";

// Canister Imports
import {
  idlFactory as kongFaucetIDL,
  canisterId as kongFaucetCanisterId,
} from "../../../../declarations/kong_faucet";
import type { _SERVICE as _KONG_FAUCET_SERVICE } from "../../../../declarations/kong_faucet/kong_faucet.did.d.ts";
import {
  idlFactory as kongDataIDL,
  canisterId as kongDataCanisterId,
} from "../../../../declarations/kong_data";
import type { _SERVICE as _KONG_DATA_SERVICE } from "../../../../declarations/kong_data/kong_data.did.d.ts";
import { canisterId as predictionMarketsBackendCanisterId } from "../../../../declarations/prediction_markets_backend";
import { idlFactory as predictionMarketsBackendIDL } from "../../../../declarations/prediction_markets_backend";
import type { _SERVICE as _PREDICTION_MARKETS_BACKEND_SERVICE } from "../../../../declarations/prediction_markets_backend/prediction_markets_backend.did.d.ts";
import { canisterId as predictionMarketsBackendLegacyCanisterId } from "../../../../declarations/prediction_markets_backend_legacy";
import { idlFactory as predictionMarketsBackendLegacyIDL } from "../../../../declarations/prediction_markets_backend_legacy";
import type { _SERVICE as _PREDICTION_MARKETS_BACKEND_SERVICE_LEGACY } from "../../../../declarations/prediction_markets_backend_legacy/prediction_markets_backend.did.d.ts";
import {
  canisterId as kongBackendCanisterId,
  idlFactory as kongBackendIDL,
} from "../../../../declarations/kong_backend";
import type { _SERVICE as _KONG_SERVICE } from "../../../../declarations/kong_backend/kong_backend.did.d.ts";
import {
  canisterId as trollboxCanisterId,
  idlFactory as trollboxIDL,
} from "../../../../declarations/trollbox";
import type { _SERVICE as _TROLLBOX_SERVICE } from "../../../../declarations/trollbox/trollbox.did.d.ts";
import {
  canisterId as commentsCanisterId,
  idlFactory as commentsIDL,
} from "../../../../declarations/comments";
import type { _SERVICE as _COMMENTS_SERVICE } from "../../../../declarations/comments/comments.did.d.ts";
import { canisterId as siwsProviderCanisterId } from "../../../../declarations/ic_siws_provider";
import { canisterId as icpCanisterId } from "../../../../declarations/icp_ledger";
import { idlFactory as icrc2IDL } from "../../../../declarations/kong_ledger/kong_ledger.did.js";
import type { _SERVICE as _ICRC2_SERVICE } from "../../../../declarations/kong_ledger/kong_ledger.did.d.ts";
import { idlFactory as icpIDL } from "../../../../declarations/icp_ledger/icp_ledger.did.js";
import type { _SERVICE as _ICP_SERVICE } from "../../../../declarations/icp_ledger/icp_ledger.did.d.ts";
import { IDL } from "@dfinity/candid";
import { signatureModalStore } from "$lib/stores/signatureModalStore";

// Consolidated canister types
export type CanisterType = {
  KONG_BACKEND: _KONG_SERVICE;
  KONG_FAUCET: _KONG_FAUCET_SERVICE;
  KONG_DATA: _KONG_DATA_SERVICE;
  ICP_LEDGER: _ICP_SERVICE;
  ICRC2_LEDGER: _ICRC2_SERVICE;
  PREDICTION_MARKETS: _PREDICTION_MARKETS_BACKEND_SERVICE;
  PREDICTION_MARKETS_LEGACY: _PREDICTION_MARKETS_BACKEND_SERVICE_LEGACY;
  TROLLBOX: _TROLLBOX_SERVICE;
  COMMENTS: _COMMENTS_SERVICE;
};

export type CanisterConfigs = {
  [key: string]: {
    canisterId?: string;
    idl: IDL.InterfaceFactory;
    type?: any;
  };
};

export const canisters: CanisterConfigs = {
  kongBackend: {
    canisterId: kongBackendCanisterId,
    idl: kongBackendIDL,
    type: {} as CanisterType["KONG_BACKEND"],
  },
  kongFaucet: {
    canisterId: kongFaucetCanisterId,
    idl: kongFaucetIDL,
    type: {} as CanisterType["KONG_FAUCET"],
  },
  kongData: {
    canisterId: kongDataCanisterId,
    idl: kongDataIDL,
    type: {} as CanisterType["KONG_DATA"],
  },
  predictionMarkets: {
    canisterId: predictionMarketsBackendCanisterId,
    idl: predictionMarketsBackendIDL,
    type: {} as CanisterType["PREDICTION_MARKETS"],
  },
  predictionMarketsLegacy: {
    canisterId: process.env.CANISTER_ID_PREDICTION_MARKETS_BACKEND_LEGACY,
    idl: predictionMarketsBackendLegacyIDL,
    type: {} as CanisterType["PREDICTION_MARKETS_LEGACY"],
  },
  trollbox: {
    canisterId: trollboxCanisterId,
    idl: trollboxIDL,
    type: {} as CanisterType["TROLLBOX"],
  },
  comments: {
    canisterId: commentsCanisterId,
    idl: commentsIDL,
    type: {} as CanisterType["COMMENTS"],
  },
  icp: {
    canisterId: icpCanisterId,
    idl: icpIDL,
    type: {} as CanisterType["ICP_LEDGER"],
  },
  icrc1: {
    idl: icrc2IDL,
    type: {} as CanisterType["ICRC2_LEDGER"],
  },
  icrc2: {
    idl: icrc2IDL,
    type: {} as CanisterType["ICRC2_LEDGER"],
  },
};

// --- PNP Initialization ---
let globalPnp: PNP | null = null;
const isDev = process.env.DFX_NETWORK === "local";
const frontendCanisterId = "3ldz4-aiaaa-aaaar-qaina-cai";

const delegationTargets = [
  kongBackendCanisterId,
  predictionMarketsBackendCanisterId,
  trollboxCanisterId,
  kongDataCanisterId,
  predictionMarketsBackendLegacyCanisterId,
  commentsCanisterId,
].filter(Boolean);

// Function to show signature modal
function showSignatureModal(message: string, onSignatureComplete?: () => void) {
  signatureModalStore.show(message, onSignatureComplete);
}

// Function to hide signature modal
function hideSignatureModal() {
  signatureModalStore.hide();
}

export function initializePNP(): PNP {
  if (globalPnp) {
    return globalPnp;
  }
  try {
    // Create a stable configuration object
    const config = {
      dfxNetwork: process.env.DFX_NETWORK,
      replicaPort: 4943, // Replica port for local development
      frontendCanisterId,
      timeout: BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000), // 30 days
      delegationTimeout: BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000), // 30 days
      delegationTargets,
      derivationOrigin: "https://3ldz4-aiaaa-aaaar-qaina-cai.icp0.io",
      siwsProviderCanisterId,
      adapters: {
        ii: {
          enabled: true,
          localIdentityCanisterId: "rdmx6-jaaaa-aaaaa-aaadq-cai",
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
        },
        backpackSiws: {
          enabled: true,
        },
        walletconnectSiws: {
          enabled: true,
          projectId: "77b77ffe1132244fe4a3ce38f01885d7",
          appName: "KongSwap",
          appDescription: "Next gen multi-chain DeFi",
          appUrl: "https://kongswap.io",
          appIcons: ["https://kongswap.io/images/kong_logo.png"],
          onSignatureRequired: (message: string) => {
            if (typeof window !== "undefined") {
              showSignatureModal(message);
            }
          },
          onSignatureComplete: () => {
            if (typeof window !== "undefined") {
              hideSignatureModal();
            }
          },
        },
      },
      localStorageKey: "kongSwapPnpState",
    } as GlobalPnpConfig;

    // Initialize PNP with the stable config
    globalPnp = createPNP(config);

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
