import type { Principal } from "@dfinity/principal";

export interface AuthState {
    account?: {
        owner: Principal;
    };
}

export interface TokenState {
    favoriteTokens: Record<string, string[]>;
    // Add other token state properties as needed
}
