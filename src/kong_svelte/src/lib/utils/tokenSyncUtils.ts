import { Principal } from "@dfinity/principal";
import { fetchAllTokens } from "$lib/api/tokens";
import { userTokens } from "$lib/stores/userTokens";
import { get } from "svelte/store";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { 
  CKUSDT_CANISTER_ID, 
  ICP_CANISTER_ID,
  CKBTC_CANISTER_ID,
  CKETH_CANISTER_ID
} from "$lib/constants/canisterConstants";

// List of essential tokens that should never be removed
const ESSENTIAL_TOKEN_IDS = [
  CKUSDT_CANISTER_ID,
  ICP_CANISTER_ID,
  CKBTC_CANISTER_ID,
  CKETH_CANISTER_ID
].filter(Boolean); // Filter out any undefined values

/**
 * Synchronizes user tokens based on their actual balances.
 * Fetches all available tokens, checks balances, and updates the userTokens store:
 * - Adds tokens with non-zero balances
 * - Removes tokens with zero balances (except for essential tokens like CKUSDT and ICP)
 * 
 * @param principalId - The user's principal ID
 * @returns {Promise<{added: number, removed: number}>} - Stats about tokens added and removed
 */
export async function syncTokens(principalId: string | Principal): Promise<{added: number, removed: number}> {
  if (!principalId) {
    console.warn("Cannot sync tokens: Missing principal ID");
    return { added: 0, removed: 0 };
  }

  const principal = typeof principalId === "string" 
    ? Principal.fromText(principalId) 
    : principalId;
  
  try {
    // Get all available tokens
    const allTokens = await fetchAllTokens();
    if (!allTokens || allTokens.length === 0) {
      console.warn("No tokens returned from API");
      return { added: 0, removed: 0 };
    }

    // Get current user tokens state
    const currentUserTokens = get(userTokens);
    const currentTokenIds = new Set(currentUserTokens.tokens.map(t => t.canister_id));
    
    // Create a map to track tokens that should be enabled
    const shouldBeEnabled = new Map<string, FE.Token>();
    
    // Track essential tokens found in the token list
    const essentialTokensFound = new Map<string, FE.Token>();
    
    // Track changes
    let tokensAdded = 0;
    let tokensRemoved = 0;
    
    // First, identify essential tokens in the all tokens list
    for (const token of allTokens) {
      if (token.canister_id && ESSENTIAL_TOKEN_IDS.includes(token.canister_id)) {
        essentialTokensFound.set(token.canister_id, token);
      }
    }
    
    // Process tokens in batches to avoid overwhelming the network
    const BATCH_SIZE = 25;
    for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
      const tokenBatch = allTokens.slice(i, i + BATCH_SIZE);
      
      try {
        // Get balances for this batch
        const batchBalances = await IcrcService.batchGetBalances(tokenBatch, principal);
        
        // Process each token in the batch
        for (const token of tokenBatch) {
          if (!token.canister_id) continue;
          
          // Check if token is essential
          const isEssentialToken = ESSENTIAL_TOKEN_IDS.includes(token.canister_id);
          
          // For normal tokens, check balance
          const balance = batchBalances.get(token.canister_id);
          const hasBalance = balance !== undefined && balance !== null && balance > BigInt(0);
          
          // Token should be enabled if it has balance OR is an essential token
          if (hasBalance || isEssentialToken) {
            shouldBeEnabled.set(token.canister_id, token);
            
            // If it's an essential token, make sure we have it in our tracking
            if (isEssentialToken) {
              essentialTokensFound.set(token.canister_id, token);
            }
          }
        }
      } catch (error) {
        console.error("Error processing token batch:", error);
        // Continue with the next batch in case of error
      }
      
      // Add a small delay between batches
      if (i + BATCH_SIZE < allTokens.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Now handle token updates based on our complete map of tokens with balances
    
    // 1. Add tokens that have balances but aren't in the user's list
    for (const [canisterId, token] of shouldBeEnabled.entries()) {
      if (!currentTokenIds.has(canisterId)) {
        userTokens.enableToken(token);
        tokensAdded++;
      }
    }
    
    // 2. Remove tokens that are in the user's list but don't have balances
    // (except for essential tokens like CKUSDT and ICP)
    for (const canisterId of currentTokenIds) {
      if (!shouldBeEnabled.has(canisterId) && !ESSENTIAL_TOKEN_IDS.includes(canisterId)) {
        userTokens.disableToken(canisterId);
        tokensRemoved++;
      }
    }
    
    // 3. Make sure essential tokens are added even if they weren't in the user's list
    // and weren't found in the balance check
    for (const tokenId of ESSENTIAL_TOKEN_IDS) {
      const token = essentialTokensFound.get(tokenId);
      if (token && !currentTokenIds.has(tokenId) && !shouldBeEnabled.has(tokenId)) {
        userTokens.enableToken(token);
        tokensAdded++;
      }
    }
    
    return { added: tokensAdded, removed: tokensRemoved };
  } catch (error) {
    console.error("Error syncing tokens:", error);
    return { added: 0, removed: 0 };
  }
} 