<script lang="ts">
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { walletStore, disconnectWallet } from "$lib/stores/walletStore";
    import './colors.css';

    export let isLoggedIn: boolean;
    export let onClose: () => void;
    export let activeTab: 'tokens' | 'pools' | 'transactions';

    let showCopied = false;

    // Function to format address with variable truncation based on screen width
    function formatAddress(address: string, isMobile: boolean): string {
        if (!address) return "";
        if (isMobile) {
            // More truncated for mobile (show fewer characters)
            const start = address.slice(0, 4);
            const end = address.slice(-3);
            return `${start}...${end}`;
        } else {
            // Show more characters on desktop
            const start = address.slice(0, 8);
            const end = address.slice(-6);
            return `${start}...${end}`;
        }
    }

    let windowWidth: number;

    $: walletAddress = $walletStore.account?.owner.toString() || "";
    $: isMobile = windowWidth < 768; // Define mobile breakpoint
    $: displayAddress = formatAddress(walletAddress, isMobile);

    const handleCopy = async () => {
        if (!showCopied && $walletStore.account?.owner) {
            await navigator.clipboard.writeText($walletStore.account.owner.toString());
            showCopied = true;
            setTimeout(() => {
                showCopied = false;
            }, 1500);
        }
    };

    const tabs: ('tokens' | 'pools' | 'transactions')[] = ['tokens', 'pools', 'transactions'];
</script>

<svelte:window bind:innerWidth={windowWidth} />

<header class="sidebar-header">
    <div class="header-content" in:fly={{ x: 400, duration: 300, easing: cubicOut }}>
        {#if isLoggedIn}
            <div class="wallet-info" role="group" aria-label="Wallet information">
                <div class="wallet-section">
                    <div class="wallet-address-container" 
                         class:mobile={isMobile}
                         title={walletAddress}>
                        <span class="wallet-address" 
                              aria-label="Wallet address">
                            {displayAddress}
                        </span>
                    </div>
                    <button 
                        class="copy-button group relative" 
                        class:copied={showCopied}
                        on:click={handleCopy}
                        aria-label={showCopied ? "Principal copied" : "Copy principal"}
                    >
                        <span class="pointer-events-none absolute -top-8 z-[1000] left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition before:absolute before:left-1/2 before:bottom-[-6px] before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-900 before:rotate-180 before:content-[''] group-hover:opacity-100">
                            {showCopied ? "Principal copied!" : "Copy principal"}
                        </span>
                        {#if showCopied}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        {:else}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        {/if}
                    </button>
                </div>
                <div class="action-buttons">
                    <button 
                        class="action-button disconnect-button group relative"
                        on:click={disconnectWallet}
                        aria-label="Disconnect wallet"
                    >
                        <span class="pointer-events-none absolute -top-8 z-[1000] left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition before:absolute before:left-1/2 before:bottom-[-6px] before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-900 before:rotate-180 before:content-[''] group-hover:opacity-100">
                            Disconnect
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                            <line x1="12" y1="2" x2="12" y2="12"></line>
                        </svg>
                    </button>
                    <button 
                        class="action-button close-button !border-0 !shadow-none group relative"
                        on:click={onClose}
                        aria-label="Close sidebar"
                    >
                        <span class="pointer-events-none absolute -top-8 z-[1000] left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition before:absolute before:left-1/2 before:bottom-[-6px] before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-900 before:rotate-180 before:content-[''] group-hover:opacity-100">
                            Close
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#ff4444" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
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
            <div class="wallet-info" role="group" aria-label="Wallet selection">
                <h1 id="wallet-select-title" class="wallet-title">Select Wallet</h1>
                <div class="action-buttons">
                    <button 
                        class="action-button close-button" 
                        on:click={onClose}
                        aria-label="Close sidebar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#ff4444" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        {/if}
    </div>
</header>

<style>
    /* Sidebar Header Styles */
    .sidebar-header {
        min-width: 250px;
        backdrop-filter: blur(8px);
    }

    /* Header Content Layout */
    .header-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
    }

    /* Wallet Information Section */
    .wallet-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: nowrap;
    }

    .wallet-section {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        max-width: calc(100% - 96px);
    }

    .wallet-title {
        font-family: monospace;
        font-size: 20px;
        color: var(--sidebar-wallet-button-text);
        margin: 0;
        font-weight: 600;
        padding: 6px 0;
    }

    /* Wallet Address Display */
    .wallet-address-container {
        display: flex;
        align-items: center;
        background: rgba(0, 0, 0, 0.25);
        padding: 4px 4px;
        border-radius: 6px;
        border: 1px solid var(--sidebar-border);
        flex: 1;
        min-width: 110px;
        max-width: 100%;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
        height: 40px;
    }

    .wallet-address-container.mobile {
        padding: 4px 8px;
        min-width: 90px;
    }

    .wallet-address {
        font-family: monospace;
        font-size: 14px;
        color: white;
        letter-spacing: 0.5px;
        user-select: all;
        font-weight: 500;
    }

    @media (max-width: 767px) {
        .wallet-address {
            font-size: 13px;
            letter-spacing: 0.3px;
        }

        .wallet-section {
            max-width: calc(100% - 88px);
        }
    }

    /* Copy Button Styles */
    .copy-button {
        background: var(--sidebar-border-dark);
        border: 1px solid var(--sidebar-border);
        padding: 8px;
        color: white;
        cursor: pointer;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        height: 40px;
        width: 40px;
        flex-shrink: 0;
    }

    .copy-button.copied {
        background: #4CAF50;
        transform: scale(1.05);
    }

    .copy-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        filter: brightness(1.1);
    }

    .copy-button:focus-visible {
        outline: 2px solid var(--sidebar-border);
        outline-offset: 2px;
    }

    /* Action Buttons Styles */
    .action-buttons {
        display: flex;
        gap: 8px;
    }

    .close-button {
        background: rgba(255, 68, 68, 0.1);
        color: #ff4444;
    }

    .close-button:hover {
        background: rgba(255, 68, 68, 0.2);
    }

    .disconnect-button {
        background: var(--sidebar-disconnect-button-bg);
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

    /* Tab Navigation Styles */
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
        padding: 8px 4px;
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
</style>
