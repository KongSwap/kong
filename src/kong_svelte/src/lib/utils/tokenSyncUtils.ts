import { Principal } from "@dfinity/principal";
import { fetchAllTokens } from "$lib/api/tokens";
import { userTokens } from "$lib/stores/userTokens";
import { get } from "svelte/store";
import { DEFAULT_TOKENS } from "$lib/constants/canisterConstants";
import { loadBalances } from "$lib/stores/balancesStore";

// List of essential tokens that should never be removed
const ESSENTIAL_TOKEN_IDS = [
  DEFAULT_TOKENS.icp, // ICP
  DEFAULT_TOKENS.kong, // KONG
  DEFAULT_TOKENS.ckbtc, // CKBTC
  DEFAULT_TOKENS.cketh, // CKETH
  DEFAULT_TOKENS.ckusdc, // CKUSDC
  DEFAULT_TOKENS.ckusdt, // CKUSDT
  DEFAULT_TOKENS.exe, // EXE
  DEFAULT_TOKENS.dkp, // DKP
].filter(Boolean);

/**
 * Analyzes user tokens based on their actual balances.
 * Fetches all available tokens, checks balances, and returns candidates for addition/removal:
 * - Tokens with non-zero balances that aren't in the user's list (candidates for addition)
 * - Tokens with zero balances that are in the user's list (candidates for removal)
 * - Essential tokens are always kept, regardless of balance
 *
 * @param principalId - The user's principal ID
 * @returns {Promise<{tokensToAdd: Kong.Token[], tokensToRemove: string[], stats: {added: number, removed: number}}>}
 *          - Lists of tokens to add/remove and stats
 */
export async function syncTokens(principalId: string | Principal): Promise<{
  tokensToAdd: Kong.Token[];
  tokensToRemove: string[];
  stats: { added: number; removed: number };
}> {
  if (!principalId) {
    console.warn("Cannot sync tokens: Missing principal ID");
    return {
      tokensToAdd: [],
      tokensToRemove: [],
      stats: { added: 0, removed: 0 },
    };
  }

  const principal =
    typeof principalId === "string"
      ? Principal.fromText(principalId)
      : principalId;

  try {
    // Get all available tokens
    const allTokens = await fetchAllTokens();
    if (!allTokens || allTokens.length === 0) {
      console.warn("No tokens returned from API");
      return {
        tokensToAdd: [],
        tokensToRemove: [],
        stats: { added: 0, removed: 0 },
      };
    }

    // Get current user tokens state
    const currentUserTokens = get(userTokens);
    const currentTokenIds = new Set(
      currentUserTokens.tokens.map((t) => t.address),
    );

    // Create a map to track tokens that should be enabled
    const shouldBeEnabled = new Map<string, Kong.Token>();

    // Track essential tokens found in the token list
    const essentialTokensFound = new Map<string, Kong.Token>();

    // Arrays to track tokens that would be added or removed
    const tokensToAdd: Kong.Token[] = [];
    const tokensToRemove: string[] = [];

    // First, identify essential tokens in the all tokens list
    for (const token of allTokens) {
      if (token.address && ESSENTIAL_TOKEN_IDS.includes(token.address)) {
        essentialTokensFound.set(token.address, token);
      }
    }

    // Process tokens in batches to avoid overwhelming the network
    const BATCH_SIZE = 25;
    for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
      const tokenBatch = allTokens.slice(i, i + BATCH_SIZE);

      try {
        // Get balances for this batch
        const batchBalances = await loadBalances(
          tokenBatch,
          principal.toText(),
          true,
        );
        // Process each token in the batch
        for (const token of tokenBatch) {
          if (!token.address) continue;

          // Check if token is essential
          const isEssentialToken = ESSENTIAL_TOKEN_IDS.includes(token.address);

          // For normal tokens, check balance
          const balance = batchBalances[token.address];
          const hasBalance =
            balance !== undefined &&
            balance !== null &&
            balance.in_tokens !== undefined &&
            balance.in_tokens > BigInt(0);

          // Token should be enabled if it has balance OR is an essential token
          if (hasBalance || isEssentialToken) {
            shouldBeEnabled.set(token.address, token);

            // If it's an essential token, make sure we have it in our tracking
            if (isEssentialToken) {
              essentialTokensFound.set(token.address, token);
            }
          }
        }
      } catch (error) {
        console.error("Error processing token batch:", error);
        // Continue with the next batch in case of error
      }

      // Add a small delay between batches
      if (i + BATCH_SIZE < allTokens.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Now collect tokens that could be added or removed

    // 1. Find tokens that have balances but aren't in the user's list
    for (const [canisterId, token] of shouldBeEnabled.entries()) {
      if (!currentTokenIds.has(canisterId)) {
        tokensToAdd.push(token);
      }
    }

    // 2. Find tokens that are in the user's list but don't have balances
    // (except for essential tokens like CKUSDT and ICP)
    for (const canisterId of currentTokenIds) {
      if (
        !shouldBeEnabled.has(canisterId) &&
        !ESSENTIAL_TOKEN_IDS.includes(canisterId)
      ) {
        tokensToRemove.push(canisterId);
      }
    }

    // 3. Add essential tokens that weren't found in the balance check
    for (const tokenId of ESSENTIAL_TOKEN_IDS) {
      const token = essentialTokensFound.get(tokenId);
      if (
        token &&
        !currentTokenIds.has(tokenId) &&
        !shouldBeEnabled.has(tokenId)
      ) {
        tokensToAdd.push(token);
      }
    }

    return {
      tokensToAdd,
      tokensToRemove,
      stats: {
        added: tokensToAdd.length,
        removed: tokensToRemove.length,
      },
    };
  } catch (error) {
    console.error("Error analyzing tokens:", error);
    return {
      tokensToAdd: [],
      tokensToRemove: [],
      stats: { added: 0, removed: 0 },
    };
  }
}

/**
 * Actually applies the token changes after user confirmation
 * @param tokensToAdd Tokens to add to user's list
 * @param tokensToRemove Canister IDs of tokens to remove
 * @returns Stats about tokens added and removed
 */
export async function applyTokenChanges(
  tokensToAdd: Kong.Token[],
  tokensToRemove: string[],
): Promise<{ added: number; removed: number }> {
  let tokensAdded = 0;
  let tokensRemoved = 0;

  // Add new tokens
  for (const token of tokensToAdd) {
    userTokens.enableToken(token);
    tokensAdded++;
  }

  // Remove tokens
  for (const canisterId of tokensToRemove) {
    userTokens.disableToken(canisterId);
    tokensRemoved++;
  }

  return { added: tokensAdded, removed: tokensRemoved };
}
