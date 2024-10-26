<script lang="ts">
    import { fly, fade, slide } from 'svelte/transition';
    import { elasticOut, quintOut, cubicOut } from 'svelte/easing';
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { spring } from 'svelte/motion';
    
    import SidebarHeader from './sidebar/SidebarHeader.svelte';
    import WalletProvider from './sidebar/WalletProvider.svelte';
    import TokenItem from './sidebar/TokenItem.svelte';
    import TransactionHistory from './sidebar/TransactionHistory.svelte';
    import SocialSection from './sidebar/SocialSection.svelte';
    import WalletAddress from './sidebar/WalletAddress.svelte';
    import SendTokens from './sidebar/SendTokens.svelte';
    import TotalBalance from './sidebar/TotalBalance.svelte';

    export let walletProviders: { name: string; icon: string; description: string; }[] = [];
    export let sidebarOpen: boolean;
    export let onClose: () => void;
    export let onWalletSelect: (provider: string) => void;

    let selectedIndex = 0;
    let isLoggedIn = false;
    let activeView = 'main'; // main, send, receive, history
    let searchQuery = '';
    let isDragging = false;
    let startX: number;
    let startWidth: number;
    let sidebarWidth = spring(600, {
        stiffness: 0.1,
        damping: 0.4
    });
    let sidebarElement: HTMLElement;

    let tokens = [
        { symbol: 'ICP', amount: '5.000', icon: '🔄', usdValue: 12.34 },
        { symbol: 'CKBTC', amount: '0.00300', icon: '₿', usdValue: 42000.00 },
        { symbol: 'CHAT', amount: '1.000', icon: '💬', usdValue: 0.05 },
        { symbol: 'GHOST', amount: '3.000', icon: '👻', usdValue: 1.20 },
        { symbol: 'SNS1', amount: '5.000', icon: '🌐', usdValue: 3.45 },
        { symbol: 'KINIC', amount: '8.000', icon: '🔍', usdValue: 0.75 }
    ];

    $: filteredTokens = tokens.filter(token => 
        token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );

    type Transaction = {
        type: 'send' | 'receive';
        amount: string;
        token: string;
        to?: string;
        from?: string;
        date: string;
    };

    let transactions: Transaction[] = [
        { type: 'send' as const, amount: '1.234', token: 'ICP', to: '0x123...456', date: '2024-01-20' },
        { type: 'receive' as const, amount: '0.5', token: 'CKBTC', from: '0x789...012', date: '2024-01-19' }
    ];

    const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

    function handleKeydown(event: KeyboardEvent) {
        if (!sidebarOpen) return;
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                selectedIndex = (selectedIndex + 1) % (isLoggedIn ? filteredTokens.length : walletProviders.length);
                break;
            case 'ArrowUp':
                event.preventDefault();
                selectedIndex = selectedIndex - 1 < 0 ? 
                    (isLoggedIn ? filteredTokens.length - 1 : walletProviders.length - 1) : 
                    selectedIndex - 1;
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (!isLoggedIn) {
                    isLoggedIn = true;
                    onWalletSelect(walletProviders[selectedIndex].name);
                }
                break;
            case 'Escape':
                event.preventDefault();
                if (activeView !== 'main') {
                    activeView = 'main';
                } else {
                    onClose();
                }
                break;
        }
    }

    function handleWalletSelect(provider: string) {
        isLoggedIn = true;
        onWalletSelect(provider);
    }

    function handleTokenSelect(index: number) {
        activeView = 'send';
        selectedIndex = index;
    }

    function handleBack() {
        activeView = 'main';
    }

    function logout() {
        isLoggedIn = false;
        activeView = 'main';
        selectedIndex = 0;
        searchQuery = '';
    }

    function startDragging(event: MouseEvent) {
        isDragging = true;
        startX = event.clientX;
        startWidth = $sidebarWidth;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ew-resize';
    }

    function handleDragging(event: MouseEvent) {
        if (!isDragging) return;
        const deltaX = startX - event.clientX;
        const newWidth = Math.min(Math.max(startWidth + deltaX, 300), window.innerWidth * 0.8);
        sidebarWidth.set(newWidth);
    }

    function stopDragging() {
        isDragging = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }

    onMount(() => {
        if (browser) {
            window.addEventListener('keydown', handleKeydown);
            window.addEventListener('mousemove', handleDragging);
            window.addEventListener('mouseup', stopDragging);
        }
    });

    onDestroy(() => {
        if (browser) {
            window.removeEventListener('keydown', handleKeydown);
            window.removeEventListener('mousemove', handleDragging);
            window.removeEventListener('mouseup', stopDragging);
        }
    });
</script>

{#if sidebarOpen}
    <div 
        class="sidebar-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Sidebar Menu"
        transition:fade={{ duration: 200 }}
    >
        <button 
            class="overlay-button"
            on:click={onClose}
            aria-label="Close sidebar"
        />
        
        <div 
            class="sidebar" 
            bind:this={sidebarElement}
            style="width: {$sidebarWidth}px"
            in:fly={{ x: 600, duration: 400, easing: cubicOut }}
            out:fly={{ x: 600, duration: 300, easing: cubicOut }}
        >
            <div class="resize-handle" 
                on:mousedown={startDragging}
                role="separator"
                aria-label="Resize sidebar"
            ></div>
            <div class="sidebar-content">
                <div class="main-content">
                    <SidebarHeader {activeView} {isLoggedIn} {onClose} />
                    {#if isLoggedIn}
                        <TotalBalance {tokens} />
                        <WalletAddress address={walletAddress} />
                    {/if}

                    {#if isLoggedIn && activeView !== 'main'}
                        <button 
                            class="back-button"
                            on:click={handleBack}
                        >
                            ← Back
                        </button>
                    {/if}

                    <div class="wallet-list">
                        {#if !isLoggedIn}
                            {#each walletProviders as provider, index}
                                <WalletProvider
                                    {provider}
                                    selected={selectedIndex === index}
                                    onSelect={() => handleWalletSelect(provider.name)}
                                    onHover={() => {
                                        selectedIndex = index;
                                    }}
                                />
                            {/each}
                        {:else if activeView === 'main'}
                            <div class="search-container">
                                <input 
                                    type="text"
                                    placeholder="Search tokens..."
                                    bind:value={searchQuery}
                                    class="search-input"
                                />
                            </div>
                            {#each filteredTokens as token, index}
                                <TokenItem
                                    {token}
                                    selected={selectedIndex === index}
                                    onSelect={() => handleTokenSelect(index)}
                                    onHover={() => {
                                        selectedIndex = index;
                                    }}
                                />
                            {/each}
                        {:else if activeView === 'history'}
                            <TransactionHistory {transactions} />
                        {:else if activeView === 'send'}
                            <SendTokens token={tokens[selectedIndex]} />
                        {/if}
                    </div>
                </div>

                <SocialSection />
            </div>
        </div>
    </div>
{/if}

<style>
    /* Theme variables */
    :root {
        --sidebar-shadow: rgba(0, 0, 0, 0.8);
        --border-gradient-start: #ffcc00;
        --border-gradient-end: #1a4731;
        --scrollbar-track: rgba(26, 71, 49, 0.2);
        --scrollbar-thumb: #ffcc00;
        --scrollbar-thumb-hover: #ffd633;
        --scrollbar-thumb-border: rgba(26, 71, 49, 0.4);
        --search-bg: #000000;
        --search-border: #ffcc00;
        --search-text: #ffcc00;
        --search-placeholder: #666666;
        --search-focus-border: #ffffff;
        --search-focus-shadow: rgba(255, 204, 0, 0.3);
    }

    .sidebar-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
        z-index: 100;
        display: flex;
        justify-content: flex-end;
        transition: backdrop-filter 0.3s ease;
    }

    .overlay-button {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        border: none;
        cursor: pointer;
    }

    .sidebar {
        position: relative;
        height: 100%;
        background: transparent;
        box-shadow: -5px 0 30px var(--sidebar-shadow);
        border: 4px solid;
        border-image: linear-gradient(to bottom, var(--border-gradient-start), var(--border-gradient-end)) 1;
        animation: borderPulse 3s ease-in-out infinite;
        z-index: 1;
        transform-origin: right center;
        will-change: transform;
    }

    .resize-handle {
        position: absolute;
        left: -4px;
        top: 0;
        width: 8px;
        height: 100%;
        cursor: ew-resize;
        background: linear-gradient(to right, var(--border-gradient-start), transparent);
        opacity: 0;
        transition: opacity 0.2s ease;
    }

    .resize-handle:hover {
        opacity: 0.5;
    }

    .sidebar-content {
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .main-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px 24px 0 24px;
        scrollbar-width: thin;
        scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
    }

    .main-content::-webkit-scrollbar {
        width: 6px;
    }

    .main-content::-webkit-scrollbar-track {
        background: var(--scrollbar-track);
        border-radius: 3px;
    }

    .main-content::-webkit-scrollbar-thumb {
        background: var(--scrollbar-thumb);
        border-radius: 3px;
        border: 1px solid var(--scrollbar-thumb-border);
    }

    .main-content::-webkit-scrollbar-thumb:hover {
        background: var(--scrollbar-thumb-hover);
    }

    .search-container {
        margin-bottom: 16px;
    }

    .search-input {
        width: 100%;
        padding: 12px;
        background: var(--search-bg);
        border: 2px solid var(--search-border);
        color: var(--search-text);
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        outline: none;
        transition: all 0.3s ease;
    }

    .search-input:focus {
        border-color: var(--search-focus-border);
        box-shadow: 0 0 10px var(--search-focus-shadow);
    }

    .search-input::placeholder {
        color: var(--search-placeholder);
    }

    .back-button {
        background: none;
        border: none;
        color: var(--search-text);
        font-family: 'Press Start 2P', monospace;
        font-size: 14px;
        padding: 8px 16px;
        margin-bottom: 16px;
        cursor: pointer;
        transition: transform 0.2s ease;
    }

    .back-button:hover {
        transform: translateX(-5px);
    }

    .wallet-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        position: relative;
        z-index: 1;
    }

    @keyframes borderPulse {
        0% { border-image: linear-gradient(to bottom, var(--border-gradient-start), var(--border-gradient-end)) 1; }
        50% { border-image: linear-gradient(to bottom, var(--border-gradient-end), var(--border-gradient-start)) 1; }
        100% { border-image: linear-gradient(to bottom, var(--border-gradient-start), var(--border-gradient-end)) 1; }
    }

    @media (max-width: 768px) {
        .sidebar {
            width: 100%;
        }
        
        .resize-handle {
            display: none;
        }
    }
</style>
