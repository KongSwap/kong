import { writable } from 'svelte/store';

// Initialize the token store with an empty array
const { subscribe, set, update } = writable<Kong.Token[]>([]);

// Create the token store with additional methods
export const tokenStore = {
    subscribe,
    set,
    // Update specific token data
    updateToken: (updatedToken: Kong.Token) => {
        update(tokens => {
            const index = tokens.findIndex(t => t.address === updatedToken.address);
            if (index !== -1) {
                tokens[index] = updatedToken;
            } else {
                tokens.push(updatedToken);
            }
            return tokens;
        });
    },
    // Update multiple tokens at once
    updateTokens: (updatedTokens: Kong.Token[]) => {
        update(tokens => {
            updatedTokens.forEach(updatedToken => {
                const index = tokens.findIndex(t => t.address === updatedToken.address);
                if (index !== -1) {
                    tokens[index] = updatedToken;
                } else {
                    tokens.push(updatedToken);
                }
            });
            return tokens;
        });
    },
    // Clear all tokens
    clear: () => set([])
};

// Export a readable version of the current token data for use in other files
export const tokenData = {
    subscribe
};
