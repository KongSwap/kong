import { userTokens } from "$lib/stores/userTokens";

/**
 * Apply token sync changes to add and remove tokens
 * @param tokensToAdd - List of tokens to add
 * @param tokensToRemove - List of tokens to remove
 * @returns Object with counts of added and removed tokens
 */
export async function applyTokenSync(
  tokensToAdd: Kong.Token[],
  tokensToRemove: Kong.Token[]
): Promise<{ added: number; removed: number }> {
  try {
    // Use the userTokens store to apply the changes
    const syncStatus = await userTokens.applyTokenSync(
      tokensToAdd,
      tokensToRemove
    );
    
    return syncStatus;
  } catch (error) {
    console.error("Error applying token changes:", error);
    return { added: 0, removed: 0 };
  }
}

/**
 * Analyze the user's tokens to find tokens to add or remove
 * @param walletId - The wallet ID to analyze
 * @returns Object containing tokens to add, remove, and status
 */
export async function analyzeUserTokens(
  walletId: string
): Promise<{
  tokensToAdd: Kong.Token[];
  tokensToRemove: Kong.Token[];
  syncStatus: { added: number; removed: number } | null;
}> {
  try {
    // Use the userTokens store to analyze tokens
    const result = await userTokens.analyzeUserTokens(walletId);
    return result;
  } catch (error) {
    console.error("Error analyzing user tokens:", error);
    return {
      tokensToAdd: [],
      tokensToRemove: [],
      syncStatus: null
    };
  }
} 