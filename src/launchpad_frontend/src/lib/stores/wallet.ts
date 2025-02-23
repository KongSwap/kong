// Re-export core functionality from auth.ts
export {
  auth,
  backendActor,
  selectedWalletId,
  ledgerActor,
} from '../services/auth';

// Re-export the isConnected derived store
import { derived } from 'svelte/store';
import { auth } from '../services/auth';

export const isConnected = derived(auth, $auth => $auth.isConnected); 

export function formatICP(e8s: bigint): string {
  const icp = Number(e8s) / 100_000_000;
  return icp.toLocaleString(undefined, { 
    minimumFractionDigits: 8, 
    maximumFractionDigits: 8 
  });
}
