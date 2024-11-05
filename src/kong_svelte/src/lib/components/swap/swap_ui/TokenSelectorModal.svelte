<!-- Description: This is the TokenSelectorModal component that displays the token selector modal. -->
<script lang="ts">
    import Panel from '$lib/components/common/Panel.svelte';
    import TokenRow from '$lib/components/sidebar/TokenRow.svelte';
    import { TokenService } from '$lib/services/TokenService';
    import { tokenStore } from '$lib/stores/tokenStore';
    import { onMount } from 'svelte';
    import { formattedTokens } from '$lib/stores/tokenStore';

    export let show = false;
    export let onSelect: (token: string) => void;
    export let onClose: () => void;
    export let currentToken: string;

    let searchQuery = '';
    let standardFilter = 'all';

    onMount(async () => {
        try {
            // Load balances into tokenStore
            tokenStore.loadBalances();

        } catch (error) {
            console.error('Error loading tokens:', error);
        }
    });

    $: filteredTokens = $formattedTokens.tokens.filter(token => {
        // First check if token matches search query
        const matchesSearch = 
            token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            token.name.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        // Then apply filter
        switch (standardFilter) {
            case 'ck':
                return token.symbol.toLowerCase().startsWith('ck');
            case 'all':
            default:
                return true;
        }
    });

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
        transition:fade={{ duration: 200 }}
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
                        <div class="filter-buttons">
                            <button 
                                class="filter-btn {standardFilter === 'all' ? 'active' : ''}"
                                on:click={() => standardFilter = 'all'}
                            >
                                All
                            </button>
                            <button 
                                class="filter-btn {standardFilter === 'ck' ? 'active' : ''}"
                                on:click={() => standardFilter = 'ck'}
                            >
                                ckTokens
                            </button>
                        </div>
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
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        z-index: 50;
        display: grid;
        place-items: center;
        overflow: hidden;
    }

    .modal-container {
        @apply relative w-full h-full max-w-[600px] max-h-[80vh] transform;
        animation: modalSlideIn 200ms ease-out;
    }

    @keyframes modalSlideIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
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
        @apply mb-6 space-y-4;
    }

    .search-input {
        @apply w-full bg-black/30 border-2 border-white/10 rounded-xl p-4 
               text-white text-lg font-medium focus:border-yellow-300/50 focus:outline-none
               transition-all duration-200 hover:border-white/20 placeholder:text-white/60;
    }

    /* Filter Buttons */
    .filter-buttons {
        @apply flex flex-wrap gap-2 justify-start;
        margin-top: 1rem;
    }

    .filter-btn {
        @apply px-3 py-1.5 rounded-lg bg-black/30 border-2 border-white/10 text-white/80
               hover:border-white/20 hover:text-white transition-all duration-200 text-sm font-medium;
    }

    .filter-btn.active {
        @apply border-yellow-300/50 text-yellow-300 bg-black/50;
    }

    /* Token List */
    .token-list {
        @apply flex-1 overflow-y-auto -mx-6 px-6 space-y-3 py-2;
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
               transition-all duration-200 hover:translate-x-2 hover:scale-[1.02] hover:bg-black/20
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
