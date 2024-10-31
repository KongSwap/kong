<script lang="ts">
    import Panel from '$lib/components/common/Panel.svelte';
    import { fade, fly } from 'svelte/transition';
    import { TokenService } from '$lib/services/TokenService';
    import { onMount } from 'svelte';

    export let show = false;
    export let onSelect: (token: string) => void;
    export let onClose: () => void;

    let tokens: any[] = [];
    let searchQuery = '';

    onMount(async () => {
        try {
            const result = await TokenService.fetchTokens();
            tokens = result;
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
    <div class="modal-overlay" transition:fade={{duration: 200}} on:click={onClose}>
        <div class="modal-container" on:click|stopPropagation>
            <Panel variant="green" width="400px" height="auto" className="token-modal">
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
                            <button
                                class="token-option"
                                on:click={() => handleSelect(token.symbol)}
                            >
                                <div class="token-info">
                                    <span class="token-symbol">{token.symbol}</span>
                                    <span class="token-name">{token.name}</span>
                                </div>
                            </button>
                        {/each}
                    </div>
                </div>
            </Panel>
        </div>
    </div>
{/if}

<style>
    * {
        font-family: 'Alumni Sans', sans-serif;
    }

    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }

    .modal-container {
        position: relative;
        max-width: 90vw;
        min-width: 320px;
        max-height: 90vh;
    }

    .modal-content {
        padding: 1rem;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .modal-header h2 {
        font-size: 1.5rem;
        color: white;
        margin: 0;
    }

    .close-button {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0.5rem;
        line-height: 1;
        transition: color 0.2s ease;
    }

    .close-button:hover {
        color: white;
    }

    .search-container {
        margin-bottom: 1rem;
    }

    .search-input {
        width: 100%;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 0.75rem;
        color: white;
        font-size: 1rem;
        transition: border-color 0.2s ease;
    }

    .search-input:focus {
        outline: none;
        border-color: rgba(255, 255, 255, 0.2);
    }

    .token-list {
        max-height: 300px;
        overflow-y: auto;
        margin: 0 -1rem;
        padding: 0 1rem;
    }

    .token-option {
        width: 100%;
        padding: 0.75rem;
        background: transparent;
        border: none;
        border-radius: 8px;
        color: white;
        cursor: pointer;
        transition: background-color 0.2s ease;
        text-align: left;
        margin-bottom: 0.25rem;
    }

    .token-option:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .token-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .token-symbol {
        font-size: 1.125rem;
        font-weight: 500;
    }

    .token-name {
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.5);
    }
</style>
