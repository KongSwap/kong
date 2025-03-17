import BigNumber from 'bignumber.js';
import type { FavoriteService } from '$lib/services/tokens/favoriteService';

interface TokenWithMetadata {
  token: FE.Token;
  isFavorite: boolean;
  usdValue: string;
}

/**
 * Sorts tokens by favorite status and USD value
 */
export async function sortTokens(
  tokens: FE.Token[],
  tokenBalances: Record<string, { in_usd: string, in_tokens: string | bigint }>,
  favoriteService: typeof FavoriteService,
  sortDirection: 'asc' | 'desc' = 'desc'
): Promise<FE.Token[]> {
  const tokensWithMetadata = await Promise.all(
    tokens.map(async (token) => ({
      token,
      isFavorite: await favoriteService.isFavorite(token.canister_id),
      usdValue: tokenBalances[token.canister_id]?.in_usd || '0',
      tokenBalance: tokenBalances[token.canister_id]?.in_tokens?.toString() || '0'
    }))
  );

  return tokensWithMetadata
    .sort((a, b) => {
      // First sort by favorites
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      
      // Then sort by USD value
      const aValue = new BigNumber(a.usdValue);
      const bValue = new BigNumber(b.usdValue);

      // then by token balance
      const aBalance = new BigNumber(a.tokenBalance);
      const bBalance = new BigNumber(b.tokenBalance);

      const sortByUsd = sortDirection === 'desc' 
        ? bValue.minus(aValue).toNumber()
        : aValue.minus(bValue).toNumber();

      const sortByTokenBalance = sortDirection === 'desc' 
        ? bBalance.minus(aBalance).toNumber()
        : aBalance.minus(bBalance).toNumber();

      return sortByUsd || sortByTokenBalance;
    })
    .map(({ token }) => token);
}

/**
 * Filters tokens based on balance
 */
export function filterByBalance(
  token: FE.Token,
  tokenBalances: Record<string, { in_tokens: string | bigint, in_usd: string }>,
  hideZeroBalances: boolean
): boolean {
  if (!hideZeroBalances) return true;

  try {
    const balanceRecord = tokenBalances[token.canister_id];
    const balance = parseFloat(balanceRecord?.in_usd || '0');

    return balance > 0;
  } catch (e) {
    console.warn(`Error checking balance for token ${token.canister_id}:`, e);
    return true; // Show tokens with invalid balance format
  }
} 