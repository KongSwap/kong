import { formatTokenBalance, formatUsdValue } from "$lib/utils/tokenFormatters";

export class TokenBalanceService {
  static getTokenBalance(token: FE.Token, balances: Record<string, { in_tokens: bigint }>): bigint {
    const balance = balances[token.canister_id];
    return balance?.in_tokens || BigInt(0);
  }

  static getTokenDisplayBalance(
    canisterId: string, 
    balances: Record<string, { in_tokens: bigint; in_usd: string }>, 
    tokens: Record<string, FE.Token>
  ): { tokens: string; usd: string } {
    const balance = balances[canisterId];
    if (!balance) return { tokens: "0", usd: "$0.00" };
    
    const decimals = tokens[canisterId]?.decimals || 8;
    
    return {
      tokens: formatTokenBalance(balance.in_tokens?.toString() || "0", decimals),
      usd: formatUsdValue(balance.in_usd || "0")
    };
  }
} 