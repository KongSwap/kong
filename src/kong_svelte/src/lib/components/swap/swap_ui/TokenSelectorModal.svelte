<script lang="ts">
    import Panel from '$lib/components/common/Panel.svelte';
    import TokenRow from '$lib/components/nav/sidebar/TokenRow.svelte';
    import { TokenService } from '$lib/services/TokenService';
    import { tokenStore } from '$lib/stores/tokenStore';
    import { onMount } from 'svelte';

    export let show = false;
    export let onSelect: (token: string) => void;
    export let onClose: () => void;

    let tokens: any[] = [];
    let searchQuery = '';

    onMount(async () => {
        try {
            // Get tokens from TokenService
            const result = await TokenService.fetchTokens();
            
            // Map tokens to include required properties for TokenRow
            tokens = result.map(token => ({
                ...token,
                logo: token.logo || "/tokens/not_verified.webp",
                canister_id: token.canister_id || token.id,
                decimals: token.decimals || 8
            }));

            // Load balances into tokenStore if not already loaded
            if (!$tokenStore.balances) {
                await tokenStore.loadBalances();
            }
        } catch (error) {
            console.error('Error loading tokens:', error);
        }
    });

    $: filteredTokens = tokens.filter(token => 
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    function handleSelect(token: string) {
        onSelect(token);
        onClose();
    }
</script>

{#if show}
    <div class="modal-overlay" on:click={onClose}>
        <div class="modal-container" on:click|stopPropagation>
            <Panel variant="green" width="600px" height="80vh" className="token-modal">
                <div class="modal-content">
                    <header class="modal-header">
                        <h2>Select Token</h2>
                        <button class="close-button" on:click={onClose}>×</button>
                    </header>
                    
                    <div class="search-container">
                        <input
                            type="text"
                            bind:value={searchQuery}
                            placeholder="Search tokens..."
                            class="search-input"
                        />
                    </div>

                    <div class="token-list">
                        {#each filteredTokens as token}
                            <button class="token-button" on:click={() => handleSelect(token.symbol)}>
                                <TokenRow {token} />
                            </button>
                        {/each}
                    </div>
                </div>
            </Panel>
        </div>
    </div>
{/if}

<style lang="postcss">
    /* Modal Layout */
    .modal-overlay {
        @apply fixed inset-0 bg-black/70 flex items-center justify-center;
    }

    .modal-container {
        @apply relative w-full h-full max-w-[600px] max-h-[80vh];
    }

    .modal-content {
        @apply p-4 h-full flex flex-col;
    }

    /* Header Styles */
    .modal-header {
        @apply flex justify-between items-center mb-4;
    }

    .modal-header h2 {
        @apply text-2xl text-white m-0;
    }

    .close-button {
        @apply bg-transparent border-none text-white/60 text-2xl cursor-pointer 
               hover:text-white transition-colors;
    }

    /* Search Input */
    .search-container {
        @apply mb-4;
    }

    .search-input {
        @apply w-full bg-black/20 border border-white/10 rounded-lg p-3 
               text-white text-base focus:border-white/20 focus:outline-none;
    }

    /* Token List */
    .token-list {
        @apply flex-1 overflow-y-auto -mx-4 px-4;
    }

    /* Token Button */
    .token-button {
        @apply w-full p-0 bg-transparent border-none cursor-pointer 
               transition-transform hover:translate-x-1;
    }

    /* Responsive */
    @media (max-width: 768px) {
        .modal-container {
            @apply max-w-full max-h-[90vh] m-4;
        }
    }
</style>
