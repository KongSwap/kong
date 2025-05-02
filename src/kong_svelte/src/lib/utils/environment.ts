/**
 * Environment utility to handle environment detection
 */

// Determine if we're running in a local development environment
export const isLocalDevelopment = (): boolean => {
  // Check for the PUBLIC_DFX_NETWORK environment variable set by Vite
  // Fallback to NODE_ENV for general development check if the specific DFX variable isn't set
  return import.meta.env.PUBLIC_DFX_NETWORK === 'local' || process.env.NODE_ENV === 'development';
};

// Get the IC host URL based on environment
export const getIcHost = (): string => {
  // Use the PUBLIC_DFX_NETWORK environment variable to determine the host
  if (import.meta.env.PUBLIC_DFX_NETWORK === 'local') {
    return 'http://localhost:4943';
  }
  // Default to mainnet if not explicitly local
  return 'https://icp0.io';
};

// Determine if the DFX environment is local or production
export const isDfxLocal = (): boolean => {
  // Use the PUBLIC_DFX_NETWORK environment variable set by Vite
  // Fallback to process.env.DFX_NETWORK if PUBLIC_DFX_NETWORK is not available (e.g., in Node.js environments)
  if (typeof import.meta.env.PUBLIC_DFX_NETWORK !== 'undefined') {
    return import.meta.env.PUBLIC_DFX_NETWORK === 'local';
  }
  if (typeof process.env.DFX_NETWORK !== 'undefined') {
    return process.env.DFX_NETWORK !== 'ic';
  }
  
  // Fallback to isLocalDevelopment if no DFX_NETWORK variable is set
  return isLocalDevelopment();
};

// Get canister ID with proper resolution for local vs production
export const resolveCanisterId = (canisterId: string, localId?: string): string => {
  // If we're in local development and a local ID is provided, use that
  if (isDfxLocal() && localId) {
    return localId;
  }
  return canisterId;
};
