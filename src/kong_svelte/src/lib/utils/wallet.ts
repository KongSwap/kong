import type { PNP } from "@windoge98/plug-n-play";

/**
 * Extracts the identity from a Plug-n-Play wallet instance
 * 
 * @param pnp The Plug-n-Play wallet instance
 * @returns The user's identity or null if not connected
 */
export function getWalletIdentity(pnp: PNP): any {
  if (!pnp || !pnp.isWalletConnected()) {
    console.warn('Wallet not connected when trying to get identity');
    return null;
  }

  try {
    if (pnp.account && pnp.account.owner) {
      return pnp.account.owner;
    }
    console.warn('No account owner found in PNP instance');
    return null;
  } catch (error) {
    console.error('Error getting wallet identity:', error);
    return null;
  }
}

/**
 * Checks if a wallet is properly connected and has an identity
 * 
 * @param pnp The Plug-n-Play wallet instance
 * @returns True if wallet is connected with a valid identity
 */
export function isWalletConnected(pnp: PNP): boolean {
  if (!pnp) return false;
  
  try {
    return pnp.isWalletConnected() && !!pnp.account?.owner;
  } catch (error) {
    console.error('Error checking wallet connection:', error);
    return false;
  }
}

/**
 * Gets the principal ID from a connected wallet
 * 
 * @param pnp The Plug-n-Play wallet instance
 * @returns The Principal ID as a string, or null if unavailable
 */
export function getWalletPrincipal(pnp: PNP): string | null {
  if (!isWalletConnected(pnp)) return null;
  
  try {
    const identity = pnp.account?.owner;
    return identity?.toString() || null;
  } catch (error) {
    console.error('Error getting wallet principal:', error);
    return null;
  }
} 
