<script lang="ts">
    import { fade, fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    
    export let address: string;
    
    let copied = false;
    let copyTimeout: ReturnType<typeof setTimeout>;

    function formatAddress(addr: string): string {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }
    
    async function copyAddress() {
        if (!browser) return;
        
        try {
            await navigator.clipboard.writeText(address);
            copied = true;
            
            if (copyTimeout) clearTimeout(copyTimeout);
            copyTimeout = setTimeout(() => {
                copied = false;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy address:', err);
        }
    }

    onDestroy(() => {
        if (copyTimeout) clearTimeout(copyTimeout);
    });
</script>

<div 
    class="wallet-address-container"
    in:fly={{ y: -20, duration: 300, easing: cubicOut }}
    out:fade={{ duration: 200 }}
>
    <div class="wallet-address pixel-corners">
        <div class="pixel-border-left"></div>
        <div class="address-content">
            <span class="address-text">{formatAddress(address)}</span>
            <div class="button-group">
                <button 
                    class="action-button copy-button"
                    on:click={copyAddress}
                    aria-label="Copy address"
                >
                    <span class="icon copy-icon">
                        {#if copied}✓{:else}⎘{/if}
                    </span>
                </button>
            </div>
        </div>
    </div>
</div>

<style>
    .wallet-address-container {
        margin: -4px 0 20px 0;
        padding: 0 var(--content-padding);
        width: 100%;
    }

    .wallet-address {
        position: relative;
        background: rgba(0, 0, 0, 0.4);
        border: 2px solid var(--sidebar-border);
        overflow: hidden;
    }

    .pixel-border-left {
        position: absolute;
        left: 0;
        top: 0;
        width: var(--border-width);
        height: 100%;
        background: var(--sidebar-border);
        clip-path: polygon(
            0 0,
            100% 4px,
            100% calc(100% - 4px),
            0 100%,
            0 calc(100% - 8px),
            50% calc(100% - 12px),
            50% 12px,
            0 8px
        );
    }

    .address-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        gap: 8px;
    }

    .address-text {
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        color: var(--sidebar-bg);
        letter-spacing: 0.05em;
        text-shadow: 0 0 8px rgba(255, 204, 0, 0.4);
    }

    .button-group {
        display: flex;
        gap: 8px;
    }

    .action-button {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
        padding: 0;
        background: rgba(255, 204, 0, 0.1);
        border: 2px solid var(--sidebar-border);
        color: var(--sidebar-bg);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .action-button:hover {
        background: var(--sidebar-border);
        color: var(--sidebar-bg);
    }

    .action-button:active {
        transform: scale(0.95);
    }

    .icon {
        font-size: 14px;
        line-height: 1;
        transform: translateY(-1px);
    }
</style>
