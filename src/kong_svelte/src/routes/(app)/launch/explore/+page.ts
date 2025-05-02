import { auth } from "$lib/stores/auth";
import { canisterId as launchpadCanisterId } from "$declarations/launchpad";
import { canisterIDLs } from "$lib/config/auth.config";
import type { _SERVICE as LaunchpadService } from "$declarations/launchpad/launchpad.did.js";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
    let tokens: any[] = [];
    let miners: any[] = [];
    let error: string | null = null;

    try {
        // Get the launchpad actor (anonymous call is sufficient for query methods)
        const launchpadActor = await auth.getActor(
            launchpadCanisterId,
            canisterIDLs.launchpad,
            { anon: true, host: 'https://icp0.io' } // Use anonymous actor for query calls
        ) as LaunchpadService; // Cast to the service type

        // Fetch tokens and miners
        tokens = await launchpadActor.list_tokens();
        miners = await launchpadActor.list_miners();

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
