import { Principal } from '@dfinity/principal';

// Import canister IDs
import stagingIds from '../../../../../canister_ids.json';
import prodIds from '../../../../../canister_ids_prod.json';

export function getKongBackendPrincipal(): Principal {
  const network = process.env.DFX_NETWORK || 'local';
  
  // Use staging IDs for local/staging, prod IDs for production
  const canisterIds = network === 'ic' ? prodIds : stagingIds;
  
  const canisterId = canisterIds.kong_backend.ic;
  
  if (!canisterId) {
    throw new Error(`Kong backend canister ID not found for network: ${network}`);
  }

  return Principal.fromText(canisterId);
}
