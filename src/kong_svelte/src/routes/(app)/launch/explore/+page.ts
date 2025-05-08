import * as launchpadAPI from "$lib/api/launchpad";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
    let tokens: any[] = [];
    let miners: any[] = [];
    let error: string | null = null;

    try {
        // Use the launchpad API to fetch tokens and miners
        tokens = await launchpadAPI.listTokens();
        miners = await launchpadAPI.listMiners();
    } catch (e: any) {
        console.error("Error fetching launchpad data:", e);
        error = "Failed to load launchpad data. " + (e.message || e.toString());
    }

    return {
        tokens,
        miners,
        error
    };
};