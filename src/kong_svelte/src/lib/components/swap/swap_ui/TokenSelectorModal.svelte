<script lang="ts">
    import Modal from '$lib/components/common/Modal.svelte';
    import TokenRow from '$lib/components/sidebar/TokenRow.svelte';
    import { formattedTokens } from '$lib/services/tokens/tokenStore';

    export let show = false;
    export let onSelect: (token: string) => void;
    export let onClose: () => void;
    export let currentToken: string;

    let searchQuery = '';
    let standardFilter = 'all';

    $: filteredTokens = $formattedTokens.filter(token => {
        const matchesSearch = 
            token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            token.name.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

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

<Modal
    show={show}
    title="Select Token"
    onClose={onClose}
    variant="green"
>
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
</Modal>

<style>
    .search-container {
        margin-bottom: 1rem;
    }

    .search-input {
        width: 100%;
        background-color: rgba(0, 0, 0, 0.3);
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-radius: 0.75rem;
        padding: 0.5rem;
        color: white;
        font-size: 1.125rem;
        font-weight: 500;
        transition: all 200ms;
    }

    .search-input:hover {
        border-color: rgba(255, 255, 255, 0.2);
    }

    .search-input:focus {
        border-color: rgba(253, 224, 71, 0.5);
        outline: none;
    }

    .search-input::placeholder {
        color: rgba(255, 255, 255, 0.6);
    }

    .filter-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        justify-content: flex-start;
        margin-top: 0.5rem;
    }

    .filter-btn {
        padding: 0.375rem 0.75rem;
        border-radius: 0.5rem;
        background-color: rgba(0, 0, 0, 0.3);
        border: 2px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.8);
        font-size: 0.875rem;
        font-weight: 500;
        transition: all 200ms;
    }

    .filter-btn:hover {
        border-color: rgba(255, 255, 255, 0.2);
        color: white;
    }

    .filter-btn.active {
        border-color: rgba(253, 224, 71, 0.5);
        color: rgb(253, 224, 71);
        background-color: rgba(0, 0, 0, 0.5);
    }

    .token-list {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        margin: 0;
        padding: 0.25rem 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        scrollbar-width: thin;
    }

    .token-list::-webkit-scrollbar {
        width: 6px;
    }

    .token-list::-webkit-scrollbar-track {
        background: transparent;
    }

    .token-list::-webkit-scrollbar-thumb {
        background-color: rgba(255, 255, 255, 0.2);
        border-radius: 9999px;
    }

    .token-list::-webkit-scrollbar-thumb:hover {
        background-color: rgba(255, 255, 255, 0.3);
    }

    .token-button {
        width: 100%;
        padding: 0 1rem;
        background: transparent;
        border: none;
        cursor: pointer;
        transition: all 200ms;
        border-radius: 0.5rem;
        min-width: 0;
    }

    .token-button:hover {
        transform: translateX(0.25rem) scale(1.01);
    }

    .token-button:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(253, 224, 71, 0.5);
    }

    .token-button.active {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .token-button.active:hover {
        transform: none;
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
</style>
