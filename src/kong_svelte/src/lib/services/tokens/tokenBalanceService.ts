import { formatTokenBalance, formatUsdValue } from "$lib/utils/tokenFormatters";

export class TokenBalanceService {
  static getTokenBalance(token: FE.Token, balances: Record<string, { in_tokens: bigint }>): bigint {
    const balance = balances[token.canister_id];
    return balance?.in_tokens || BigInt(0);
  }

  static getFormattedBalance(token: FE.Token, balances: Record<string, { in_tokens: bigint; in_usd: string }>) {
    const balance = balances[token.canister_id];
    if (!balance) return { tokens: "0", usd: "0" };
    
    const formattedTokens = formatTokenBalance(balance.in_tokens?.toString() || "0", token.decimals);
    const formattedUsd = formatUsdValue(balance.in_usd || "0");
        
    return {
      tokens: formattedTokens,
      usd: formattedUsd
    };
  }

  static getTokenDisplayBalance(canisterId: string, balances: Record<string, { in_tokens: bigint; in_usd: string }>): { tokens: string; usd: string } {
    const balance = balances[canisterId];
    if (!balance) return { tokens: "0", usd: "$0.00" };
    
    return {
      tokens: formatTokenBalance(balance.in_tokens?.toString() || "0", 8), // Default to 8 decimals if not specified
      usd: formatUsdValue(balance.in_usd || "0")
    };
  }
} 