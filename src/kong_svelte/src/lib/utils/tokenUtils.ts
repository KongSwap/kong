import type { SolanaTokenInfo } from '$lib/config/solana.config';

export type AnyToken = Kong.Token | SolanaTokenInfo;

/**
 * Type guard to check if a token is a Kong token (ICP)
 */
export const isKongToken = (token: AnyToken | null): token is Kong.Token => {
  return token !== null && 'address' in token && typeof token.address === 'string';
};

/**
 * Type guard to check if a token is a Solana token
 */
export const isSolanaToken = (token: AnyToken | null): token is SolanaTokenInfo => {
  return token !== null && 'mint_address' in token && typeof token.mint_address === 'string';
};

/**
 * Get the token identifier (address for ICP, mint_address for Solana)
 */
export const getTokenId = (token: AnyToken | null): string | null => {
  if (isKongToken(token)) {
    return token.address;
  } else if (isSolanaToken(token)) {
    return token.mint_address;
  }
  return null;
};

/**
 * Filter an array of tokens to only include Kong tokens
 */
export const filterKongTokens = (tokens: (AnyToken | null)[]): Kong.Token[] => {
  return tokens.filter(isKongToken);
};

/**
 * Filter an array of tokens to only include Solana tokens
 */
export const filterSolanaTokens = (tokens: (AnyToken | null)[]): SolanaTokenInfo[] => {
  return tokens.filter(isSolanaToken);
}; 