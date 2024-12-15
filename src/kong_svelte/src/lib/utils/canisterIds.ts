import { Principal } from '@dfinity/principal';

// Import canister IDs
import canisters from '../../../../../canister_ids.all.json';

export function getKongBackendPrincipal(): Principal {
  const network = process.env.DFX_NETWORK || 'local';
  
  // Use staging IDs for local/staging, prod IDs for production
  const canisterIds = canisters;
  
  const canisterId = canisterIds.kong_backend[network];
  
  if (!canisterId) {
    throw new Error(`Kong backend canister ID not found for network: ${network}`);
  }

  return Principal.fromText(canisterId);
}
