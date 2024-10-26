<script lang="ts">
    import { fade } from 'svelte/transition';
    
    export let address: string;
    export let onLogout: () => void = () => {}; // Add logout handler prop
    let copied = false;
    
    function formatAddress(addr: string): string {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }
    
    async function copyAddress() {
        await navigator.clipboard.writeText(address);
        copied = true;
        setTimeout(() => {
            copied = false;
        }, 2000);
    }
</script>

<div class="wallet-address" transition:fade={{ duration: 200 }}>
    <div class="address-container">
        <span class="address-text">{formatAddress(address)}</span>
        <div class="button-group">
            <button 
                class="logout-button"
                on:click={onLogout}
                aria-label="Log out"
            >
                <span class="logout-icon">⏻</span>
            </button>
            <button 
                class="copy-button" 
                on:click={copyAddress}
                aria-label="Copy address"
            >
                {#if copied}
                    <span class="copy-icon">✓</span>
                {:else}
                    <span class="copy-icon">⎘</span>
                {/if}
            </button>
        </div>
    </div>
</div>

<style lang="scss">
    .wallet-address {
        margin: -0.25rem 0 1.25rem 0;
        display: flex;
        justify-content: center;
        width: 100%;
    }

    .address-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: rgba(0, 0, 0, 0.4);
        border: 2px solid var(--header-border);
        width: 100%;
        position: relative;
        
        &::before {
            content: '';
            position: absolute;
            top: -1px;
            left: -1px;
            right: -1px;
            bottom: -1px;
            background: linear-gradient(
                45deg,
                var(--header-border) 0%,
                transparent 40%,
                transparent 60%,
                var(--header-border) 100%
            );
            opacity: 0.15;
            pointer-events: none;
        }
    }

    .address-text {
        font-family: 'Press Start 2P', monospace;
        font-size: 0.75rem;
        color: var(--header-text);
        letter-spacing: 0.05em;
        text-shadow: 0 0 8px rgba(255, 204, 0, 0.4);
    }

    .button-group {
        display: flex;
        gap: 0.5rem;
    }

    .copy-button,
    .logout-button {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 1.75rem;
        height: 1.75rem;
        padding: 0;
        background: rgba(255, 204, 0, 0.1);
        border: 2px solid var(--header-border);
        color: var(--header-text);
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        
        &::after {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: linear-gradient(
                45deg,
                var(--header-border) 0%,
                transparent 40%,
                transparent 60%,
                var(--header-border) 100%
            );
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        &:hover {
            background: var(--header-border);
            color: var(--header-bg);
            
            &::after {
                opacity: 0.3;
            }
        }

        &:active {
            transform: scale(0.95);
        }
    }

    .logout-button {
        background: rgba(255, 0, 0, 0.1);
        
        &:hover {
            background: rgba(255, 0, 0, 0.8);
        }
    }

    .copy-icon,
    .logout-icon {
        font-size: 0.875rem;
        line-height: 1;
        transform: translateY(-1px);
    }

    .logout-icon {
        transform: rotate(90deg) translateX(-1px);
    }
</style>
