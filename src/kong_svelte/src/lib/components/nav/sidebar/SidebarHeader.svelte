<script lang="ts">
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { walletStore, disconnectWallet } from "$lib/stores/walletStore";
    import { fade } from 'svelte/transition';

    import './colors.css';

    export let isLoggedIn: boolean;
    export let onClose: () => void;
    export let activeTab: 'tokens' | 'pools' | 'transactions';

    let showCopied = false;

    const truncateAddress = (address: string) => {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(walletAddress);
        if (!showCopied) {
            showCopied = true;
            setTimeout(() => {
                showCopied = false;
            }, 1500);
        }
    };

    $: walletAddress = $walletStore.account?.owner.toString() || "";

    const tabs: ('tokens' | 'pools' | 'transactions')[] = ['tokens', 'pools', 'transactions'];
</script>

<header class="sidebar-header" role="banner">
    <div class="header-content" in:fly={{ x: 400, duration: 300, easing: cubicOut }}>
        {#if isLoggedIn}
            <div class="wallet-info" role="group" aria-label="Wallet information">
                <div class="wallet-address-container">
                    <span class="wallet-address" aria-label="Wallet address">{truncateAddress(walletAddress)}</span>
                    <button 
                        class="copy-button" 
                        class:copied={showCopied}
                        on:click={handleCopy}
                        aria-label={showCopied ? "Address copied" : "Copy wallet address"}
                    >
                        {#if showCopied}
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        {:else}
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        {/if}
                    </button>
                </div>
                <button 
                    class="disconnect-button" 
                    on:click={disconnectWallet}
                    aria-label="Disconnect wallet"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                        <line x1="12" y1="2" x2="12" y2="12"></line>
                    </svg>
                    <span class="disconnect-text">Disconnect</span>
                </button>
            </div>
            <nav class="tab-navigation" role="tablist" aria-label="Content sections">
                {#each tabs as tab}
                    <button 
                        class="tab-button" 
                        class:active={activeTab === tab}
                        on:click={() => activeTab = tab}
                        role="tab"
                        aria-selected={activeTab === tab}
                        aria-controls={`${tab}-panel`}
                        id={`${tab}-tab`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                {/each}
            </nav>
        {:else}
            <div class="header-title">
                <h1 id="wallet-select-title">Select Wallet</h1>
                <button 
                    class="close-button" 
                    on:click={onClose}
                    aria-label="Close sidebar"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        {/if}
    </div>
</header>

<style>
    .sidebar-header {
        min-width: 250px;
        backdrop-filter: blur(8px);
    }

    .header-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
    }

    .wallet-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .wallet-address-container {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(0, 0, 0, 0.15);
        padding: 6px 10px;
        border-radius: 4px;
        border: 1px solid var(--sidebar-border);
    }

    .wallet-address {
        font-family: monospace;
        font-size: 14px;
        color: var(--sidebar-border-dark);
        letter-spacing: 0.5px;
        user-select: all;
    }

    .copy-button {
        background: none;
        border: none;
        padding: 4px;
        color: var(--sidebar-border-dark);
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }

    .copy-button.copied {
        color: #4CAF50;
        transform: scale(1.1);
    }

    .copy-button:hover {
        background: rgba(0, 0, 0, 0.1);
    }

    .copy-button:focus-visible {
        outline: 2px solid var(--sidebar-border);
        outline-offset: 2px;
    }

    .disconnect-button {
        background: var(--sidebar-border-dark);
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        color: white;
        font-family: monospace;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s ease;
        white-space: nowrap;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .disconnect-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    }

    .disconnect-button:focus-visible {
        outline: 2px solid var(--sidebar-border);
        outline-offset: 2px;
    }

    .header-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
    }

    .header-title h1 {
        font-family: monospace;
        font-size: 20px;
        color: var(--sidebar-border-dark);
        margin: 0;
        font-weight: 600;
    }

    .close-button {
        background: none;
        border: none;
        padding: 6px;
        color: var(--sidebar-border-dark);
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.15s ease;
    }

    .close-button:hover {
        background: rgba(0, 0, 0, 0.1);
        transform: rotate(90deg);
    }

    .close-button:focus-visible {
        outline: 2px solid var(--sidebar-border);
        outline-offset: 2px;
    }

    .tab-navigation {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        width: 100%;
        gap: 8px;
        padding: 0 4px;
    }

    .tab-button {
        background: transparent;
        border: none;
        padding: 8px 6px;
        color: var(--sidebar-border);
        font-family: monospace;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
        opacity: 0.7;
        position: relative;
    }

    .tab-button::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 2px;
        background: white;
        transform: scaleX(0);
        transition: transform 0.2s ease;
    }

    .tab-button:hover {
        color: white;
        opacity: 0.9;
    }

    .tab-button:focus-visible {
        outline: 2px solid var(--sidebar-border);
        outline-offset: 2px;
    }

    .tab-button.active {
        color: white;
        opacity: 1;
    }

    .tab-button.active::after {
        transform: scaleX(1);
    }

    @media (max-width: 768px) {
        .header-content {
            padding: 12px;
            gap: 8px;
        }

        .wallet-info {
            flex-wrap: wrap;
        }

        .wallet-address-container {
            flex: 1;
            min-width: 140px;
        }

        .disconnect-button {
            padding: 6px;
            flex: 0;
        }

        .tab-button {
            font-size: 14px;
            padding: 8px 4px;
        }
    }
</style>
