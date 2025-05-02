import { auth } from "$lib/stores/auth";
import { 
    canisterId as launchpadCanisterId, 
    idlFactory as launchpadIDL // Import the IDL factory directly
} from "$declarations/launchpad"; 
// Remove import of canisterIDLs as it's not needed here for launchpad
import type { _SERVICE as LaunchpadService } from "$declarations/launchpad/launchpad.did.js";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
    let tokens: any[] = [];
    let miners: any[] = [];
    let error: string | null = null;

    try {
        const launchpadActor = await auth.getActor(
            launchpadCanisterId,
            launchpadIDL,
            { anon: true }
        ) as LaunchpadService;

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
