/**
 * Environment utility to handle environment detection
 */

// Determine if we're running in a local development environment
export const isLocalDevelopment = (): boolean => {
  // Look for various indicators of a development environment
  const isDev = process.env.NODE_ENV === 'development';
  const isLocalHost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1'
  );
  
  return isDev || isLocalHost;
};

// Get the IC host URL based on environment
export const getIcHost = (): string => {
  if (isLocalDevelopment()) {
    return 'http://localhost:4943';
  }
  return 'https://icp0.io';
};

// Determine if the DFX environment is local or production
export const isDfxLocal = (): boolean => {
  // Custom variable that can be set in .env or build script
  if (typeof process.env.DFX_NETWORK !== 'undefined') {
    return process.env.DFX_NETWORK !== 'ic';
  }
  
  // Fallback to checking hostname
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