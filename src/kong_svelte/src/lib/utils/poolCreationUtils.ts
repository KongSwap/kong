import { browser } from '$app/environment';
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

export const doesPoolExist = (token0: FE.Token | null, token1: FE.Token | null, pools: BE.Pool[]) => {
  if (!token0 || !token1) return null;
  
  return pools.some(p => 
    (p.address_0 === token0.canister_id && p.address_1 === token1.canister_id) ||
    (p.address_0 === token1.canister_id && p.address_1 === token0.canister_id)
  );
}

export const getDefaultToken = (token: string, tokens: FE.Token[]) => {
  return tokens.find(t => t.canister_id === CKUSDT_CANISTER_ID);
}

export function validateTokenSelect(
  selectedToken: FE.Token,
  otherToken: FE.Token | null,
  allowedTokens: string[],
  defaultToken: string,
  tokens: FE.Token[]
): { 
  isValid: boolean;
  newToken: FE.Token | null;
  error?: string;
} {
  if (!otherToken) { return { isValid: true, newToken: selectedToken };}
  const hasAllowedToken = allowedTokens.includes(selectedToken.symbol) || allowedTokens.includes(otherToken.symbol);
  const isDifferentTokens = selectedToken.canister_id !== otherToken.canister_id;
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
  
  const params = new URLSearchParams();
  if (token0Id) params.set('token0', token0Id);
  if (token1Id) params.set('token1', token1Id);
  
  const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
  window.history.replaceState({}, '', newUrl);
}

export function calculateAmount1FromPrice(amount0: string, initialPrice: string) {
  if (!amount0 || !initialPrice) return;
  const price = new BigNumber(initialPrice);
  if (price.isZero()) return;
  
  const cleanAmount0 = amount0.replace(/[,_]/g, "");
  return price.times(cleanAmount0).toString();
}