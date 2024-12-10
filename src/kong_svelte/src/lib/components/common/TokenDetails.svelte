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
    width="min(800px, 95vw)"
>
    <div class="token-details">
        <!-- Token Header -->
        <div class="token-header">
            <div class="token-info">
                <div class="left-section">
                    <img
                        src={token?.logo_url ?? "/tokens/not_verified.webp"}
                        alt={token.symbol}
                        class="token-logo"
                    />
                    <div class="token-meta">
                        <h3 class="token-symbol">{token.symbol}</h3>
                        <p class="token-name">{token.name}</p>
                    </div>
                </div>
                <div class="right-section">
                    <div class="balance-info">
                        <span class="balance-value">
                            {formatBalance(token.balance?.toString() ?? "0", token.decimals)} {token.symbol}
                        </span>
                        {#if token?.metrics?.price}
                            <span class="balance-usd">{formatUsdValue(token?.metrics?.price)}</span>
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
    .token-details {
        @apply flex flex-col min-h-0;
        min-height: 550px;
    }

    .token-header {
        @apply px-6 py-4 border-b border-white/10;
    }

    .token-info {
        @apply flex justify-between items-center;
    }

    .left-section {
        @apply flex items-center gap-3;
    }

    .right-section {
        @apply flex items-end flex-col;
    }

    .token-logo {
        @apply w-10 h-10 rounded-full 
               ring-1 ring-white/10 
               bg-black/20;
    }

    .token-meta {
        @apply flex flex-col;
    }

    .token-symbol {
        @apply text-lg font-bold text-white;
    }

    .token-name {
        @apply text-sm text-white/70 -mt-0.5;
    }

    .balance-info {
        @apply flex flex-col items-end gap-0.5;
    }

    .balance-value {
        @apply text-lg font-semibold text-white;
    }

    .balance-usd {
        @apply text-sm text-white/60;
    }

    .action-tabs {
        @apply flex gap-1 p-1 mt-4
               bg-black/20 rounded-lg;
    }

    .tab-button {
        @apply flex-1 px-4 py-2.5
               text-sm font-medium text-white/60 
               rounded-md transition-all
               hover:text-white hover:bg-white/5;
    }

    .tab-button.active {
        @apply bg-white/10 text-white;
    }

    .tab-content {
        @apply flex-1 overflow-y-auto min-h-0;
    }

    @media (max-width: 640px) {
        .token-header {
            @apply px-4 py-3;
        }

        .tab-button {
            @apply py-2 text-sm;
        }

        .token-symbol {
            @apply text-base;
        }

        .token-name {
            @apply text-xs;
        }

        .balance-value {
            @apply text-base;
        }

        .token-logo {
            @apply w-8 h-8;
        }
    }
</style>
