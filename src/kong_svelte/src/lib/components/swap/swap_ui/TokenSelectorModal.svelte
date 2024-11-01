<script lang="ts">
    import Panel from '$lib/components/common/Panel.svelte';
    import TokenRow from '$lib/components/nav/sidebar/TokenRow.svelte';
    import { TokenService } from '$lib/services/TokenService';
    import { tokenStore } from '$lib/stores/tokenStore';
    import { onMount } from 'svelte';

    export let show = false;
    export let onSelect: (token: string) => void;
    export let onClose: () => void;
    export let currentToken: string;

    let tokens: FE.Token[] = [];
    let searchQuery = '';

    onMount(async () => {
        try {
            // Get base tokens
            const baseTokens = await TokenService.fetchTokens();
            
            // Enrich tokens with metadata (logos)
            tokens = await Promise.all(
                baseTokens.map(token => TokenService.enrichTokenWithMetadata(token))
            );
            // Load balances into tokenStore
            tokenStore.loadBalances();

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
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
        class="modal-overlay" 
        on:click={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Token selector"
    >
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="modal-container" on:click|stopPropagation>
            <Panel variant="green" width="600px" height="80vh" className="token-modal">
                <div class="modal-content">
                    <header class="modal-header">
                        <h2 id="modal-title">Select Token</h2>
                        <button 
                            class="close-button" 
                            on:click={onClose}
                            aria-label="Close token selector"
                        >
                            ×
                        </button>
                    </header>
                    
                    <div class="search-container">
                        <label for="token-search" class="sr-only">Search tokens</label>
                        <input
                            id="token-search"
                            type="text"
                            bind:value={searchQuery}
                            placeholder="Search tokens..."
                            class="search-input"
                            aria-label="Search tokens"
                        />
                    </div>

                    <div 
                        class="token-list"
                        role="listbox"
                        aria-label="Token list"
                    >
                        {#each filteredTokens as token}
                            <button 
                                class="token-button"
                                class:active={token.symbol === currentToken}
                                on:click={() => handleSelect(token.symbol)}
                                role="option"
                                aria-selected={token.symbol === currentToken}
                            >
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
        @apply fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50;
    }

    .modal-container {
        @apply relative w-full h-full max-w-[600px] max-h-[80vh] transform transition-all;
    }

    .modal-content {
        @apply p-6 h-full flex flex-col;
    }

    /* Header Styles */
    .modal-header {
        @apply flex justify-between items-center mb-6;
    }

    .modal-header h2 {
        @apply text-3xl font-bold text-white m-0;
    }

    .close-button {
        @apply bg-transparent border-none text-white/60 text-3xl cursor-pointer 
               hover:text-white transition-colors duration-200 hover:rotate-90;
    }

    /* Search Input */
    .search-container {
        @apply mb-6;
    }

    .search-input {
        @apply w-full bg-black/30 border-2 border-white/10 rounded-xl p-4 
               text-white text-base focus:border-yellow-300/50 focus:outline-none
               transition-all duration-200 hover:border-white/20;
    }

    /* Token List */
    .token-list {
        @apply flex-1 overflow-y-auto -mx-6 px-6 space-y-3;
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.2) transparent;
    }

    .token-list::-webkit-scrollbar {
        width: 6px;
    }

    .token-list::-webkit-scrollbar-track {
        @apply bg-transparent;
    }

    .token-list::-webkit-scrollbar-thumb {
        @apply bg-white/20 rounded-full hover:bg-white/30;
    }

    /* Token Button */
    .token-button {
        @apply w-full p-0 bg-transparent border-none cursor-pointer 
               transition-all duration-200 hover:translate-x-2 hover:scale-[1.02]
               focus:outline-none focus:ring-2 focus:ring-yellow-300/50 rounded-lg;
    }

    .token-button.active {
        @apply opacity-50 cursor-not-allowed hover:translate-x-0 hover:scale-100;
    }

    /* Responsive */
    @media (max-width: 768px) {
        .modal-container {
            @apply max-w-full max-h-[90vh] m-4;
        }
        
        .modal-content {
            @apply p-4;
        }
        
        .token-list {
            @apply -mx-4 px-4;
        }
    }
</style>
