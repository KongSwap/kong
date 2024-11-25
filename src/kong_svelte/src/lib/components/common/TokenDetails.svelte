<script lang="ts">
    import { fade } from 'svelte/transition';
    import Modal from '$lib/components/common/Modal.svelte';
    import { tokenLogoStore } from "$lib/services/tokens/tokenLogos";
    import { formatBalance, formatUsdValue } from '$lib/utils/tokenFormatters';
    import SendTokens from '$lib/components/sidebar/SendTokens.svelte';
    import ReceiveTokens from '$lib/components/sidebar/ReceiveTokens.svelte';
    import { createEventDispatcher } from 'svelte';

    export let token: FE.Token;
    
    const dispatch = createEventDispatcher();
    let activeTab: 'send' | 'receive' = 'receive';

    function handleClose() {
        dispatch('close');
    }
</script>

<Modal
    isOpen={true}
    onClose={handleClose}
    title={token.name}
    width="min(600px, 95vw)"
>
    <div class="token-details">
        <!-- Token Header -->
        <div class="token-header">
            <div class="token-info">
                <img
                    src={$tokenLogoStore[token.canister_id] ?? "/tokens/not_verified.webp"}
                    alt={token.symbol}
                    class="token-logo"
                />
                <div class="token-meta">
                    <h3 class="token-symbol">{token.symbol}</h3>
                    <div class="token-stats">
                        <div class="stat">
                            <span class="stat-label">Balance</span>
                            <span class="stat-value">
                                {formatBalance(token.balance?.toString() ?? "0", token.decimals)}
                            </span>
                        </div>
                        {#if token.price}
                            <div class="stat">
                                <span class="stat-label">Value</span>
                                <span class="stat-value">{formatUsdValue(token.price)}</span>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>

        <!-- Action Tabs -->
        <div class="action-tabs">
            <button
                class="tab-button"
                class:active={activeTab === 'receive'}
                on:click={() => activeTab = 'receive'}
            >
                Receive
            </button>
            <button
                class="tab-button"
                class:active={activeTab === 'send'}
                on:click={() => activeTab = 'send'}
            >
                Send
            </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
            {#if activeTab === 'receive'}
                <ReceiveTokens {token} />
            {:else}
                <SendTokens {token} />
            {/if}
        </div>
    </div>
</Modal>

<style lang="postcss">
    /************************************************************************************************
     * Layout
     ************************************************************************************************/
    .token-details {
        @apply flex flex-col min-h-0;
    }

    .token-header {
        @apply p-6 border-b border-white/10;
    }

    .token-info {
        @apply flex items-center gap-4;
    }

    /************************************************************************************************
     * Token Visuals
     ************************************************************************************************/
    .token-logo {
        @apply w-12 h-12 rounded-full 
               ring-2 ring-white/10 
               bg-black/20;
    }

    .token-meta {
        @apply flex flex-col gap-2;
    }

    .token-symbol {
        @apply text-2xl font-bold text-white;
    }

    .token-stats {
        @apply flex gap-6;
    }

    .stat {
        @apply flex flex-col gap-0.5;
    }

    .stat-label {
        @apply text-sm text-white/50;
    }

    .stat-value {
        @apply text-base font-medium text-white;
    }

    /************************************************************************************************
     * Tabs
     ************************************************************************************************/
    .action-tabs {
        @apply flex gap-1 p-1 mx-6 mt-6 
               bg-black/20 rounded-lg;
    }

    .tab-button {
        @apply flex-1 px-4 py-2.5 
               text-sm font-medium text-white/60 
               rounded-md transition-colors 
               hover:text-white;
    }

    .tab-button.active {
        @apply bg-white/10 text-white;
    }

    /************************************************************************************************
     * Content
     ************************************************************************************************/
    .tab-content {
        @apply flex-1 overflow-y-auto min-h-0;
    }

    /************************************************************************************************
     * Mobile Adjustments
     ************************************************************************************************/
    @media (max-width: 640px) {
        .token-header {
            @apply p-4;
        }

        .action-tabs {
            @apply mx-4 mt-4;
        }

        .tab-button {
            @apply py-3 text-base;
        }

        .token-symbol {
            @apply text-xl;
        }

        .stat-value {
            @apply text-lg;
        }
    }
</style>
