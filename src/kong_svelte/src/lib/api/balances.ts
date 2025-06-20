import { formatBalance, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { Principal } from "@dfinity/principal";

// Constants
const BATCH_SIZE = 40;
const BATCH_DELAY_MS = 100;
const DEFAULT_PRICE = 0;

// Helper functions
function convertPrincipalId(principalId: string | Principal): Principal {
  return typeof principalId === "string" ? Principal.fromText(principalId) : principalId;
}

function calculateUsdValue(balance: string, price: number | string = DEFAULT_PRICE): number {
  const tokenAmount = parseFloat(balance.replace(/,/g, ''));
  return tokenAmount * Number(price);
}

function formatTokenBalance(balance: bigint | { default: bigint }, decimals: number, price: number | string): TokenBalance {
  const finalBalance = typeof balance === "object" ? balance.default : balance;
  const actualBalance = formatBalance(finalBalance.toString(), decimals)?.replace(/,/g, '');
  const usdValue = calculateUsdValue(actualBalance, price);

  return {
    in_tokens: finalBalance,
    in_usd: usdValue.toString(),
  };
}

// Main functions
export async function fetchBalance(
  token: Kong.Token,
  principalId?: string,
  forceRefresh = false,
): Promise<TokenBalance> {
  try {
    if (!token?.address || !principalId) {
      return {
        in_tokens: BigInt(0),
        in_usd: formatToNonZeroDecimal(0),
      };
    }

    const principal = convertPrincipalId(principalId);
    const balance = await IcrcService.getIcrc1Balance(token, principal);
    return formatTokenBalance(balance, token.decimals, token?.metrics?.price ?? DEFAULT_PRICE);
  } catch (error) {
    console.error(`Error fetching balance for token ${token.address}:`, error);
    return {
      in_tokens: BigInt(0),
      in_usd: formatToNonZeroDecimal(0),
    };
  }
}

async function processBatch(
  batch: Kong.Token[],
  principal: string,
): Promise<Map<string, bigint>> {
  try {
    const batchBalances = await IcrcService.batchGetBalances(batch, principal);
    return new Map(
      Array.from(batchBalances.entries())
        .filter(([_, balance]) => balance !== undefined && balance !== null)
    );
  } catch (error) {
    console.error(`Error processing batch:`, error);
    return new Map();
  }
}

export async function fetchBalances(
  tokens?: Kong.Token[],
  principalId?: string,
  forceRefresh = false,
): Promise<Record<string, TokenBalance>> {
  if (!principalId || !tokens?.length) {
    return {};
  }

  try {
    const principal = principalId;
    const results = new Map<string, bigint>();

    // Process tokens in batches
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens
        .slice(i, i + BATCH_SIZE)
        .map(t => ({ ...t, timestamp: Date.now() }));

      const batchResults = await processBatch(batch, principal);
      for (const [canisterId, balance] of batchResults) {
        results.set(canisterId, balance);
      }

      // Add delay between batches if not the last batch
      if (i + BATCH_SIZE < tokens.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Process results into final format
    return tokens.reduce((acc, token) => {
      const balance = results.get(token.address);
      if (balance !== undefined) {
        const tokenBalance = formatTokenBalance(
          balance,
          token.decimals,
          token?.metrics?.price ?? DEFAULT_PRICE
        );
        acc[token.address] = tokenBalance;
      }
      return acc;
    }, {} as Record<string, TokenBalance>);

  } catch (error) {
    console.error('Error in fetchBalances:', error);
    return {};
  }
}