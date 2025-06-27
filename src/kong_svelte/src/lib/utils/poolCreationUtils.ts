import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { CKUSDT_CANISTER_ID } from '$lib/constants/canisterConstants';
import { BigNumber } from "bignumber.js";

export function getCreatePoolButtonText(
  hasTokens: boolean,
  hasPrice: boolean,
  hasAmount: boolean,
  isLoading: boolean,
  loadingState?: string
): string {
  if (isLoading) return loadingState || "Creating Pool...";
  if (!hasTokens) return "Select Tokens";
  if (!hasPrice) return "Enter Initial Price";
  if (!hasAmount) return "Enter Amount";
  return "Create Pool";
}

export const doesPoolExist = (token0: Kong.Token | null, token1: Kong.Token | null, pools: BE.Pool[]) => {
  if (!token0 || !token1) return null;
  
  return pools.some(p => 
    (p.address_0 === token0.address && p.address_1 === token1.address) ||
    (p.address_0 === token1.address && p.address_1 === token0.address)
  );
}

export const getDefaultToken = (token: string, tokens: Kong.Token[]) => {
  return tokens.find(t => t.address === CKUSDT_CANISTER_ID);
}

export function validateTokenSelect(
  selectedToken: Kong.Token,
  otherToken: Kong.Token | null,
  allowedTokens: string[],
  defaultToken: string,
  tokens: Kong.Token[]
): { 
  isValid: boolean;
  newToken: Kong.Token | null;
  error?: string;
} {
  if (!otherToken) { return { isValid: true, newToken: selectedToken };}
  const hasAllowedToken = allowedTokens.includes(selectedToken.symbol) || allowedTokens.includes(otherToken.symbol);
  const isDifferentTokens = selectedToken.address !== otherToken.address;
  const isValid = hasAllowedToken && isDifferentTokens

  if (!isValid) {
      const defaultTokenObj = tokens.find(t => t.symbol === defaultToken);
      return {
          isValid: false,
          newToken: defaultTokenObj || null,
          error: 'One token must be ICP or ckUSDT'
      };
  }

  return { isValid: true, newToken: selectedToken };
}

export function updateQueryParams(token0Id?: string, token1Id?: string) {
  if (!browser) return;
  
  // Navigate to the new position URL with updated token addresses
  const newUrl = `/pools/${token0Id}_${token1Id}`;
  goto(newUrl, { 
    replaceState: true,  // Replace current history entry (like your original replaceState)
    noScroll: true       // Prevent scrolling to top
  });
  
  // // Fallback to original query param behavior for other pages
  // const params = new URLSearchParams();
  // if (token0Id) params.set('token0', token0Id);
  // if (token1Id) params.set('token1', token1Id);
  
  // const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
  // replaceState(newUrl, {});
}