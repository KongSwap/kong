<!-- Description: This is the TokenSelectorModal component that displays the token selector modal. -->
<script lang="ts">
    import Panel from '$lib/components/common/Panel.svelte';
    import TokenRow from '$lib/components/sidebar/TokenRow.svelte';
    import { formattedTokens } from '$lib/services/tokens/tokenStore';
    import { fade } from 'svelte/transition';
    import { browser } from "$app/environment";
    import { onMount } from "svelte";

    export let show = false;
    export let onSelect: (token: string) => void;
    export let onClose: () => void;
    export let currentToken: string;

    let searchQuery = '';
    let standardFilter = 'all';

    let isMobile = false;

    let panelWidth = "600px";

    onMount(() => {
        if (browser) {
            const updateWidth = () => {
                const width = window.innerWidth;
                if (width <= 768) {
                    // Calculate responsive width between 300px and 600px
                    const calculatedWidth = Math.max(300, Math.min(width - 50, 600));
                    panelWidth = `${calculatedWidth}px`;
                } else {
                    panelWidth = "600px";
                }
                isMobile = width <= 768;
            };
            
            updateWidth();
            window.addEventListener('resize', updateWidth);
        }
    });

    $: filteredTokens = $formattedTokens.filter(token => {
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
        <div 
            class="modal-container" 
            on:click|stopPropagation
        >
            <Panel 
                variant="green" 
                width={panelWidth}
                height="80vh"
                className="token-modal"
            >
                <div class="modal-content">
                    <header class="modal-header">
                        <h2 id="modal-title">Select Token</h2>
                        <button 
                            class="action-button close-button !border-0 !shadow-none group relative"
                            on:click={onClose}
                            aria-label="Close token selector"
                        >
                            <span class="pointer-events-none absolute -top-8 z-[1000] left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition before:absolute before:left-1/2 before:bottom-[-6px] before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-900 before:rotate-180 before:content-[''] group-hover:opacity-100">
                                Close
                            </span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="#ff4444"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true"
                            >
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
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

<style>
    /* Modal Layout */
    .modal-overlay {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        z-index: 50;
        display: grid;
        place-items: center;
        overflow: hidden;
    }

    .modal-container {
        position: relative;
        transform: translateY(0);
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
        padding: 1.5rem;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    /* Header Styles */
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .modal-header h2 {
        font-size: 1.875rem;
        font-weight: bold;
        color: white;
        margin: 0;
    }

    .action-button {
        border: 1px solid var(--sidebar-border);
        padding: 6px;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        width: 40px;
        height: 40px;
        flex-shrink: 0;
    }

    .action-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    }

    .action-button:focus-visible {
        outline: 2px solid var(--sidebar-border);
        outline-offset: 2px;
    }

    .close-button {
        background: rgba(186, 49, 49, 0.4);
        color: #ffffff;
    }

    .close-button:hover {
        background: rgba(255, 68, 68, 0.5);
    }

    .search-container {
        margin-bottom: 1.5rem;
    }

    .search-input {
        width: 100%;
        background-color: rgba(0, 0, 0, 0.3);
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-radius: 0.75rem;
        padding: 1rem;
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
        gap: 0.5rem;
        justify-content: flex-start;
        margin-top: 1rem;
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

    /* Token List */
    .token-list {
        flex: 1;
        overflow-y: auto;
        margin: 0 -1.5rem;
        padding: 0.5rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
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

    /* Token Button */
    .token-button {
        width: 100%;
        padding: 0;
        background: transparent;
        border: none;
        cursor: pointer;
        transition: all 200ms;
        border-radius: 0.5rem;
    }

    .token-button:hover {
        transform: translateX(0.5rem) scale(1.02);
        background-color: rgba(0, 0, 0, 0.2);
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
