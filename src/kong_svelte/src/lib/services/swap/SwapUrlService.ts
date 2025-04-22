import { browser } from "$app/environment";
import { replaceState } from "$app/navigation";

export class SwapUrlService {
    static updateTokenInURL(param: "from" | "to", tokenId: string) {
        if (!browser) return;
        
        const url = new URL(window.location.href);
        url.searchParams.set(param, tokenId);
        replaceState(url.toString(), {});
    }

    static async initializeFromUrl(
        userTokens: Kong.Token[], 
        fetchTokensByCanisterId: (ids: string[]) => Promise<Kong.Token[]>,
        onTokensLoaded: (token0: Kong.Token | null, token1: Kong.Token | null) => void
    ) {
        if (!browser || !userTokens.length) return;

        const url = new URL(window.location.href);
        const token0Id = url.searchParams.get("from") || url.searchParams.get("token0");
        const token1Id = url.searchParams.get("to") || url.searchParams.get("token1");

        if (!token0Id && !token1Id) return;

        const tokens = await fetchTokensByCanisterId([token0Id, token1Id]);
        const token0 = token0Id ? tokens.find((t) => t.address === token0Id) : null;
        const token1 = token1Id ? tokens.find((t) => t.address === token1Id) : null;

        if (token0 || token1) {
            onTokensLoaded(token0, token1);
        }
    }
} 