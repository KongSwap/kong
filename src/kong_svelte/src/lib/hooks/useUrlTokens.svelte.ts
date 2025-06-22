import { get } from 'svelte/store';
import { userTokens } from '$lib/stores/userTokens';
import { swapState } from '$lib/stores/swapStateStore';
import { fetchTokensByCanisterId } from '$lib/api/tokens';
import { tick } from 'svelte';

export function useUrlTokens() {
  let lastProcessedSearchParams = $state<string | null>(null);

  async function findTokenByCanisterId(canisterId: string): Promise<Kong.Token | null> {
    if (!canisterId) return null;

    // First check in userTokens
    const tokens = get(userTokens);
    const token = tokens.tokens?.find((t) => t.address === canisterId);
    if (token) return token;

    // If not found, try to fetch it
    try {
      const fetchedTokens = await fetchTokensByCanisterId([canisterId]);
      if (fetchedTokens?.length > 0) {
        return fetchedTokens[0];
      }
    } catch (error) {
      console.error(`Error fetching token ${canisterId}:`, error);
    }

    return null;
  }

  async function handleUrlTokenParams(searchParams: URLSearchParams) {
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!fromParam && !toParam) return;

    // Wait for user tokens if necessary
    let attempts = 0;
    let tokens = get(userTokens);
    while ((!tokens.tokens || tokens.tokens.length === 0) && attempts < 5) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      tokens = get(userTokens); // Re-fetch tokens after waiting
      attempts++;
    }

    const state = get(swapState);
    const currentPayTokenId = state.payToken?.address;
    const currentReceiveTokenId = state.receiveToken?.address;

    // Find tokens only if params exist and are different from current state
    const [newPayToken, newReceiveToken] = await Promise.all([
      fromParam && fromParam !== currentPayTokenId
        ? findTokenByCanisterId(fromParam)
        : Promise.resolve(state.payToken),
      toParam && toParam !== currentReceiveTokenId
        ? findTokenByCanisterId(toParam)
        : Promise.resolve(state.receiveToken),
    ]);

    // Update state only if tokens actually changed
    if (
      newPayToken?.address !== currentPayTokenId ||
      newReceiveToken?.address !== currentReceiveTokenId
    ) {
      swapState.update((state) => ({
        ...state,
        payToken: newPayToken || state.payToken,
        receiveToken: newReceiveToken || state.receiveToken,
        payAmount: "", // Reset amounts when tokens change via URL
        receiveAmount: "",
        error: null,
      }));
      await tick();
      lastProcessedSearchParams = searchParams.toString();
    } else {
      lastProcessedSearchParams = searchParams.toString();
    }
  }

  return {
    handleUrlTokenParams,
    lastProcessedSearchParams: () => lastProcessedSearchParams
  };
} 