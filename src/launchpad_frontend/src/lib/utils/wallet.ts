import type { PNP } from "@windoge98/plug-n-play";

// Helper to get identity from different wallet types
export function getWalletIdentity(pnp: PNP) {
  if (!pnp) return null;
  
  // For Plug
  if (pnp.identity) {
    return pnp.identity;
  }
  
  // For OISY
  if (pnp.activeWallet?.signerAgent?.getIdentity()) {
    return pnp.activeWallet.signerAgent.getIdentity();
  }
  
  // For Internet Identity
  if (pnp.activeWallet?.authClient?.getIdentity()) {
    return pnp.activeWallet.authClient.getIdentity();
  }
  
  // Try active wallet as fallback
  if (pnp.activeWallet?.identity) {
    return pnp.activeWallet.identity;
  }

  // Try provider as last resort
  return pnp.provider?.identity;
} 
